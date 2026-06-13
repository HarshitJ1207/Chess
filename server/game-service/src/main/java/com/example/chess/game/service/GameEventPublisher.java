package com.example.chess.game.service;

import com.example.chess.game.dto.GameConcludedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

/**
 * Offloads all heavy persistence (Elo, PGN archival) off the game loop by emitting a
 * single {@code GameConcludedEvent}. The send is fire-and-forget — the in-RAM game is
 * already authoritative and must never block on a downstream write.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class GameEventPublisher {

    private static final String GAME_CONCLUDED_TOPIC = "game-concluded";

    private final KafkaTemplate<String, GameConcludedEvent> kafkaTemplate;

    public void publishConcluded(GameConcludedEvent event) {
        kafkaTemplate.send(GAME_CONCLUDED_TOPIC, event.gameId(), event)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Failed to publish GameConcludedEvent for game {}", event.gameId(), ex);
                    }
                });
    }
}
