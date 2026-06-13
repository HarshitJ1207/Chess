package com.example.chess.game.websocket;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tracks the live WebSocket sessions per game so the game loop can broadcast
 * authoritative state to both players. A game may briefly hold more than one session
 * per player during a reconnect, so we key by game and fan out to every session.
 */
@Component
public class GameSessionRegistry {

    private final ConcurrentHashMap<String, Set<WebSocketSession>> byGame = new ConcurrentHashMap<>();

    public void add(String gameId, WebSocketSession session) {
        byGame.computeIfAbsent(gameId, g -> ConcurrentHashMap.newKeySet()).add(session);
    }

    public void remove(String gameId, WebSocketSession session) {
        Set<WebSocketSession> sessions = byGame.get(gameId);
        if (sessions != null) {
            sessions.remove(session);
            if (sessions.isEmpty()) {
                byGame.remove(gameId);
            }
        }
    }

    public Set<WebSocketSession> sessions(String gameId) {
        return byGame.getOrDefault(gameId, Set.of());
    }

    /** Every open session across all games — used by the periodic Ping sweep. */
    public Iterable<WebSocketSession> allSessions() {
        return byGame.values().stream().flatMap(Set::stream).toList();
    }

    /** Send one text payload to every session of a game; drops sessions that error out. */
    public void broadcast(String gameId, org.springframework.web.socket.TextMessage message) {
        for (WebSocketSession session : sessions(gameId)) {
            sendQuietly(session, message);
        }
    }

    public void sendQuietly(WebSocketSession session, org.springframework.web.socket.TextMessage message) {
        try {
            if (session.isOpen()) {
                session.sendMessage(message);
            }
        } catch (IOException ignored) {
            // A broken pipe just means the client vanished; afterConnectionClosed cleans up.
        }
    }
}
