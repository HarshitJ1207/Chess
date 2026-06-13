package com.example.chess.matchmaking.service;

import com.example.chess.matchmaking.dto.MatchCreatedEvent;
import com.example.chess.matchmaking.dto.QueueRequest;
import com.example.chess.matchmaking.dto.QueueResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MatchmakingService {

    private static final String QUEUE_KEY_PREFIX = "queue:";
    private static final String PENDING_MATCH_PREFIX = "pending_match:";
    private static final String MATCH_CREATED_TOPIC = "match-created";
    private static final String GAME_SERVICE_NAME = "GAME-SERVICE";

    private final StringRedisTemplate redis;
    private final KafkaTemplate<String, MatchCreatedEvent> kafkaTemplate;
    private final DiscoveryClient discoveryClient;

    @Value("${matchmaking.elo-range:200}")
    private int eloRange;

    public QueueResponse joinQueue(String playerId, QueueRequest request) {
        // Check if this player was already matched by someone else's request
        String pendingKey = PENDING_MATCH_PREFIX + playerId;
        String pending = redis.opsForValue().getAndDelete(pendingKey);
        if (pending != null) {
            // Format: "gameId:color:opponentId"
            String[] parts = pending.split(":");
            return QueueResponse.matched(UUID.fromString(parts[0]), parts[1], parts[2]);
        }

        String queueKey = QUEUE_KEY_PREFIX + request.timeControl();
        double elo = request.elo();

        // Find opponent within elo range, excluding the requesting player
        Set<String> candidates = redis.opsForZSet()
                .rangeByScore(queueKey, elo - eloRange, elo + eloRange);

        String opponentId = candidates == null ? null :
                candidates.stream()
                        .filter(id -> !id.equals(playerId))
                        .findFirst()
                        .orElse(null);

        if (opponentId != null) {
            // Atomically claim the opponent — if another request beat us, ZREM returns 0
            Long removed = redis.opsForZSet().remove(queueKey, opponentId);
            if (removed != null && removed > 0) {
                return createMatch(playerId, opponentId, request.timeControl());
            }
        }

        // No match found — add to queue (or refresh position if already present)
        redis.opsForZSet().add(queueKey, playerId, elo);
        return QueueResponse.queued();
    }

    public void leaveQueue(String playerId, String timeControl) {
        redis.opsForZSet().remove(QUEUE_KEY_PREFIX + timeControl, playerId);
    }

    private QueueResponse createMatch(String requesterId, String opponentId, String timeControl) {
        UUID gameId = UUID.randomUUID();

        // Coin-flip: requester is white ~50% of the time
        boolean requesterIsWhite = gameId.getLeastSignificantBits() > 0;
        String whiteId = requesterIsWhite ? requesterId : opponentId;
        String blackId = requesterIsWhite ? opponentId : requesterId;

        // Pin both players to same game-service instance (consistent hash by gameId)
        List<ServiceInstance> instances = discoveryClient.getInstances(GAME_SERVICE_NAME);
        if (instances.isEmpty()) {
            throw new RuntimeException("No game-service instances available");
        }
        ServiceInstance target = instances.get(Math.abs(gameId.hashCode()) % instances.size());
        String gameServiceUri = target.getUri().toString();

        kafkaTemplate.send(MATCH_CREATED_TOPIC, gameId.toString(),
                new MatchCreatedEvent(gameId, whiteId, blackId, timeControl, gameServiceUri));

        // Store match result for the opponent so their next poll picks it up
        String opponentColor = requesterIsWhite ? "black" : "white";
        String pendingValue = gameId + ":" + opponentColor + ":" + requesterId;
        redis.opsForValue().set(PENDING_MATCH_PREFIX + opponentId, pendingValue, Duration.ofSeconds(30));

        String requesterColor = requesterIsWhite ? "white" : "black";
        return QueueResponse.matched(gameId, requesterColor, opponentId);
    }
}
