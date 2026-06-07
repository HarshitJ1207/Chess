package com.example.chess.auth.dto;

public record ValidateResponse(boolean valid, String userId, String username) {}
