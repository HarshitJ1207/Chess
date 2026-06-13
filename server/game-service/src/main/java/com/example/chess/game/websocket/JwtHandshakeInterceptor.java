package com.example.chess.game.websocket;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.net.URI;
import java.util.Map;

@Component
@Slf4j
public class JwtHandshakeInterceptor implements HandshakeInterceptor {

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        // Gateway has already validated JWT and injected X-User-ID header
        String userId = request.getHeaders().getFirst("X-User-ID");
        String username = request.getHeaders().getFirst("X-Username");

        if (userId == null) {
            log.debug("Rejecting WS handshake: missing X-User-ID header for {}", request.getURI().getPath());
            return false;
        }

        String gameId = lastPathSegment(request.getURI().getPath());
        if (gameId == null || gameId.isBlank()) {
            log.debug("Rejecting WS handshake: invalid gameId in path");
            return false;
        }

        attributes.put("playerId", userId);
        attributes.put("username", username != null ? username : "unknown");
        attributes.put("gameId", gameId);
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
        // no-op
    }

    private static String lastPathSegment(String path) {
        if (path == null) return null;
        int slash = path.lastIndexOf('/');
        return slash >= 0 && slash < path.length() - 1 ? path.substring(slash + 1) : null;
    }
}
