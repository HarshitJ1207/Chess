package com.example.chess.matchmaking.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/**
 * Surfaces {@link ResponseStatusException} reasons to the client.
 *
 * <p>Spring Boot defaults {@code server.error.include-message} to {@code never}, so without
 * this the single-queue rejection would reach the browser as a bare "Conflict" with no
 * explanation. Mirrors the shape the auth-service handler returns.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleResponseStatus(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode())
                .body(Map.of("message", ex.getReason() == null ? ex.getStatusCode().toString() : ex.getReason()));
    }
}
