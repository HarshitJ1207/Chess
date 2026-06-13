package com.example.chess.gateway.filter;

import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Component
public class GameRoutingFilter extends AbstractGatewayFilterFactory<GameRoutingFilter.Config> {

    private static final Logger logger = LoggerFactory.getLogger(GameRoutingFilter.class);
    private final ReactiveStringRedisTemplate redis;

    public GameRoutingFilter(ReactiveStringRedisTemplate redis) {
        super(Config.class);
        this.redis = redis;
    }

    @Override
    public GatewayFilter apply(Config config) {
        return (exchange, chain) -> {
            // TODO: Implement Redis lookup for game-service instance pinning
            // For now, use load balancer (falls back to round-robin across instances)
            // When fixed: extract gameId from path, look up game:{gameId}:instance in Redis,
            // rewrite URI to point to that specific instance
            logger.info("GameRoutingFilter: using load balancer (affinity not yet implemented)");
            return chain.filter(exchange);
        };
    }

    public static class Config {}
}
