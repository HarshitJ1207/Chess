package com.example.chess.game.dto;

/**
 * Authoritative clock balances broadcast on each state mutation.
 *
 * @param white seconds remaining for white
 * @param black seconds remaining for black
 */
public record ClockSnapshot(double white, double black) {}
