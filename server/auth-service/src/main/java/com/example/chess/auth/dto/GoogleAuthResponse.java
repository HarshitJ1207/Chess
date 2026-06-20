package com.example.chess.auth.dto;

public record GoogleAuthResponse(
    String token,
    String username,
    boolean requiresRegistration,
    String email
) {}
