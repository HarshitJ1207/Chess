package com.example.chess.matchmaking.dto;

/**
 * Request to create a game between two players.
 *
 * - Colors (white/black) are NOT determined yet - game-service decides via coin flip.
 * - Players are NOT ordered - could be (A, B) or (B, A), doesn't matter.
 * - Kafka partition key uses SORTED player usernames for deterministic routing.
 * - game-service creates the gameId, not matchmaking.
 */
public record MatchRequest(
        String player1Username,
        String player2Username,
        String timeControl
) {}
