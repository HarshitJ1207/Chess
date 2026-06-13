package com.example.chess.game.model;

/**
 * A single applied half-move plus the clock snapshot it produced. This is the unit
 * we {@code RPUSH} to Redis after every valid move — replaying the list rebuilds both
 * the board and the clocks after a crash.
 */
public record MoveRecord(
        int ply,
        String uci,
        String san,
        String fen,
        double whiteRemaining,
        double blackRemaining
) {}
