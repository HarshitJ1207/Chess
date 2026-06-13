package com.example.chess.game.dto;

/**
 * Authoritative clock balances broadcast on each state mutation.
 *
 * @param white seconds remaining for white
 * @param black seconds remaining for black
 * @param lag   milliseconds refunded to the mover for network latency before these
 *              balances were compiled (hard-capped at 400ms)
 */
public record ClockSnapshot(double white, double black, long lag) {}
