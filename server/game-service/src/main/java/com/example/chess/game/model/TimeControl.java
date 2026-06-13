package com.example.chess.game.model;

/**
 * A chess time control: an initial budget plus a per-move increment (both in seconds).
 *
 * <p>Matchmaking emits {@code timeControl} as an opaque string. We accept two forms:
 * <ul>
 *   <li>{@code "base+inc"} in seconds, e.g. {@code "180+2"} (3 minutes, 2s increment).</li>
 *   <li>A named preset, e.g. {@code "bullet"}, {@code "blitz"}, {@code "rapid"}, {@code "classical"}.</li>
 * </ul>
 * Anything unparseable falls back to blitz (300+0).
 */
public record TimeControl(int baseSeconds, int incrementSeconds) {

    public static TimeControl parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return preset("blitz");
        }
        String s = raw.trim().toLowerCase();
        if (s.contains("+")) {
            String[] parts = s.split("\\+", 2);
            try {
                int base = Integer.parseInt(parts[0].trim());
                int inc = Integer.parseInt(parts[1].trim());
                if (base > 0) {
                    return new TimeControl(base, Math.max(0, inc));
                }
            } catch (NumberFormatException ignored) {
                // fall through to preset handling
            }
        }
        return preset(s);
    }

    private static TimeControl preset(String name) {
        return switch (name) {
            case "bullet" -> new TimeControl(60, 0);
            case "rapid" -> new TimeControl(600, 0);
            case "classical" -> new TimeControl(1800, 0);
            default -> new TimeControl(300, 0); // blitz
        };
    }

    public String wire() {
        return baseSeconds + "+" + incrementSeconds;
    }
}
