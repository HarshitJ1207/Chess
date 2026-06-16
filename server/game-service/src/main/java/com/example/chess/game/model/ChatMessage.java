package com.example.chess.game.model;

/** An in-memory chat line. Echoed live; never written to a DB during play. */
public record ChatMessage(String fromUsername, String fromColor, String text) {}
