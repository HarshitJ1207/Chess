package com.example.chess.game.config;

import com.example.chess.game.websocket.GameWebSocketHandler;
import com.example.chess.game.websocket.JwtHandshakeInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * Registers the single multiplexed game endpoint. The {@code *} matches one path segment
 * (the gameId), which the {@link JwtHandshakeInterceptor} extracts during the upgrade.
 */
@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {

    private final GameWebSocketHandler gameWebSocketHandler;
    private final JwtHandshakeInterceptor jwtHandshakeInterceptor;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(gameWebSocketHandler, "/ws/game/*")
                .addInterceptors(jwtHandshakeInterceptor)
                .setAllowedOriginPatterns("*"); // gateway (Nginx) fronts this in prod
    }
}
