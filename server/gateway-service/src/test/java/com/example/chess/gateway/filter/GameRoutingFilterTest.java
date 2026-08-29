package com.example.chess.gateway.filter;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.support.ServerWebExchangeUtils;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.data.redis.core.ReactiveValueOperations;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class GameRoutingFilterTest {

    private ReactiveStringRedisTemplate redis;
    private ReactiveValueOperations<String, String> valueOps;
    private GameRoutingFilter filter;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        redis = mock(ReactiveStringRedisTemplate.class);
        valueOps = mock(ReactiveValueOperations.class);
        when(redis.opsForValue()).thenReturn(valueOps);
        filter = new GameRoutingFilter(redis);
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
    void routesToInstanceUriFromRedisMetadata() {
        String metadata = "{\"gameId\":\"g1\",\"myColor\":\"white\",\"opponentUsername\":\"bob\",\"instanceUri\":\"ws://10.0.0.5:8083\"}";
        when(valueOps.get(anyString())).thenReturn(Mono.just(metadata));

        CaptureChain chain = new CaptureChain();
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/ws/game/g1")
                        .header("X-Username", "alice"));

        filter.apply(new GameRoutingFilter.Config()).filter(exchange, chain).block();

        URI routed = chain.captured.get().getAttribute(ServerWebExchangeUtils.GATEWAY_REQUEST_URL_ATTR);
        assertEquals("ws://10.0.0.5:8083/ws/game/g1", routed.toString());
    }

    @Test
    void fallsBackToLoadBalancerWhenRedisHasNoKey() {
        when(valueOps.get(anyString())).thenReturn(Mono.empty());

        CaptureChain chain = new CaptureChain();
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/ws/game/g1")
                        .header("X-Username", "alice"));

        filter.apply(new GameRoutingFilter.Config()).filter(exchange, chain).block();

        assertNull(chain.captured.get().getAttribute(ServerWebExchangeUtils.GATEWAY_REQUEST_URL_ATTR));
    }

    @Test
    void fallsBackToLoadBalancerWhenMetadataMissingInstanceUri() {
        when(valueOps.get(anyString())).thenReturn(Mono.just("{\"gameId\":\"g1\"}"));

        CaptureChain chain = new CaptureChain();
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/ws/game/g1")
                        .header("X-Username", "alice"));

        filter.apply(new GameRoutingFilter.Config()).filter(exchange, chain).block();

        assertNull(chain.captured.get().getAttribute(ServerWebExchangeUtils.GATEWAY_REQUEST_URL_ATTR));
    }

    @Test
    void ignoresPathsWithoutGameId() {
        CaptureChain chain = new CaptureChain();
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/health"));

        filter.apply(new GameRoutingFilter.Config()).filter(exchange, chain).block();

        assertTrue(chain.captured.get() != null);
        assertNull(chain.captured.get().getAttribute(ServerWebExchangeUtils.GATEWAY_REQUEST_URL_ATTR));
    }
}
