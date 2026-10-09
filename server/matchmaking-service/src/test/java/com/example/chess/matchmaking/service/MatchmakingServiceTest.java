package com.example.chess.matchmaking.service;

import com.example.chess.matchmaking.client.RatingClient;
import com.example.chess.matchmaking.dto.MatchRequest;
import com.example.chess.matchmaking.dto.QueueRequest;
import com.example.chess.matchmaking.dto.QueueResponse;
import com.example.chess.matchmaking.dto.RatingResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MatchmakingServiceTest {

    private StringRedisTemplate redis;
    private ValueOperations<String, String> valueOps;
    private ZSetOperations<String, String> zsetOps;
    private KafkaTemplate<String, MatchRequest> kafkaTemplate;
    private RatingClient ratingClient;
    private MatchmakingService service;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        redis = mock(StringRedisTemplate.class);
        valueOps = mock(ValueOperations.class);
        zsetOps = mock(ZSetOperations.class);
        kafkaTemplate = mock(KafkaTemplate.class);
        ratingClient = mock(RatingClient.class);
        service = new MatchmakingService(redis, kafkaTemplate, ratingClient);

        when(redis.opsForValue()).thenReturn(valueOps);
        when(redis.opsForZSet()).thenReturn(zsetOps);

        // A fresh joiner has no queue-membership claim yet; SETNX then succeeds.
        lenient().when(valueOps.setIfAbsent(anyString(), anyString(), any(java.time.Duration.class))).thenReturn(true);

        // The @Value default is 200; set it explicitly since we construct the bean manually.
        org.springframework.test.util.ReflectionTestUtils.setField(service, "eloRange", 200);
    }

    @Test
    void joinQueueAddsRegisteredPlayerWithFetchedRating() {
        when(valueOps.get("player:alice:game")).thenReturn(null);
        when(ratingClient.getRating("alice")).thenReturn(new RatingResponse("alice", 1650.0, 100, 0.06, 12));

        QueueResponse resp = service.joinQueue("alice", new QueueRequest("5+0"), false);

        assertEquals(QueueResponse.Status.QUEUED, resp.status());
        verify(zsetOps).add("queue:5+0", "alice", 1650.0);
    }

    @Test
    void joinQueueDefaultsAnonymousPlayerTo1500WithoutRatingLookup() {
        when(valueOps.get("player:anon-1:game")).thenReturn(null);

        QueueResponse resp = service.joinQueue("anon-1", new QueueRequest("3+0"), true);

        assertEquals(QueueResponse.Status.QUEUED, resp.status());
        verify(zsetOps).add("queue:anon:3+0", "anon-1", 1500.0);
        verify(ratingClient, never()).getRating(anyString());
    }

    @Test
    void joinQueueFallsBackTo1500WhenRatingUnavailable() {
        when(valueOps.get("player:alice:game")).thenReturn(null);
        when(ratingClient.getRating("alice")).thenThrow(new RuntimeException("rating-service down"));

        service.joinQueue("alice", new QueueRequest("5+0"), false);

        verify(zsetOps).add("queue:5+0", "alice", 1500.0);
    }

    @Test
    void joinQueueReturnsMatchedWhenPlayerAlreadyInGame() {
        String gameJson = "{\"gameId\":\"00000000-0000-0000-0000-000000000001\",\"myColor\":\"white\",\"opponentUsername\":\"bob\"}";
        when(valueOps.get("player:alice:game")).thenReturn(gameJson);

        QueueResponse resp = service.joinQueue("alice", new QueueRequest("5+0"), false);

        assertEquals(QueueResponse.Status.MATCHED, resp.status());
        assertEquals("white", resp.color());
        assertEquals("bob", resp.opponentUsername());
        verify(zsetOps, never()).add(anyString(), anyString(), anyDouble());
    }

    @Test
    void joinQueueCleansUpStaleMalformedEntry() {
        when(valueOps.get("player:alice:game")).thenReturn("not-json");

        service.joinQueue("alice", new QueueRequest("5+0"), false);

        verify(redis).delete("player:alice:game");
        verify(zsetOps).add("queue:5+0", "alice", 1500.0);
    }

    @Test
    void joinQueueRejectsSecondQueueWhileAlreadySearching() {
        when(valueOps.get("player:alice:game")).thenReturn(null);
        when(valueOps.get("player:alice:queue")).thenReturn("queue:3+0");
        when(zsetOps.score("queue:3+0", "alice")).thenReturn(1500.0);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                service.joinQueue("alice", new QueueRequest("5+0"), false));

        assertEquals(409, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("3+0"));
        verify(zsetOps, never()).add(anyString(), anyString(), anyDouble());
    }

    @Test
    void joinQueueTreatsSameQueueAsIdempotentPollWithoutReAdding() {
        when(valueOps.get("player:alice:game")).thenReturn(null);
        when(valueOps.get("player:alice:queue")).thenReturn("queue:5+0");
        when(zsetOps.score("queue:5+0", "alice")).thenReturn(1500.0);

        QueueResponse resp = service.joinQueue("alice", new QueueRequest("5+0"), false);

        assertEquals(QueueResponse.Status.QUEUED, resp.status());
        // Re-adding after the pairing loop removed the player would allow a duplicate match.
        verify(zsetOps, never()).add(anyString(), anyString(), anyDouble());
        verify(redis).expire("player:alice:queue", java.time.Duration.ofMinutes(2));
    }

    @Test
    void joinQueueDoesNotReAddPlayerAlreadyTakenByPairingLoop() {
        // The pairing loop has ZREM'd this player to dispatch them to game-service, but the game
        // key is not written yet. Re-adding here would let them be matched a second time, so the
        // claim is left to expire rather than refreshed.
        when(valueOps.get("player:alice:game")).thenReturn(null);
        when(valueOps.get("player:alice:queue")).thenReturn("queue:5+0");
        when(zsetOps.score("queue:5+0", "alice")).thenReturn(null);

        QueueResponse resp = service.joinQueue("alice", new QueueRequest("5+0"), false);

        assertEquals(QueueResponse.Status.QUEUED, resp.status());
        verify(zsetOps, never()).add(anyString(), anyString(), anyDouble());
        verify(redis, never()).expire(anyString(), any(java.time.Duration.class));
    }

    @Test
    void joinQueueRejectsWhenLosingSimultaneousRaceForAnotherQueue() {
        when(valueOps.get("player:alice:game")).thenReturn(null);
        when(valueOps.get("player:alice:queue"))
                .thenReturn(null)              // first read: no claim
                .thenReturn("queue:3+0");      // read after losing SETNX: winner's claim
        when(zsetOps.score("queue:3+0", "alice")).thenReturn(1500.0);
        when(valueOps.setIfAbsent(eq("player:alice:queue"), anyString(), any(java.time.Duration.class)))
                .thenReturn(false);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                service.joinQueue("alice", new QueueRequest("5+0"), false));

        assertEquals(409, ex.getStatusCode().value());
        verify(zsetOps, never()).add(anyString(), anyString(), anyDouble());
    }

    @Test
    void joinQueueAllowsJoinAfterClaimExpires() {
        when(valueOps.get("player:alice:game")).thenReturn(null);
        when(valueOps.get("player:alice:queue")).thenReturn(null);

        service.joinQueue("alice", new QueueRequest("5+0"), false);

        verify(valueOps).setIfAbsent(eq("player:alice:queue"), eq("queue:5+0"), any(java.time.Duration.class));
        verify(zsetOps).add("queue:5+0", "alice", 1500.0);
    }

    @Test
    void joinQueueDoesNotReAddAfterLosingRaceForSameQueue() {
        when(valueOps.get("player:alice:queue"))
                .thenReturn(null)
                .thenReturn("queue:5+0");
        when(valueOps.setIfAbsent(eq("player:alice:queue"), anyString(), any(java.time.Duration.class)))
                .thenReturn(false);

        QueueResponse response = service.joinQueue("alice", new QueueRequest("5+0"), false);

        assertEquals(QueueResponse.Status.QUEUED, response.status());
        verify(zsetOps, never()).add(anyString(), anyString(), anyDouble());
    }

    @Test
    void joinQueueClaimsQueueWithMemberAndTtl() {
        when(valueOps.get("player:alice:game")).thenReturn(null);
        when(valueOps.get("player:alice:queue")).thenReturn(null);
        when(ratingClient.getRating("alice")).thenReturn(new RatingResponse("alice", 1650.0, 100, 0.06, 12));

        service.joinQueue("alice", new QueueRequest("5+0"), false);

        verify(valueOps).setIfAbsent(eq("player:alice:queue"), eq("queue:5+0"), any(java.time.Duration.class));
        verify(zsetOps).add("queue:5+0", "alice", 1650.0);
    }

    @Test
    void joinQueueReleasesClaimWhenAlreadyMatched() {
        String gameJson = "{\"gameId\":\"00000000-0000-0000-0000-000000000001\",\"myColor\":\"white\",\"opponentUsername\":\"bob\"}";
        when(valueOps.get("player:alice:game")).thenReturn(gameJson);

        service.joinQueue("alice", new QueueRequest("5+0"), false);

        verify(redis).delete("player:alice:queue");
    }

    @Test
    void leaveQueueIgnoresStaleTabForDifferentQueue() {
        when(valueOps.get("player:alice:game")).thenReturn(null);
        when(valueOps.get("player:alice:queue")).thenReturn("queue:3+0");

        service.leaveQueue("alice", "5+0", false);

        // The 3+0 search must survive: only the queue the claim points at may be left.
        verify(zsetOps, never()).remove(anyString(), anyString());
        verify(redis, never()).delete("player:alice:queue");
    }

    @Test
    void queueCleanupFailureDoesNotEraseActiveGameClaim() {
        when(valueOps.get("player:alice:game")).thenReturn(
                "{\"gameId\":\"00000000-0000-0000-0000-000000000001\",\"myColor\":\"white\",\"opponentUsername\":\"bob\"}");
        when(redis.delete("player:alice:queue")).thenThrow(new RuntimeException("Redis unavailable"));

        assertThrows(RuntimeException.class, () ->
                service.joinQueue("alice", new QueueRequest("5+0"), false));

        verify(redis, never()).delete("player:alice:game");
        verify(zsetOps, never()).add(anyString(), anyString(), anyDouble());
    }

    @Test
    void leaveQueueReleasesClaimForMatchingQueue() {
        when(valueOps.get("player:alice:game")).thenReturn(null);
        when(valueOps.get("player:alice:queue")).thenReturn("queue:5+0");

        service.leaveQueue("alice", "5+0", false);

        verify(zsetOps).remove("queue:5+0", "alice");
        verify(redis).delete("player:alice:queue");
    }

    @Test
    void leaveQueueRejectsWhenAlreadyInGame() {
        when(valueOps.get("player:alice:game"))
                .thenReturn("{\"gameId\":\"00000000-0000-0000-0000-000000000001\"}");

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                service.leaveQueue("alice", "5+0", false));

        assertEquals(409, ex.getStatusCode().value());
        verify(zsetOps, never()).remove(anyString(), any());
    }

    @Test
    void leaveQueueRemovesFromCorrectQueue() {
        when(valueOps.get("player:alice:game")).thenReturn(null);

        service.leaveQueue("alice", "5+0", false);

        verify(zsetOps).remove("queue:5+0", "alice");
    }

    @Test
    void leaveQueueUsesAnonymousPrefixForGuests() {
        when(valueOps.get("player:anon-1:game")).thenReturn(null);

        service.leaveQueue("anon-1", "5+0", true);

        verify(zsetOps).remove("queue:anon:5+0", "anon-1");
    }

    @Test
    void pairingPublishesMatchRequestWhenEloWithinRange() {
        Set<ZSetOperations.TypedTuple<String>> queue = new LinkedHashSet<>();
        queue.add(new org.springframework.data.redis.core.DefaultTypedTuple<>("alice", 1500.0));
        queue.add(new org.springframework.data.redis.core.DefaultTypedTuple<>("bob", 1550.0));
        when(zsetOps.rangeWithScores("queue:5+0", 0, -1)).thenReturn(queue);
        when(zsetOps.remove("queue:5+0", "alice")).thenReturn(1L);
        when(zsetOps.remove("queue:5+0", "bob")).thenReturn(1L);

        service.matchPlayers();

        verify(kafkaTemplate).send(eq("match-request"), eq("alice:bob"), any(MatchRequest.class));
    }

    @Test
    void pairingSkipsWhenEloGapTooWide() {
        Set<ZSetOperations.TypedTuple<String>> queue = new LinkedHashSet<>();
        queue.add(new org.springframework.data.redis.core.DefaultTypedTuple<>("alice", 1200.0));
        queue.add(new org.springframework.data.redis.core.DefaultTypedTuple<>("bob", 2000.0));
        when(zsetOps.rangeWithScores("queue:5+0", 0, -1)).thenReturn(queue);

        service.matchPlayers();

        verify(kafkaTemplate, never()).send(anyString(), anyString(), any(MatchRequest.class));
    }

    @Test
    void pairingDoesNothingWithFewerThanTwoPlayers() {
        when(zsetOps.rangeWithScores(anyString(), eq(0L), eq(-1L))).thenReturn(Set.of());
        service.matchPlayers();
        verify(kafkaTemplate, never()).send(anyString(), anyString(), any(MatchRequest.class));
    }
}
