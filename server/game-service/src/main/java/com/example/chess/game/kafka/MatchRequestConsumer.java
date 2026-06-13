package com.example.chess.game.kafka;

import com.example.chess.game.dto.MatchRequest;
import com.example.chess.game.service.GameManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Bridges matchmaking → game loop. When players are paired, create the game
 * in RAM with SETNX atomic claim to prevent race conditions.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MatchRequestConsumer {

    private final GameManager gameManager;

    @KafkaListener(topics = "match-request", groupId = "game-service")
    public void onMatchRequest(MatchRequest request) {
        log.info("Received MatchRequest: {} vs {} ({})", 
            request.player1Id(), request.player2Id(), request.timeControl());
        
        gameManager.createGameFromMatchRequest(request);
    }
}
