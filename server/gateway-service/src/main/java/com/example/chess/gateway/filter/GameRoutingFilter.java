package com.example.chess.gateway.filter;

import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.cloud.gateway.support.ServerWebExchangeUtils;
import org.springframework.cloud.gateway.filter.OrderedGatewayFilter;
import org.springframework.http.server.reactive.ServerHttpRequest;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;

@Component
public class GameRoutingFilter extends AbstractGatewayFilterFactory<GameRoutingFilter.Config> {

    private static final Logger logger = LoggerFactory.getLogger(GameRoutingFilter.class);
    private final ReactiveStringRedisTemplate redis;
    private final ObjectMapper objectMapper;
    private static final Pattern GAME_ID_PATTERN = Pattern.compile("/ws/game/([a-zA-Z0-9-]+)");

    public GameRoutingFilter(ReactiveStringRedisTemplate redis) {
        super(Config.class);
        this.redis = redis;
        this.objectMapper = new ObjectMapper();
    }

    @Override
    public GatewayFilter apply(Config config) {
        GatewayFilter filter = (exchange, chain) -> {
            ServerHttpRequest request = exchange.getRequest();
            String path = request.getURI().getPath();
            Matcher matcher = GAME_ID_PATTERN.matcher(path);

            if (matcher.find()) {
                String gameId = matcher.group(1);
                String username = request.getHeaders().getFirst("X-Username");

                if (username == null) {
                    logger.warn("GameRoutingFilter: no X-Username found for gameId={}, using load balancer", gameId);
                    return chain.filter(exchange);
                }

                String playerKey = "player:" + username + ":game";

                return redis.opsForValue().get(playerKey)
                        .flatMap(playerJson -> {
                            try {
                                JsonNode node = objectMapper.readTree(playerJson);
                                String instanceUriStr = node.path("instanceUri").asText(null);
                                
                                if (instanceUriStr == null || instanceUriStr.isBlank()) {
                                    logger.warn("GameRoutingFilter: instanceUri missing in JSON for user={}, using load balancer", username);
                                    return chain.filter(exchange);
                                }
                                
                                URI originalUri = request.getURI();
                                URI routeUri = new URI(instanceUriStr);
                                URI mergedUri = new URI(routeUri.getScheme(), null, routeUri.getHost(), routeUri.getPort(), originalUri.getPath(), originalUri.getQuery(), originalUri.getFragment());
                                logger.info("GameRoutingFilter: sticky routing user={} gameId={} to {}", username, gameId, mergedUri);
                                exchange.getAttributes().put(ServerWebExchangeUtils.GATEWAY_REQUEST_URL_ATTR, mergedUri);
                                exchange.getAttributes().remove(ServerWebExchangeUtils.GATEWAY_SCHEME_PREFIX_ATTR);
                            } catch (Exception e) {
                                logger.error("Invalid instance JSON from Redis for user={}: {}", username, playerJson, e);
                            }
                            return chain.filter(exchange);
                        })
                        .switchIfEmpty(Mono.defer(() -> {
                            logger.info("GameRoutingFilter: player key not found for user={} gameId={}, using load balancer", username, gameId);
                            return chain.filter(exchange);
                        }));
            }

            logger.info("GameRoutingFilter: no gameId matched in path, using load balancer");
            return chain.filter(exchange);
        };
        
        return new OrderedGatewayFilter(filter, 10149);
    }

    public static class Config {}
}
