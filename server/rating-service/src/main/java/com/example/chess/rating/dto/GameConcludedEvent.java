package com.example.chess.rating.dto;

import java.util.List;

/**
 * Consumed from {@code game-concluded}. Shape-matches the record game-service produces
 * (services share the contract, not a library). rating-service only needs the player ids
 * and result, but mirrors all fields so JSON binding doesn't trip on the {@code moves} list.
 */
public record GameConcludedEvent(
        String gameId,
        String whiteUsername,
        String blackUsername,
        String result,
        String termination,
        List<String> moves
) {}
