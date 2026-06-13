package com.example.chess.matchmaking.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record QueueRequest(
        @NotBlank String timeControl,
        @Min(100) @Max(3500) int elo
) {}
