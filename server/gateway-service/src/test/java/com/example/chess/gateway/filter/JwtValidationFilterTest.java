package com.example.chess.gateway.filter;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class JwtValidationFilterTest {

    // Must match the Base64 secret the app ships with (auth-service application.yml).
    private static final String SECRET = "THK0uahmITVIkLbJPqp6cGXbFrjvcS4MTFLM9+ybESM=";

    private JwtValidationFilter filter;

    @BeforeEach
    void setUp() throws Exception {
        filter = new JwtValidationFilter();
        var secretField = JwtValidationFilter.class.getDeclaredField("jwtSecret");
        secretField.setAccessible(true);
        secretField.set(filter, SECRET);
    }

    private String token(String subject, boolean anonymous) {
        SecretKey key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(SECRET));
        var builder = Jwts.builder()
                .subject(subject)
                .claim("username", subject)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 60_000));
        if (anonymous) {
            builder.claim("anonymous", true);
        }
        return builder.signWith(key).compact();
    }

    private static class CaptureChain implements GatewayFilterChain {
        final AtomicReference<ServerWebExchange> captured = new AtomicReference<>();
        @Override
        public Mono<Void> filter(ServerWebExchange exchange) {
            captured.set(exchange);
            return Mono.empty();
        }
    }

    @Test
    void validTokenInjectsUsernameAndAnonymousHeaders() {
        CaptureChain chain = new CaptureChain();
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/matchmaking/queue")
                        .header("Authorization", "Bearer " + token("alice", false)));

        filter.apply(new JwtValidationFilter.Config()).filter(exchange, chain).block();

        ServerWebExchange mutated = chain.captured.get();
        assertNotNull(mutated);
        assertEquals("alice", mutated.getRequest().getHeaders().getFirst("X-Username"));
        assertEquals("false", mutated.getRequest().getHeaders().getFirst("X-Anonymous"));
    }

    @Test
    void anonymousTokenSetsAnonymousHeaderTrue() {
        CaptureChain chain = new CaptureChain();
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/matchmaking/queue")
                        .header("Authorization", "Bearer " + token("anon-123", true)));

        filter.apply(new JwtValidationFilter.Config()).filter(exchange, chain).block();

        assertEquals("true", chain.captured.get().getRequest().getHeaders().getFirst("X-Anonymous"));
    }

    @Test
    void tokenFromQueryParameterIsAccepted() {
        CaptureChain chain = new CaptureChain();
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/ws/game/g1")
                        .queryParam("token", token("alice", false)));

        filter.apply(new JwtValidationFilter.Config()).filter(exchange, chain).block();

        assertEquals("alice", chain.captured.get().getRequest().getHeaders().getFirst("X-Username"));
    }

    @Test
    void missingTokenIsRejectedWith401() {
        CaptureChain chain = new CaptureChain();
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/matchmaking/queue"));

        filter.apply(new JwtValidationFilter.Config()).filter(exchange, chain).block();

        assertEquals(HttpStatus.UNAUTHORIZED, exchange.getResponse().getStatusCode());
        assertNull(chain.captured.get(), "chain must not be invoked on auth failure");
    }

    @Test
    void tamperedTokenIsRejectedWith401() {
        CaptureChain chain = new CaptureChain();
        String tampered = token("alice", false) + "x";
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/matchmaking/queue")
                        .header("Authorization", "Bearer " + tampered));

        filter.apply(new JwtValidationFilter.Config()).filter(exchange, chain).block();

        assertEquals(HttpStatus.UNAUTHORIZED, exchange.getResponse().getStatusCode());
        assertNull(chain.captured.get());
    }
}
