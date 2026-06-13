package com.example.chess.history.model;

/**
 * One archived half-move. Stored inside the {@code moves} JSONB array.
 *
 * <p>Note: the {@code game-concluded} event currently carries only UCI moves, so {@code san}
 * is reconstructed here via chesslib. Per-move clock deltas are not yet on the event — when
 * game-service starts emitting them, add the field here and the JSONB schema evolves freely.
 */
public record MoveTelemetry(int ply, String uci, String san) {}
