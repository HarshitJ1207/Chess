package com.example.chess.game.service;

import com.example.chess.game.dto.GameConcludedEvent;
import com.example.chess.game.dto.MatchRequest;
import com.example.chess.game.model.GameState;
import com.example.chess.game.model.GameStatus;
import com.example.chess.game.websocket.GameMessages;
import com.example.chess.game.websocket.GameSessionRegistry;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.ListOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the RAM-first game loop. Redis, the timeout scheduler, Kafka publisher,
 * and the WebSocket registry are all mocked — no live infra needed. The chesslib board is
 * real, so move legality and checkmate detection are exercised end-to-end.
 */
class GameManagerTest {

    private StringRedisTemplate redis;
    private ValueOperations<String, String> valueOps;
    private HashOperations<String, Object, Object> hashOps;
    private ListOperations<String, String> listOps;
    private TimeoutScheduler timeoutScheduler;
    private GameEventPublisher publisher;
    private GameSessionRegistry registry;
    private ObjectMapper mapper;
    private GameManager manager;

    private final Set<String> preclaimed = new HashSet<>();
    private final List<String> claimKeys = new ArrayList<>();
    private final List<String> claimValues = new ArrayList<>();

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        redis = mock(StringRedisTemplate.class);
        valueOps = mock(ValueOperations.class);
        hashOps = mock(HashOperations.class);
        listOps = mock(ListOperations.class);
        timeoutScheduler = mock(TimeoutScheduler.class);
        publisher = mock(GameEventPublisher.class);
        registry = mock(GameSessionRegistry.class);
        mapper = new ObjectMapper();
        GameMessages messages = new GameMessages(mapper);

        manager = new GameManager(redis, mapper, timeoutScheduler, publisher, registry, messages);

