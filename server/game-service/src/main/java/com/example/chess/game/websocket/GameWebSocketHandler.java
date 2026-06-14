package com.example.chess.game.websocket;

import com.example.chess.game.model.GameState;
import com.example.chess.game.service.GameManager;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/**
 * The multiplexed game socket at {@code /ws/game/{gameId}}. A single connection carries
 * moves, chat, draw offers and resignations, discriminated by the {@code t} envelope field.
 *
 * <p>Move handling follows the 3-way handshake: the client sends intent, we immediately
 * ACK (suppressing its spinner), then {@link GameManager} runs authoritative validation and
 * broadcasts the result.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class GameWebSocketHandler extends TextWebSocketHandler {

    private final GameManager gameManager;
    private final GameSessionRegistry registry;
    private final GameMessages messages;
    private final ObjectMapper mapper;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String gameId = (String) session.getAttributes().get("gameId");
        String playerId = (String) session.getAttributes().get("playerId");

        GameState game = gameManager.get(gameId);
        if (game == null) {
            registry.sendQuietly(session, messages.error("GAME_NOT_READY", "Game not yet active; retry shortly"));
            session.close(CloseStatus.NOT_ACCEPTABLE);
            return;
        }
        if (!game.isParticipant(playerId)) {
            registry.sendQuietly(session, messages.error("NOT_PARTICIPANT", "You are not in this game"));
            session.close(CloseStatus.NOT_ACCEPTABLE);
            return;
        }

        registry.add(gameId, session);
        registry.sendQuietly(session, messages.init(game, game.colorOf(playerId), System.currentTimeMillis()));
        log.debug("Player {} connected to game {}", playerId, gameId);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        String gameId = (String) session.getAttributes().get("gameId");
        String playerId = (String) session.getAttributes().get("playerId");

        JsonNode root;
        try {
            root = mapper.readTree(message.getPayload());
        } catch (Exception e) {
            registry.sendQuietly(session, messages.error("BAD_JSON", "Unparseable frame"));
            return;
        }

        String type = root.path("t").asText("");
        JsonNode d = root.path("d");
        switch (type) {
            case "move" -> {
                String uci = firstNonEmpty(d.path("u").asText(""), d.path("uci").asText(""));
                int action = d.path("a").asInt(d.path("action").asInt(0));
                // Handshake step 2: immediate ACK before validation.
                registry.sendQuietly(session, messages.ack(action));
                gameManager.applyMove(gameId, playerId, session, uci);
            }
            case "chat" -> {
                String text = firstNonEmpty(d.path("msg").asText(""), d.path("text").asText(""));
                gameManager.chat(gameId, playerId, text);
            }
            case "draw" -> gameManager.handleDraw(gameId, playerId, d.path("action").asText(""));
            case "resign" -> gameManager.resign(gameId, playerId);
            case "abort" -> gameManager.abort(gameId, playerId, session);
            default -> registry.sendQuietly(session, messages.error("UNKNOWN_TYPE", "Unknown message type: " + type));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String gameId = (String) session.getAttributes().get("gameId");
        if (gameId != null) {
            registry.remove(gameId, session);
        }
    }

    private static String firstNonEmpty(String a, String b) {
        return a != null && !a.isEmpty() ? a : b;
    }
}
