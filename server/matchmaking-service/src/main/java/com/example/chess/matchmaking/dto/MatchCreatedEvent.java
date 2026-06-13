package com.example.chess.matchmaking.dto;

import java.util.UUID;

public record MatchCreatedEvent(
        UUID gameId,
        String whitePlayerId,
        String blackPlayerId,
        String timeControl
) {}