        when(redis.opsForValue()).thenReturn(valueOps);
        when(redis.opsForHash()).thenReturn(hashOps);
        when(redis.opsForList()).thenReturn(listOps);
        when(redis.delete(anyString())).thenReturn(true);
        when(redis.expire(anyString(), any(Duration.class))).thenReturn(true);
        when(valueOps.setIfAbsent(anyString(), anyString(), any(Duration.class)))
                .thenAnswer(inv -> {
                    String key = inv.getArgument(0);
                    String value = inv.getArgument(1);
                    claimKeys.add(key);
                    claimValues.add(value);
                    return !preclaimed.contains(key);
                });
    }

    // ── helpers ──────────────────────────────────────────────────────────────────

    private String createGame(boolean anonymous) throws Exception {
        manager.createGameFromMatchRequest(new MatchRequest("alice", "bob", "5+0", anonymous));
        // White's metadata is claimed first; its JSON carries the generated gameId.
        for (String v : claimValues) {
            JsonNode node = mapper.readTree(v);
            if ("white".equals(node.path("myColor").asText())) {
                return node.path("gameId").asText();
            }
        }
        throw new AssertionError("no game created");
    }

    private static TextMessage msgContaining(String needle) {
        return argThat(t -> t != null && t.getPayload() != null && t.getPayload().contains(needle));
    }

    // ── game creation ────────────────────────────────────────────────────────────

    @Test
    void createsGameAssignsBothColorsAndArmsTimeout() throws Exception {
        String gameId = createGame(false);
        GameState g = manager.get(gameId);
        assertNotNull(g);
        assertEquals(Set.of("alice", "bob"), Set.of(g.getWhiteUsername(), g.getBlackUsername()));
        assertEquals(300.0, g.getWhiteTimeRemaining());
        assertEquals(300.0, g.getBlackTimeRemaining());
        assertEquals(GameStatus.ACTIVE, g.getStatus());
        verify(timeoutScheduler).arm(eq(gameId), eq(300.0), any(Runnable.class));
        verify(hashOps).putAll(eq("game:" + gameId + ":meta"), anyMap());
    }

    @Test
    void skipsGameWhenAPlayerIsAlreadyClaimed() {
        preclaimed.add("player:alice:game"); // blocks whichever color alice draws
        manager.createGameFromMatchRequest(new MatchRequest("alice", "bob", "5+0", false));
        verify(hashOps, never()).putAll(anyString(), anyMap());
        verify(timeoutScheduler, never()).arm(anyString(), anyDouble(), any(Runnable.class));
    }

    // ── move application ─────────────────────────────────────────────────────────

    @Test
    void legalMoveAdvancesPlyAndBroadcasts() throws Exception {
        String gameId = createGame(false);
        GameState g = manager.get(gameId);
        WebSocketSession session = mock(WebSocketSession.class);

        manager.applyMove(gameId, g.getWhiteUsername(), session, "e2e4");

        assertEquals(1, g.getPly());
        assertEquals("black", g.activeColor());
        assertEquals(1, g.uciList().size());
        verify(registry).broadcast(eq(gameId), any(TextMessage.class));
        verify(listOps).rightPush(eq("game:" + gameId + ":moves"), anyString());
    }

    @Test
    void wrongTurnIsRejected() throws Exception {
        String gameId = createGame(false);
        GameState g = manager.get(gameId);
        WebSocketSession session = mock(WebSocketSession.class);

        manager.applyMove(gameId, g.getBlackUsername(), session, "e7e5");

        assertEquals(0, g.getPly());
        verify(registry).sendQuietly(eq(session), msgContaining("NOT_YOUR_TURN"));
    }

    @Test
    void illegalMoveIsRejected() throws Exception {
        String gameId = createGame(false);
        GameState g = manager.get(gameId);
        WebSocketSession session = mock(WebSocketSession.class);

        manager.applyMove(gameId, g.getWhiteUsername(), session, "e1e2");

        assertEquals(0, g.getPly());
        verify(registry).sendQuietly(eq(session), msgContaining("ILLEGAL_MOVE"));
    }

    @Test
    void nonParticipantIsRejected() throws Exception {
        String gameId = createGame(false);
        GameState g = manager.get(gameId);
        WebSocketSession session = mock(WebSocketSession.class);

        manager.applyMove(gameId, "mallory", session, "e2e4");

        assertEquals(0, g.getPly());
        verify(registry).sendQuietly(eq(session), msgContaining("NOT_PARTICIPANT"));
    }

    @Test
    void unknownGameIsRejected() {
        WebSocketSession session = mock(WebSocketSession.class);
        manager.applyMove("missing", "alice", session, "e2e4");
        verify(registry).sendQuietly(eq(session), msgContaining("NO_GAME"));
    }

    @Test
    void scholarsMateConcludesWithCheckmateAndPublishesEvent() throws Exception {
        String gameId = createGame(false);
        GameState g = manager.get(gameId);
        String white = g.getWhiteUsername();
        String black = g.getBlackUsername();
        WebSocketSession session = mock(WebSocketSession.class);

        manager.applyMove(gameId, white, session, "e2e4");
        manager.applyMove(gameId, black, session, "e7e5");
        manager.applyMove(gameId, white, session, "f1c4");
        manager.applyMove(gameId, black, session, "b8c6");
        manager.applyMove(gameId, white, session, "d1h5");
        manager.applyMove(gameId, black, session, "g8f6");
        manager.applyMove(gameId, white, session, "h5f7");

        assertEquals(GameStatus.WHITE_WON, g.getStatus());
        assertEquals("checkmate", g.getTerminationReason());
        assertEquals(7, g.uciList().size());
        assertNull(manager.get(gameId), "concluded game must be freed from RAM");
        verify(publisher).publishConcluded(argThat(e ->
                "1-0".equals(e.result())
                        && "checkmate".equals(e.termination())
                        && e.moves().size() == 7));
    }

    // ── resignation / abort / timeout / draw ─────────────────────────────────────

    @Test
    void resignationConcludesWithWinnerAndPublishes() throws Exception {
        String gameId = createGame(false);
        GameState g = manager.get(gameId);

        manager.resign(gameId, g.getBlackUsername());

        assertEquals(GameStatus.WHITE_WON, g.getStatus());
        assertEquals("resignation", g.getTerminationReason());
        assertNull(manager.get(gameId));
        verify(publisher).publishConcluded(argThat(e ->
                "1-0".equals(e.result()) && "resignation".equals(e.termination())));
        verify(registry).broadcast(eq(gameId), any(TextMessage.class));
    }

    @Test
    void anonymousGameConcludesWithoutPublishingEvent() throws Exception {
        String gameId = createGame(true);
        GameState g = manager.get(gameId);

        manager.resign(gameId, g.getBlackUsername());

        assertEquals(GameStatus.WHITE_WON, g.getStatus());
        assertNull(manager.get(gameId));
        verify(publisher, never()).publishConcluded(any(GameConcludedEvent.class));
    }

    @Test
    void abortIsAllowedBeforeTwoPly() throws Exception {
        String gameId = createGame(false);
        GameState g = manager.get(gameId);
        WebSocketSession session = mock(WebSocketSession.class);

        manager.abort(gameId, g.getWhiteUsername(), session);

        assertEquals(GameStatus.ABORTED, g.getStatus());
        assertEquals("abort", g.getTerminationReason());
    }

    @Test
    void abortIsRejectedOnceUnderway() throws Exception {
        String gameId = createGame(false);
        GameState g = manager.get(gameId);
        WebSocketSession session = mock(WebSocketSession.class);

        // two half-moves = underway
        manager.applyMove(gameId, g.getWhiteUsername(), session, "e2e4");
        manager.applyMove(gameId, g.getBlackUsername(), session, "e7e5");
        manager.abort(gameId, g.getWhiteUsername(), session);

        assertEquals(GameStatus.ACTIVE, g.getStatus());
        verify(registry).sendQuietly(eq(session), msgContaining("CANNOT_ABORT"));
    }

    @Test
    void timeoutConcludesTheFlaggedPlayer() throws Exception {
        String gameId = createGame(false);
        GameState g = manager.get(gameId);

        // White's clock is nearly exhausted and wall-clock has long since passed.
        g.setWhiteTimeRemaining(1.0);
        g.setLastMoveTimestamp(System.currentTimeMillis() - 3000);
        manager.handleTimeout(gameId);

        assertEquals(GameStatus.BLACK_WON, g.getStatus());
        assertEquals("timeout", g.getTerminationReason());
        assertNull(manager.get(gameId));
    }

    @Test
    void drawOfferThenAcceptConcludesAsAgreement() throws Exception {
        String gameId = createGame(false);
        GameState g = manager.get(gameId);
        String white = g.getWhiteUsername();
        String black = g.getBlackUsername();

        manager.handleDraw(gameId, white, "offer");
        assertEquals(white, g.getPendingDrawOfferBy());
        verify(registry).broadcast(eq(gameId), msgContaining("\"action\":\"offer\""));

        manager.handleDraw(gameId, black, "accept");
        assertEquals(GameStatus.DRAW, g.getStatus());
        assertEquals("draw_agreement", g.getTerminationReason());
        assertNull(manager.get(gameId));
    }

    @Test
    void drawOfferCanBeDeclined() throws Exception {
        String gameId = createGame(false);
        GameState g = manager.get(gameId);
        String white = g.getWhiteUsername();
        String black = g.getBlackUsername();

        manager.handleDraw(gameId, white, "offer");
        manager.handleDraw(gameId, black, "decline");

        assertNull(g.getPendingDrawOfferBy());
        assertEquals(GameStatus.ACTIVE, g.getStatus());
        verify(registry).broadcast(eq(gameId), msgContaining("\"action\":\"declined\""));
    }

    @Test
    void moveWithdrawsPendingDrawOffer() throws Exception {
        String gameId = createGame(false);
        GameState g = manager.get(gameId);
        WebSocketSession session = mock(WebSocketSession.class);

        manager.handleDraw(gameId, g.getWhiteUsername(), "offer");
        assertNotNull(g.getPendingDrawOfferBy());
        manager.applyMove(gameId, g.getWhiteUsername(), session, "e2e4");
        assertNull(g.getPendingDrawOfferBy());
    }
}
