package com.example.chess.history;

import com.example.chess.history.dto.GameConcludedEvent;
import com.example.chess.history.model.MoveTelemetry;
import com.example.chess.history.service.PgnBuilder;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PgnBuilderTest {

    private final PgnBuilder builder = new PgnBuilder();

    @Test
    void reconstructsSanAndPgnFromScholarsMate() {
        // 1.e4 e5 2.Bc4 Bc5 3.Qh5 Nf6?? 4.Qxf7#
        List<String> uci = List.of("e2e4", "e7e5", "f1c4", "f8c5", "d1h5", "g8f6", "h5f7");
        GameConcludedEvent event = new GameConcludedEvent(
                "g1", "white-id", "black-id", "1-0", "checkmate", uci);

        PgnBuilder.Reconstruction r = builder.build(event);

        List<MoveTelemetry> t = r.telemetry();
        assertEquals(7, t.size());
        assertEquals("e4", t.get(0).san());
        assertEquals("Bc4", t.get(2).san());
        assertEquals("Qh5", t.get(4).san());
        assertEquals("Qxf7#", t.get(6).san()); // checkmate annotation

        assertTrue(r.pgn().contains("[Result \"1-0\"]"));
        assertTrue(r.pgn().contains("1. e4 e5"));
        assertTrue(r.pgn().contains("Qxf7#"));
    }

    @Test
    void emptyGameProducesHeadersOnly() {
        GameConcludedEvent event = new GameConcludedEvent(
                "g2", "w", "b", "*", "abort", List.of());
        PgnBuilder.Reconstruction r = builder.build(event);
        assertTrue(r.telemetry().isEmpty());
        assertTrue(r.pgn().contains("[Termination \"abort\"]"));
    }
}
