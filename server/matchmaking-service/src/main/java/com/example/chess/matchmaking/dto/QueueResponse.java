package com.example.chess.matchmaking.dto;

import java.util.UUID;

public record QueueResponse(
        Status status,
        UUID gameId,
        String color,
        String opponentId
) {
    public enum Status { QUEUED, MATCHED }

    public static QueueResponse queued() {
        return new QueueResponse(Status.QUEUED, null, null, null);
    }

    public static QueueResponse matched(UUID gameId, String color, String opponentId) {
        return new QueueResponse(Status.MATCHED, gameId, color, opponentId);
    }
}
