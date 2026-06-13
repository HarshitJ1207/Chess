package com.example.chess.game.kafka;

import com.example.chess.game.dto.MatchCreatedEvent;
import com.example.chess.game.service.GameManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Bridges matchmaking → game loop. When a match is created, instantiate the game in RAM
 * so both players' subsequent WebSocket handshakes find it ready.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MatchCreatedConsumer {

    private final GameManager gameManager;

    @KafkaListener(topics = "match-created", groupId = "game-service")
    public void onMatchCreated(MatchCreatedEvent event) {
        log.info("Received MatchCreatedEvent for game {}", event.gameId());
        gameManager.createGame(event);
    }
}
