package com.example.chess.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record GoogleAuthRequest(
    @NotBlank String token
) {}
