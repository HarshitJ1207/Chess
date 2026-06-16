package com.example.chess.matchmaking.service;

import com.example.chess.matchmaking.dto.MatchRequest;
import com.example.chess.matchmaking.dto.QueueRequest;
import com.example.chess.matchmaking.dto.QueueResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.http.HttpStatus;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class MatchmakingService {

    private static final String QUEUE_KEY_PREFIX = "queue:";
    private static final String MATCH_REQUEST_TOPIC = "match-request";

    private static final List<String> TIME_CONTROLS = List.of(
        "1+0",
        "3+0",
        "5+0",
        "10+0",
        "15+10"
    );

    private final StringRedisTemplate redis;
    private final KafkaTemplate<String, MatchRequest> kafkaTemplate;
    private final ObjectMapper mapper = new ObjectMapper();

    @Value("${matchmaking.elo-range:200}")
    private int eloRange;

    /**
     * Player joins or polls the queue.
     *
     * First checks if player is already in an active game (via Redis player key).
     * If in game, returns match details.
     * Otherwise, adds player to queue and returns queued status.
     */
    public QueueResponse joinQueue(String username, QueueRequest request) {
        // Check if player is already in an active game
        String playerGameJson = redis.opsForValue().get("player:" + username + ":game");

        if (playerGameJson != null) {
            try {
                // Parse JSON to extract game details
                // JSON format: {"gameId":"...", "myColor":"white", "opponentUsername":"...", "timeControl":"...", "instanceUri":"..."}
                JsonNode node = mapper.readTree(playerGameJson);
                String gameId = node.get("gameId").asText();
                String myColor = node.get("myColor").asText();
                String opponentUsername = node.get("opponentUsername").asText();

                return QueueResponse.matched(UUID.fromString(gameId), myColor, opponentUsername);
            } catch (Exception e) {
                // JSON parse failed — stale entry, clean it up
                redis.delete("player:" + username + ":game");
            }
        }

        // Not in active game, add to queue
        String queueKey = QUEUE_KEY_PREFIX + request.timeControl();
        redis.opsForZSet().add(queueKey, username, request.elo());

        return QueueResponse.queued();
    }

    /**
     * Player leaves the queue.
     *
     * Rejects if player is already in a game.
     */
    public void leaveQueue(String username, String timeControl) {
        // Check if already in a game
        String playerGameJson = redis.opsForValue().get("player:" + username + ":game");

        if (playerGameJson != null) {
            try {
                // Try to parse JSON — if valid, player is in an active game
                JsonNode node = mapper.readTree(playerGameJson);
                if (node.has("gameId")) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Already in a game");
                }
            } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
                // Not JSON — stale entry, clean it up
                redis.delete("player:" + username + ":game");
            }
        }

        // Remove from queue
        redis.opsForZSet().remove(QUEUE_KEY_PREFIX + timeControl, username);
    }

    /**
     * Background job that runs every 10 seconds.
     *
     * Loads queue snapshot, pairs adjacent players within ELO range,
     * and publishes match requests to Kafka.
     */
    @Scheduled(fixedDelay = 10000)
    public void matchPlayers() {
        for (String timeControl : TIME_CONTROLS) {
            matchInQueue(timeControl);
        }
    }

    private void matchInQueue(String timeControl) {
        String queueKey = QUEUE_KEY_PREFIX + timeControl;

        // Load entire queue snapshot (isolated from concurrent changes)
        Set<ZSetOperations.TypedTuple<String>> queue =
            redis.opsForZSet().rangeWithScores(queueKey, 0, -1);

        if (queue == null || queue.size() < 2) {
            return; // Not enough players
        }

        // Convert to list sorted by ELO
        List<Player> players = queue.stream()
            .map(t -> new Player(t.getValue(), t.getScore().intValue()))
            .toList();

        // Greedy pairing: pair adjacent players within ELO range
        for (int i = 0; i < players.size() - 1; i++) {
            Player p1 = players.get(i);
            Player p2 = players.get(i + 1);

            if (Math.abs(p1.elo - p2.elo) <= eloRange) {
                // Atomic removal: only proceed if BOTH players were still in the queue.
                // This prevents pairing a player who just clicked 'Cancel'.
                Long removed = redis.opsForZSet().remove(queueKey, p1.username, p2.username);
                
                if (removed != null && removed == 2) {
                    publishMatchRequest(p1.username, p2.username, timeControl);
                    i++; // Skip next player (already paired)
                } else {
                    log.debug("Failed to pair {} and {} (one or both already left queue)", p1.username, p2.username);
                }
            }
        }
    }

    private void publishMatchRequest(String p1Username, String p2Username, String timeControl) {
        // Create deterministic partition key (sorted player usernames)
        String partitionKey = createPartitionKey(p1Username, p2Username);

        // Publish match request (game-service will create gameId and assign colors)
        MatchRequest request = new MatchRequest(p1Username, p2Username, timeControl);

        kafkaTemplate.send(MATCH_REQUEST_TOPIC, partitionKey, request);

        log.info("Match request published: {} vs {} [key={}] ({})",
            p1Username, p2Username, partitionKey, timeControl);
    }

    /**
     * Create deterministic partition key from two player usernames.
     *
     * Sorts alphabetically to ensure (A,B) and (B,A) produce same key.
     * This ensures same player pair always goes to same Kafka partition.
     */
    private String createPartitionKey(String p1, String p2) {
        if (p1.compareTo(p2) < 0) {
            return p1 + ":" + p2;
        } else {
            return p2 + ":" + p1;
        }
    }

    record Player(String username, int elo) {}
}
