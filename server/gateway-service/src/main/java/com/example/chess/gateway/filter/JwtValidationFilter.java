package com.example.chess.gateway.filter;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.crypto.SecretKey;

@Component
public class JwtValidationFilter extends AbstractGatewayFilterFactory<JwtValidationFilter.Config> {

    private static final Logger logger = LoggerFactory.getLogger(JwtValidationFilter.class);

    @Value("${jwt.secret}")
    private String jwtSecret;

    public JwtValidationFilter() {
        super(Config.class);
    }

    @Override
    public GatewayFilter apply(Config config) {
        return (exchange, chain) -> {
            String token = extractToken(exchange);

            if (token == null) {
                logger.warn("No token found in request to {}", exchange.getRequest().getPath());
                exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
                return exchange.getResponse().setComplete();
            }

            try {
                SecretKey key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(jwtSecret));
                Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

                String username = claims.getSubject();

                logger.info("Token validated for user: {}", username);

                ServerWebExchange mutated = exchange.mutate()
                    .request(r -> r
                        .header("X-Username", username)
                    )
                    .build();

                return chain.filter(mutated);
            } catch (Exception e) {
                logger.error("JWT validation failed: {}", e.getMessage(), e);
                exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
                return exchange.getResponse().setComplete();
            }
        };
    }

    private String extractToken(ServerWebExchange exchange) {
        String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }

        String queryParam = exchange.getRequest().getQueryParams().getFirst("token");
        if (queryParam != null) {
            return queryParam;
        }

        return null;
    }

    public static class Config {}
}
