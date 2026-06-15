package com.example.chess.history.dto;

import java.util.List;

/** Consumed from {@code game-concluded}. Shape-matches game-service's producer record. */
public record GameConcludedEvent(
        String gameId,
        String whiteUsername,
        String blackUsername,
        String result,
        String termination,
        List<String> moves
) {}
