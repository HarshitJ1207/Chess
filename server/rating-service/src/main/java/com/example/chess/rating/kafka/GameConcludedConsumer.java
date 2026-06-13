package com.example.chess.rating.kafka;

import com.example.chess.rating.dto.GameConcludedEvent;
import com.example.chess.rating.service.RatingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class GameConcludedConsumer {

    private final RatingService ratingService;

    @KafkaListener(topics = "game-concluded", groupId = "rating-service")
    public void onGameConcluded(GameConcludedEvent event) {
        log.info("Received GameConcludedEvent for game {} ({})", event.gameId(), event.result());
        ratingService.applyResult(event);
    }
}
