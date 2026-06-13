package com.example.chess.history.kafka;

import com.example.chess.history.dto.GameConcludedEvent;
import com.example.chess.history.service.HistoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class GameConcludedConsumer {

    private final HistoryService historyService;

    @KafkaListener(topics = "game-concluded", groupId = "history-service")
    public void onGameConcluded(GameConcludedEvent event) {
        log.info("Received GameConcludedEvent for game {} ({} moves)",
                event.gameId(), event.moves() == null ? 0 : event.moves().size());
        historyService.archive(event);
    }
}
