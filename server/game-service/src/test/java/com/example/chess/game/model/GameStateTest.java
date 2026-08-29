package com.example.chess.game.model;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GameStateTest {

    private GameState fresh() {
        return new GameState("g1", "alice", "bob", TimeControl.parse("5+0"), false);
    }

    @Test
    void initialClockBalancesUseBaseSeconds() {
        GameState g = fresh();
        assertEquals(300.0, g.getWhiteTimeRemaining());
        assertEquals(300.0, g.getBlackTimeRemaining());
        assertEquals(0, g.getPly());
        assertEquals(GameStatus.ACTIVE, g.getStatus());
        assertFalse(g.isAnonymous());
    }

    @Test
    void initialBoardIsStandardStartPosition() {
        GameState g = fresh();
        assertTrue(g.getBoard().getFen().startsWith("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"));
        assertEquals("white", g.activeColor());
        assertEquals("alice", g.activeUsername());
    }

    @Test
    void participantAndColorChecks() {
        GameState g = fresh();
        assertTrue(g.isParticipant("alice"));
        assertTrue(g.isParticipant("bob"));
        assertFalse(g.isParticipant("mallory"));
        assertEquals("white", g.colorOf("alice"));
        assertEquals("black", g.colorOf("bob"));
        assertNull(g.colorOf("mallory"));
        assertEquals("black", g.opponentColor("white"));
        assertEquals("white", g.opponentColor("black"));
    }

    @Test
    void effectiveRemainingSubtractsElapsedForActiveSideOnly() {
        GameState g = fresh();
        long now = 100_000L;
        g.setLastMoveTimestamp(now - 5_000); // white has been thinking 5s

        assertEquals(295.0, g.effectiveRemaining("white", now), 1e-9);
        // Black is not on move, so its balance is untouched by wall-clock.
        assertEquals(300.0, g.effectiveRemaining("black", now), 1e-9);
    }

    @Test
    void effectiveRemainingFloorsAtZero() {
        GameState g = fresh();
        long now = 100_000L;
        g.setWhiteTimeRemaining(3.0);
        g.setLastMoveTimestamp(now - 60_000);
        assertEquals(0.0, g.effectiveRemaining("white", now), 1e-9);
    }

    @Test
    void effectiveRemainingIgnoresClockWhenGameOver() {
        GameState g = fresh();
        g.setStatus(GameStatus.WHITE_WON);
        long now = 100_000L;
        g.setLastMoveTimestamp(now - 120_000);
        // A finished game must not keep bleeding time.
        assertEquals(300.0, g.effectiveRemaining("white", now), 1e-9);
    }

    @Test
    void uciListMapsHistoryInOrder() {
        GameState g = fresh();
        g.getHistory().add(new MoveRecord(1, "e2e4", "e4", "fen1", 299.0, 300.0));
        g.getHistory().add(new MoveRecord(2, "e7e5", "e5", "fen2", 299.0, 298.0));
        assertEquals(java.util.List.of("e2e4", "e7e5"), g.uciList());
    }
}
