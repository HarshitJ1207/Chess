package com.example.chess.game.model;

public enum GameStatus {
    ACTIVE,
    WHITE_WON,
    BLACK_WON,
    DRAW,
    ABORTED;

    public boolean isOver() {
        return this != ACTIVE;
    }

    /** PGN-style result tag for the concluded-game event. */
    public String resultTag() {
        return switch (this) {
            case WHITE_WON -> "1-0";
            case BLACK_WON -> "0-1";
            case DRAW -> "1/2-1/2";
            default -> "*"; // ACTIVE or ABORTED
        };
    }
}
