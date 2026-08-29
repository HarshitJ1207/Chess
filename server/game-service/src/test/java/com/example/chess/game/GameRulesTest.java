package com.example.chess.game;

import com.example.chess.game.model.GameStatus;
import com.example.chess.game.model.TimeControl;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Pure-logic tests (no Spring context) for the clock/result rules — safe to run without
 * Redis, Kafka, or Eureka on the classpath at test time.
 */
class GameRulesTest {

    @Test
    void parsesBaseAndIncrementForm() {
        // Matchmaking emits "baseMinutes+incSeconds" (see TimeControl javadoc and client).
        TimeControl tc = TimeControl.parse("3+2");
        assertEquals(180, tc.baseSeconds());
        assertEquals(2, tc.incrementSeconds());
    }

    @Test
    void parsesNamedPresets() {
        assertEquals(300, TimeControl.parse("blitz").baseSeconds());
        assertEquals(60, TimeControl.parse("1+0").baseSeconds());
        assertEquals(300, TimeControl.parse("5+0").baseSeconds());
        assertEquals(600, TimeControl.parse("10+0").baseSeconds());
        assertEquals(900, TimeControl.parse("15+10").baseSeconds());
    }

    @Test
    void unknownTimeControlFallsBackToBlitz() {
        assertEquals(300, TimeControl.parse("nonsense").baseSeconds());
        assertEquals(300, TimeControl.parse(null).baseSeconds());
        assertEquals(300, TimeControl.parse("").baseSeconds());
    }

    @Test
    void resultTagsMatchPgnConvention() {
        assertEquals("1-0", GameStatus.WHITE_WON.resultTag());
        assertEquals("0-1", GameStatus.BLACK_WON.resultTag());
        assertEquals("1/2-1/2", GameStatus.DRAW.resultTag());
        assertEquals("*", GameStatus.ABORTED.resultTag());
        assertTrue(GameStatus.WHITE_WON.isOver());
        assertTrue(GameStatus.BLACK_WON.isOver());
        assertTrue(GameStatus.DRAW.isOver());
        assertTrue(GameStatus.ABORTED.isOver());
        assertFalse(GameStatus.ACTIVE.isOver());
    }
}
