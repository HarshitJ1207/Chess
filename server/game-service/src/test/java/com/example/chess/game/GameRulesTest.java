package com.example.chess.game;

import com.example.chess.game.model.GameState;
import com.example.chess.game.model.GameStatus;
import com.example.chess.game.model.TimeControl;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Pure-logic tests (no Spring context) for the clock/result rules — safe to run without
 * Redis, Kafka, or Eureka on the classpath at test time.
 */
class GameRulesTest {

    @Test
    void parsesBaseAndIncrementForm() {
        TimeControl tc = TimeControl.parse("180+2");
        assertEquals(180, tc.baseSeconds());
        assertEquals(2, tc.incrementSeconds());
    }

    @Test
    void parsesNamedPresets() {
        assertEquals(60, TimeControl.parse("bullet").baseSeconds());
        assertEquals(300, TimeControl.parse("blitz").baseSeconds());
        assertEquals(600, TimeControl.parse("rapid").baseSeconds());
        assertEquals(1800, TimeControl.parse("classical").baseSeconds());
    }

    @Test
    void unknownTimeControlFallsBackToBlitz() {
        assertEquals(300, TimeControl.parse("nonsense").baseSeconds());
        assertEquals(300, TimeControl.parse(null).baseSeconds());
    }

    @Test
    void resultTagsMatchPgnConvention() {
        assertEquals("1-0", GameStatus.WHITE_WON.resultTag());
        assertEquals("0-1", GameStatus.BLACK_WON.resultTag());
        assertEquals("1/2-1/2", GameStatus.DRAW.resultTag());
        assertEquals("*", GameStatus.ABORTED.resultTag());
        assertTrue(GameStatus.WHITE_WON.isOver());
        assertTrue(!GameStatus.ACTIVE.isOver());
    }

    @Test
    void newGameStartsWithEqualClocksAndWhiteToMove() {
        GameState g = new GameState("g1", "wp", "bp", new TimeControl(300, 3));
        assertEquals(300.0, g.getWhiteTimeRemaining());
        assertEquals(300.0, g.getBlackTimeRemaining());
        assertEquals("white", g.activeColor());
        assertEquals("white", g.colorOf("wp"));
        assertEquals("black", g.colorOf("bp"));
        assertTrue(g.isParticipant("wp"));
        assertTrue(!g.isParticipant("someone-else"));
    }
}
