package com.example.chess.game.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

/**
 * Declares topics this service produces to. Redpanda's auto-creation default of one
 * partition would serialize all downstream consumers (rating-service, history-service
 * each form their own consumer group) behind a single thread. Events are keyed by
 * {@code gameId}, so per-game ordering holds regardless of partition count.
 */
@Configuration
public class KafkaTopicConfig {

    public static final String GAME_CONCLUDED_TOPIC = "game-concluded";

    private static final int PARTITIONS = 3;
    private static final int REPLICAS = 1; // single Redpanda broker in docker-compose

    @Bean
    public NewTopic gameConcludedTopic() {
        return TopicBuilder.name(GAME_CONCLUDED_TOPIC)
                .partitions(PARTITIONS)
                .replicas(REPLICAS)
                .build();
    }
}
