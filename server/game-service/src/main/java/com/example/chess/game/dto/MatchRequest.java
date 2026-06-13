package com.example.chess.game.dto;

/**
 * Consumed from the {@code match-request} topic. Mirrors the record matchmaking-service
 * produces — services share the shape by contract, not by a shared library (DB/event
 * isolation rule). Type headers are disabled on the producer, so Jackson binds by field.
 * 
 * - Colors (white/black) are NOT determined yet - game-service decides via coin flip.
 * - Players are NOT ordered - could be (A, B) or (B, A), doesn't matter.
 * - Kafka partition key uses SORTED player IDs for deterministic routing.
 */
public record MatchRequest(
        String player1Id,
        String player2Id,
        String timeControl
) {}
