package com.example.chess.game.dto;

/**
 * Metadata stored in Redis at {@code player:{id}:game} key.
 * Used by both game-service (write) and matchmaking-service (read).
 *
 * <p>This record is serialized to JSON via ObjectMapper and stored in Redis
 * to track which player is in which game, along with their color and opponent.
 *
 * @param gameId       UUID of the game
 * @param myColor      Player's color ("white" or "black")
 * @param opponentId   Opponent's player ID
 * @param timeControl  Time control in wire format (e.g., "10+0")
 * @param instanceUri  URI of the game-service instance hosting this game
 */
public record PlayerGameMetadata(
    String gameId,
    String myColor,
    String opponentId,
    String timeControl,
    String instanceUri
) {}
