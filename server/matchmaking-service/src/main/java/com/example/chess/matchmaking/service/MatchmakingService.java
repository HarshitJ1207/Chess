package com.example.chess.matchmaking.service;

import com.example.chess.matchmaking.client.RatingClient;
import com.example.chess.matchmaking.config.KafkaTopicConfig;
import com.example.chess.matchmaking.dto.MatchRequest;
import com.example.chess.matchmaking.dto.QueueRequest;
import com.example.chess.matchmaking.dto.QueueResponse;
import com.example.chess.matchmaking.dto.RatingResponse;
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

import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class MatchmakingService {

    private static final String QUEUE_KEY_PREFIX = "queue:";
    private static final String PLAYER_QUEUE_KEY_PREFIX = "player:";
    private static final String PLAYER_QUEUE_KEY_SUFFIX = ":queue";
    /**
     * Backstop TTL for the queue-membership claim. The claim is normally released by
     * {@link #leaveQueue} (cancel, navigate away, tab close) or on match detection. This TTL is
     * refreshed on every poll <em>while the player is still visibly in the ZSET</em>, which covers
     * a throttled background tab (browsers slow timers to roughly once a minute).
     *
     * <p>Once the matchmaking loop removes a matched pair from the ZSET, the claim is deliberately left
     * to expire rather than refreshed. That is what stops a player from being re-added to the
     * ZSET during the dispatch window (which would risk a duplicate match request), while still
     * bounding how long a claim orphaned by an aborted match request can block a fresh search.
     */
    private static final Duration QUEUE_CLAIM_TTL = Duration.ofMinutes(2);
    private static final String MATCH_REQUEST_TOPIC = KafkaTopicConfig.MATCH_REQUEST_TOPIC;

    private static final List<String> TIME_CONTROLS = List.of(
        "1+0",
        "3+0",
        "5+0",
        "10+0",
        "15+10"
    );

    private final StringRedisTemplate redis;
    private final KafkaTemplate<String, MatchRequest> kafkaTemplate;
    private final RatingClient ratingClient;
    private final ObjectMapper mapper = new ObjectMapper();

    @Value("${matchmaking.elo-range:200}")
    private int eloRange;

    /**
     * Player joins or polls the queue.
     *
     * First checks if player is already in an active game (via Redis player key).
     * If in game, returns match details.
     * Otherwise, adds player to queue and returns queued status.
     *
     * <p>Also enforces single-queue membership: a player waiting in one time control cannot
     * join another. See the claim check below for why the game key and the ZSET are both
     * insufficient as guards.
     */
    public QueueResponse joinQueue(String username, QueueRequest request, boolean anonymous) {
        // Check if player is already in an active game
        String playerGameJson = redis.opsForValue().get("player:" + username + ":game");

        if (playerGameJson != null) {
            QueueResponse matchedResponse = null;
            try {
                // Parse JSON to extract game details
                // JSON format: {"gameId":"...", "myColor":"white", "opponentUsername":"...", "timeControl":"...", "instanceUri":"..."}
                JsonNode node = mapper.readTree(playerGameJson);
                String gameId = node.get("gameId").asText();
                String myColor = node.get("myColor").asText();
                String opponentUsername = node.get("opponentUsername").asText();

                matchedResponse = QueueResponse.matched(UUID.fromString(gameId), myColor, opponentUsername);
            } catch (Exception e) {
                // JSON parse failed — stale entry, clean it up
                redis.delete("player:" + username + ":game");
            }
            if (matchedResponse != null) {
                // Keep cleanup outside the parse handler: a Redis failure must not erase a
                // valid active-game claim or allow this player to join another queue.
                redis.delete(queueClaimKey(username));
                return matchedResponse;
            }
        }

        // Fetch user's rating securely on the backend if they are registered
        int elo = 1500;
        if (!anonymous) {
            try {
                RatingResponse response = ratingClient.getRating(username);
                if (response != null) {
                    elo = (int) Math.round(response.rating());
                }
            } catch (feign.FeignException.NotFound e) {
                // Fresh user who hasn't played games yet, default to 1500
                elo = 1500;
            } catch (Exception e) {
                log.warn("Failed to fetch rating for {}, falling back to 1500", username, e);
                elo = 1500;
            }
        }

        // Not in an active game — add the player to the queue for this time control, but only if
        // they aren't already searching in a different one. The active-game check above does not
        // cover this: a player still waiting has no `player:{username}:game` key yet, so a second
        // tab could freely join another queue. The ZSET cannot be the guard either, because a
        // player legitimately already belongs to the queue they are re-joining (every poll
        // re-invokes this method). Hence a dedicated membership claim.
        String queueKey = queueKey(request.timeControl(), anonymous);
        String claimKey = queueClaimKey(username);

        String claimedQueue = redis.opsForValue().get(claimKey);

        if (claimedQueue != null) {
            if (!claimedQueue.equals(queueKey)) {
                throw queuedElsewhere(claimedQueue);
            }
            // Status poll for the queue we are already in. Deliberately do NOT re-ZADD: the
            // pairing loop may have just removed this player to hand them to game-service, and
            // re-adding would let them be paired a second time. The TTL is only extended while
            // the ZSET still holds the player, so a claim orphaned by an aborted match request
            // expires instead of blocking this player forever.
            if (isStillWaiting(username, queueKey)) {
                redis.expire(claimKey, QUEUE_CLAIM_TTL);
            }
            return QueueResponse.queued();
        }

        Boolean claimed = redis.opsForValue().setIfAbsent(claimKey, queueKey, QUEUE_CLAIM_TTL);

        if (!Boolean.TRUE.equals(claimed)) {
            // Lost a simultaneous race (two tabs submitting at the same instant). Defer to the
            // winner's claim instead of clobbering it.
            String winner = redis.opsForValue().get(claimKey);
            if (winner != null && !winner.equals(queueKey)) {
                throw queuedElsewhere(winner);
            }
            // A concurrent request owns this join, including any dispatch already in progress.
            // Re-inserting here could pair the same player twice.
            return QueueResponse.queued();
        }

        redis.opsForZSet().add(queueKey, username, elo);

        return QueueResponse.queued();
    }

    /**
     * Player leaves the queue.
     *
     * Rejects if player is already in a game.
     */
    public void leaveQueue(String username, String timeControl, boolean anonymous) {
        // Check if already in a game
        String playerGameJson = redis.opsForValue().get("player:" + username + ":game");

        if (playerGameJson != null) {
            try {
                // Try to parse JSON — if valid, player is in an active game
                JsonNode node = mapper.readTree(playerGameJson);
                if (node.has("gameId")) {
                    // The player is past the queue; drop any leftover claim so it cannot block a
                    // future search if the game key outlives its TTL expectations.
                    redis.delete(queueClaimKey(username));
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Already in a game");
                }
            } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
                // Not JSON — stale entry, clean it up
                redis.delete("player:" + username + ":game");
            }
        }

        // Remove from the queue and release the membership claim. If the claim belongs to a
        // different queue, this call came from a stale tab (e.g. a `beforeunload` fired by an
        // already-superseded queue page). Leave the player's current search untouched.
        String queueKey = queueKey(timeControl, anonymous);
        String claimKey = queueClaimKey(username);
        String claimedQueue = redis.opsForValue().get(claimKey);

        if (claimedQueue != null && !claimedQueue.equals(queueKey)) {
            log.warn("Ignoring stale dequeue for {}: claim is {}, request was {}", username, claimedQueue, queueKey);
            return;
        }

        redis.opsForZSet().remove(queueKey, username);
        redis.delete(claimKey);
    }

    private String queueKey(String timeControl, boolean anonymous) {
        return (anonymous ? QUEUE_KEY_PREFIX + "anon:" : QUEUE_KEY_PREFIX) + timeControl;
    }

    private String queueClaimKey(String username) {
        return PLAYER_QUEUE_KEY_PREFIX + username + PLAYER_QUEUE_KEY_SUFFIX;
    }

    /** True while the player still has a ZSET entry, i.e. the pairing loop has not taken them. */
    private boolean isStillWaiting(String username, String queueKey) {
        return redis.opsForZSet().score(queueKey, username) != null;
    }

    private ResponseStatusException queuedElsewhere(String claimedQueue) {
        return new ResponseStatusException(HttpStatus.CONFLICT,
                "Already searching in the " + timeControlOf(claimedQueue)
                        + " queue. Cancel that search before joining another.");
    }

    /** Extracts the time control from a queue key: {@code queue:anon:3+0} -> {@code 3+0}. */
    private String timeControlOf(String queueKey) {
        String anonPrefix = QUEUE_KEY_PREFIX + "anon:";
        if (queueKey.startsWith(anonPrefix)) {
            return queueKey.substring(anonPrefix.length());
        }
        return queueKey.startsWith(QUEUE_KEY_PREFIX)
                ? queueKey.substring(QUEUE_KEY_PREFIX.length())
                : queueKey;
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
            matchInQueue(timeControl, false);
            matchInQueue(timeControl, true);
        }
    }

    private void matchInQueue(String timeControl, boolean anonymous) {
        String queueKey = queueKey(timeControl, anonymous);

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
                Long r1 = redis.opsForZSet().remove(queueKey, p1.username);
                Long r2 = redis.opsForZSet().remove(queueKey, p2.username);
                
                if (r1 != null && r1 == 1 && r2 != null && r2 == 1) {
                    publishMatchRequest(p1.username, p2.username, timeControl, anonymous);
                    i++; // Skip next player (already paired)
                } else {
                    if (r1 != null && r1 == 1) {
                        redis.opsForZSet().add(queueKey, p1.username, p1.elo);
                    }
                    if (r2 != null && r2 == 1) {
                        redis.opsForZSet().add(queueKey, p2.username, p2.elo);
                    }
                    log.debug("Failed to pair {} and {} (one or both already left queue)", p1.username, p2.username);
                }
            }
        }
    }

    private void publishMatchRequest(String p1Username, String p2Username, String timeControl, boolean anonymous) {
        String partitionKey = createPartitionKey(p1Username, p2Username);

        // Publish match request (game-service will create gameId and assign colors)
        MatchRequest request = new MatchRequest(p1Username, p2Username, timeControl, anonymous);

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
