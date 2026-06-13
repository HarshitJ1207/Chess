package com.example.chess.gateway.filter;

import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class GameRoutingFilter extends AbstractGatewayFilterFactory<GameRoutingFilter.Config> {

    private static final Logger logger = LoggerFactory.getLogger(GameRoutingFilter.class);
    private static final Pattern GAME_ID_PATTERN = Pattern.compile("/ws/game/([^/?]+)");

    private final ReactiveStringRedisTemplate redis;

    public GameRoutingFilter(ReactiveStringRedisTemplate redis) {
        super(Config.class);
        this.redis = redis;
    }

    @Override
    public GatewayFilter apply(Config config) {
        return (exchange, chain) -> {
            String path = exchange.getRequest().getPath().value();
            Matcher matcher = GAME_ID_PATTERN.matcher(path);

            if (!matcher.find()) {
                return chain.filter(exchange);
            }

            String gameId = matcher.group(1);
            String redisKey = "game:" + gameId + ":instance";

            // Check Redis for pinned instance
            return redis.opsForValue().get(redisKey)
                .doOnNext(uri -> logger.info("Game {} pinned to: {}", gameId, uri))
                .doOnError(e -> logger.warn("Redis error for game {}: {}", gameId, e.getMessage()))
                .onErrorResume(e -> {
                    logger.warn("Error looking up game {} in Redis, using load balancer", gameId);
                    return Mono.empty();
                })
                .flatMap(gameServiceUri -> {
                    try {
                        URI instanceUri = new URI(gameServiceUri);
                        URI newUri = new URI(
                            instanceUri.getScheme(),
                            instanceUri.getUserInfo(),
                            instanceUri.getHost(),
                            instanceUri.getPort(),
                            path,
                            exchange.getRequest().getURI().getQuery(),
                            exchange.getRequest().getURI().getFragment()
                        );

                        logger.info("Rewriting {} to {}", path, newUri);
                        return chain.filter(
                            exchange.mutate()
                                .request(exchange.getRequest().mutate().uri(newUri).build())
                                .build()
                        );
                    } catch (Exception e) {
                        logger.error("Failed to construct URI for game {}: {}", gameId, e);
                        return chain.filter(exchange);
                    }
                })
                .switchIfEmpty(
                    Mono.defer(() -> {
                        logger.warn("Game {} not pinned in Redis yet, using load balancer fallback", gameId);
                        return chain.filter(exchange);
                    })
                );
        };
    }

    public static class Config {}
}
