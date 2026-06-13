package com.example.chess.game.websocket;

import com.example.chess.game.model.GameState;
import com.example.chess.game.service.GameManager;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.PingMessage;
import org.springframework.web.socket.PongMessage;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.concurrent.ConcurrentHashMap;

/**
 * The multiplexed game socket at {@code /ws/game/{gameId}}. A single connection carries
 * moves, chat, draw offers and resignations, discriminated by the {@code t} envelope field.
 *
 * <p>Move handling follows the 3-way handshake: the client sends intent, we immediately
 * ACK (suppressing its spinner), then {@link GameManager} runs authoritative validation and
 * broadcasts the result. Native Ping/Pong frames — driven by {@link #pingSweep()} — measure
 * RTT independently of game payloads to feed the clock's lag compensation.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class GameWebSocketHandler extends TextWebSocketHandler {

    private final GameManager gameManager;
    private final GameSessionRegistry registry;
    private final GameMessages messages;
    private final ObjectMapper mapper;

    /** Thread-safe send wrappers, keyed by underlying session id. */
    private final ConcurrentHashMap<String, WebSocketSession> decorators = new ConcurrentHashMap<>();
    /** nanoTime at which the last Ping was sent, per session. */
    private final ConcurrentHashMap<String, Long> pingSentAt = new ConcurrentHashMap<>();
    /** Last measured one-way latency (RTT/2, ms), per session. */
    private final ConcurrentHashMap<String, Long> lagMs = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String gameId = (String) session.getAttributes().get("gameId");
        String playerId = (String) session.getAttributes().get("playerId");

        // Concurrent broadcasts + the ping sweep can hit one socket at once; serialize sends.
        WebSocketSession safe = new ConcurrentWebSocketSessionDecorator(session, 1000, 64 * 1024);
        decorators.put(session.getId(), safe);

        GameState game = gameManager.get(gameId);
        if (game == null) {
            registry.sendQuietly(safe, messages.error("GAME_NOT_READY", "Game not yet active; retry shortly"));
            safe.close(CloseStatus.NOT_ACCEPTABLE);
            return;
        }
        if (!game.isParticipant(playerId)) {
            registry.sendQuietly(safe, messages.error("NOT_PARTICIPANT", "You are not in this game"));
            safe.close(CloseStatus.NOT_ACCEPTABLE);
            return;
        }

        registry.add(gameId, safe);
        registry.sendQuietly(safe, messages.init(game, game.colorOf(playerId), System.currentTimeMillis()));
        log.debug("Player {} connected to game {}", playerId, gameId);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        String gameId = (String) session.getAttributes().get("gameId");
        String playerId = (String) session.getAttributes().get("playerId");
        WebSocketSession safe = decorators.getOrDefault(session.getId(), session);

        JsonNode root;
        try {
            root = mapper.readTree(message.getPayload());
        } catch (Exception e) {
            registry.sendQuietly(safe, messages.error("BAD_JSON", "Unparseable frame"));
            return;
        }

        String type = root.path("t").asText("");
        JsonNode d = root.path("d");
        switch (type) {
            case "move" -> {
                String uci = firstNonEmpty(d.path("u").asText(""), d.path("uci").asText(""));
                int action = d.path("a").asInt(d.path("action").asInt(0));
                // Handshake step 2: immediate ACK before validation.
                registry.sendQuietly(safe, messages.ack(action));
                long lag = lagMs.getOrDefault(session.getId(), 0L);
                gameManager.applyMove(gameId, playerId, safe, uci, lag);
            }
            case "chat" -> {
                String text = firstNonEmpty(d.path("msg").asText(""), d.path("text").asText(""));
                gameManager.chat(gameId, playerId, text);
            }
            case "draw" -> gameManager.handleDraw(gameId, playerId, d.path("action").asText(""));
            case "resign" -> gameManager.resign(gameId, playerId);
            case "abort" -> gameManager.abort(gameId, playerId, safe);
            default -> registry.sendQuietly(safe, messages.error("UNKNOWN_TYPE", "Unknown message type: " + type));
        }
    }

    @Override
    protected void handlePongMessage(WebSocketSession session, PongMessage message) {
        Long sent = pingSentAt.remove(session.getId());
        if (sent != null) {
            long rttMs = (System.nanoTime() - sent) / 1_000_000L;
            lagMs.put(session.getId(), rttMs / 2); // one-way latency
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String gameId = (String) session.getAttributes().get("gameId");
        WebSocketSession safe = decorators.remove(session.getId());
        pingSentAt.remove(session.getId());
        lagMs.remove(session.getId());
        if (gameId != null && safe != null) {
            registry.remove(gameId, safe);
        }
    }

    /**
     * Sends a native Ping to every open session every ~1.5s. The browser auto-responds
     * with a Pong (unkillable by extensions), giving us a clean RTT baseline for the clock.
     */
    @Scheduled(fixedRate = 1500)
    public void pingSweep() {
        long now = System.nanoTime();
        for (WebSocketSession session : registry.allSessions()) {
            try {
                if (session.isOpen()) {
                    pingSentAt.put(session.getId(), now);
                    session.sendMessage(new PingMessage());
                }
            } catch (Exception ignored) {
                // Broken socket; afterConnectionClosed will clean it up.
            }
        }
    }

    private static String firstNonEmpty(String a, String b) {
        return a != null && !a.isEmpty() ? a : b;
    }
}
