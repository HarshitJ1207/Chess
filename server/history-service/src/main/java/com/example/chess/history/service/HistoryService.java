package com.example.chess.history.service;

import com.example.chess.history.dto.GameConcludedEvent;
import com.example.chess.history.entity.ArchivedGame;
import com.example.chess.history.repository.ArchivedGameRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class HistoryService {

    private final ArchivedGameRepository repository;
    private final PgnBuilder pgnBuilder;

    /**
     * Archive a concluded game. The gameId is the primary key, so a redelivered event
     * (Kafka is at-least-once) is a no-op rather than a duplicate row.
     */
    @Transactional
    public void archive(GameConcludedEvent event) {
        if (repository.existsById(event.gameId())) {
            log.debug("Game {} already archived; skipping duplicate", event.gameId());
            return;
        }
        PgnBuilder.Reconstruction r = pgnBuilder.build(event);

        ArchivedGame game = new ArchivedGame();
        game.setGameId(event.gameId());
        game.setWhitePlayerId(event.whitePlayerId());
        game.setBlackPlayerId(event.blackPlayerId());
        game.setResult(event.result());
        game.setTermination(event.termination());
        game.setMoves(r.telemetry());
        game.setPgn(r.pgn());

        repository.save(game);
        log.info("Archived game {} ({} half-moves, {})",
                event.gameId(), r.telemetry().size(), event.result());
    }

    @Transactional(readOnly = true)
    public Page<ArchivedGame> gamesForPlayer(String playerId, Pageable pageable) {
        return repository.findByWhitePlayerIdOrBlackPlayerIdOrderByPlayedAtDesc(playerId, playerId, pageable);
    }

    @Transactional(readOnly = true)
    public ArchivedGame getGame(String gameId) {
        return repository.findById(gameId).orElse(null);
    }
}
