package com.example.chess.matchmaking.dto;

public record RatingResponse(
        String username,
        double rating,
        double ratingDeviation,
        double volatility,
        int gamesPlayed
) {}
