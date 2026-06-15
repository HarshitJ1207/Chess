package com.example.chess.game.dto;

import java.util.List;

/**
 * Produced to the {@code game-concluded} topic when a game ends for any reason
 * (checkmate, resignation, timeout, draw, abort). rating-service and history-service
 * consume this independently — the game loop never blocks on their writes.
 *
 * @param result         PGN result tag: {@code "1-0"}, {@code "0-1"}, {@code "1/2-1/2"}, or {@code "*"}.
 * @param termination    how it ended: {@code checkmate}, {@code resignation}, {@code timeout},
 *                       {@code stalemate}, {@code insufficient_material}, {@code fifty_move},
 *                       {@code threefold}, {@code draw_agreement}, {@code abort}.
 * @param moves          the full game in UCI half-moves, in order.
 */
public record GameConcludedEvent(
        String gameId,
        String whiteUsername,
        String blackUsername,
        String result,
        String termination,
        List<String> moves
) {}
