package com.example.chess.matchmaking.service;

import com.example.chess.matchmaking.dto.MatchCreatedEvent;
import com.example.chess.matchmaking.dto.QueueRequest;
import com.example.chess.matchmaking.dto.QueueResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MatchmakingService {

    private static final String QUEUE_KEY_PREFIX = "queue:";
    private static final String MATCH_CREATED_TOPIC = "match-created";

    private final StringRedisTemplate redis;
    private final KafkaTemplate<String, MatchCreatedEvent> kafkaTemplate;

    @Value("${matchmaking.elo-range:200}")
    private int eloRange;

    public QueueResponse joinQueue(String playerId, QueueRequest request) {
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

        kafkaTemplate.send(MATCH_CREATED_TOPIC, gameId.toString(),
                new MatchCreatedEvent(gameId, whiteId, blackId, timeControl));

        String color = requesterIsWhite ? "white" : "black";
        return QueueResponse.matched(gameId, color, opponentId);
    }
}
