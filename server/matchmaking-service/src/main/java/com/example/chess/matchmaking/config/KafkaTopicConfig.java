package com.example.chess.matchmaking.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

/**
 * Declares topics this service produces to, so they exist with the right partition count
 * before any consumer needs them. Without this, Redpanda auto-creates the topic with a
 * single partition — and since Kafka assigns each partition to exactly one consumer in a
 * group, only one game-service instance would ever receive match requests no matter how
 * many are running. The auto-configured KafkaAdmin creates the topic if missing and
 * increases partitions on boot if the count here is raised (it never decreases).
 */
@Configuration
public class KafkaTopicConfig {

    public static final String MATCH_REQUEST_TOPIC = "match-request";

    private static final int PARTITIONS = 6;
    private static final int REPLICAS = 1; // single Redpanda broker in docker-compose

    @Bean
    public NewTopic matchRequestTopic() {
        return TopicBuilder.name(MATCH_REQUEST_TOPIC)
                .partitions(PARTITIONS)
                .replicas(REPLICAS)
                .build();
    }
}
