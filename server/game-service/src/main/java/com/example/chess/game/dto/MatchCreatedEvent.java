package com.example.chess.game.dto;

import java.util.UUID;

/**
 * Consumed from the {@code match-created} topic. Mirrors the record matchmaking-service
 * produces — services share the shape by contract, not by a shared library (DB/event
 * isolation rule). Type headers are disabled on the producer, so Jackson binds by field.
 */
public record MatchCreatedEvent(
        UUID gameId,
        String whitePlayerId,
        String blackPlayerId,
        String timeControl,
        String gameServiceUri
) {}
