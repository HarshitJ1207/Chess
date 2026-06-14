package com.example.chess.game.model;

/**
 * A chess time control: an initial budget plus a per-move increment (both in seconds).
 * Matchmaking emits {@code timeControl} in the format {@code "base+inc"}, e.g. {@code "10+0"}.
 * Anything unparseable falls back to blitz (300+0).
 */
public record TimeControl(int baseSeconds, int incrementSeconds) {

    public static TimeControl parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return new TimeControl(300, 0);
        }
        String s = raw.trim();
        if (s.contains("+")) {
            String[] parts = s.split("\\+", 2);
            try {
                int base = Integer.parseInt(parts[0].trim());
                int inc = parts.length > 1 ? Integer.parseInt(parts[1].trim()) : 0;
                if (base > 0) {
                    return new TimeControl(base, Math.max(0, inc));
                }
            } catch (NumberFormatException ignored) {
                // fall through to fallback
            }
        }
        return new TimeControl(300, 0); // blitz fallback
    }

    public String wire() {
        return baseSeconds + "+" + incrementSeconds;
    }
}
