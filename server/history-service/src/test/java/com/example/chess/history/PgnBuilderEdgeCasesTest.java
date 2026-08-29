package com.example.chess.history;

import com.example.chess.history.dto.GameConcludedEvent;
import com.example.chess.history.service.PgnBuilder;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PgnBuilderEdgeCasesTest {

    private final PgnBuilder builder = new PgnBuilder();

    @Test
    void stopsCleanlyAtFirstBadMove() {
        // e4 is legal; "e2" is malformed (truncated UCI), so reconstruction must stop there.
        GameConcludedEvent event = new GameConcludedEvent(
                "g1", "w", "b", "*", "abort", List.of("e2e4", "e2", "e7e5"));
        PgnBuilder.Reconstruction r = builder.build(event);
        assertEquals(1, r.telemetry().size());
        assertEquals("e4", r.telemetry().get(0).san());
        assertTrue(r.pgn().contains("1. e4 *"));
    }

    @Test
    void nullMoveListBecomesEmptyTelemetry() {
        GameConcludedEvent event = new GameConcludedEvent("g2", "w", "b", "*", "abort", null);
        PgnBuilder.Reconstruction r = builder.build(event);
        assertTrue(r.telemetry().isEmpty());
    }

    @Test
    void fullGamePgnNumbersEveryWhiteMove() {
        GameConcludedEvent event = new GameConcludedEvent(
                "g3", "w", "b", "1-0", "checkmate",
                List.of("e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6", "b5a4"));
        PgnBuilder.Reconstruction r = builder.build(event);
        assertTrue(r.pgn().contains("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4"));
        assertEquals(7, r.telemetry().size());
    }
}
