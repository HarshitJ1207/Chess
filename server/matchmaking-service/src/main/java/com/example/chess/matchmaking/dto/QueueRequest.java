package com.example.chess.matchmaking.dto;

import jakarta.validation.constraints.NotBlank;

public record QueueRequest(
        @NotBlank String timeControl
) {}
