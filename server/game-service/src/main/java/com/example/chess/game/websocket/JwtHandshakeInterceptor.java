package com.example.chess.game.websocket;

import com.example.chess.shared.security.JwtUtil;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.Map;

/**
 * Authenticates the WebSocket upgrade before the socket opens. The client connects to
 * {@code /ws/game/{gameId}?token=<jwt>}; we verify the HMAC signature, then stash the
 * gameId and the token's subject (playerId) as session attributes for the handler.
 * An invalid or missing token aborts the handshake with 401-equivalent (returns false).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class JwtHandshakeInterceptor implements HandshakeInterceptor {

    private final JwtUtil jwtUtil;

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        URI uri = request.getURI();
        String token = UriComponentsBuilder.fromUri(uri).build().getQueryParams().getFirst("token");
        if (token == null || !jwtUtil.isValid(token)) {
            log.debug("Rejecting WS handshake: missing/invalid token for {}", uri.getPath());
            return false;
        }
        Claims claims = jwtUtil.parseClaims(token);

        String gameId = lastPathSegment(uri.getPath());
        if (gameId == null || gameId.isBlank()) {
            return false;
        }
        attributes.put("playerId", claims.getSubject());
        attributes.put("username", claims.get("username", String.class));
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
