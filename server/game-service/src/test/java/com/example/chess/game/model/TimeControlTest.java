package com.example.chess.game.model;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TimeControlTest {

    @Test
    void parsesMinuteIncrementFormat() {
        assertEquals(new TimeControl(180, 2), TimeControl.parse("3+2"));
        assertEquals(new TimeControl(60, 0), TimeControl.parse("1+0"));
        assertEquals(new TimeControl(900, 10), TimeControl.parse("15+10"));
    }

    @Test
    void toleratesWhitespaceAndCase() {
        assertEquals(new TimeControl(300, 5), TimeControl.parse(" 5 + 5 "));
        assertEquals(new TimeControl(300, 0), TimeControl.parse("5+0"));
    }

    @Test
    void zeroBaseFallsBackToBlitz() {
        // A "0+X" time control is nonsensical; fall back to blitz.
        assertEquals(new TimeControl(300, 0), TimeControl.parse("0+5"));
    }

    @Test
    void negativeIncrementClampsToZero() {
        assertEquals(new TimeControl(300, 0), TimeControl.parse("5+-3"));
    }

    @Test
    void garbageFallsBackToBlitz() {
        assertEquals(new TimeControl(300, 0), TimeControl.parse("abc"));
        assertEquals(new TimeControl(300, 0), TimeControl.parse("5+"));
        assertEquals(new TimeControl(300, 0), TimeControl.parse("+5"));
        assertEquals(new TimeControl(300, 0), TimeControl.parse(""));
        assertEquals(new TimeControl(300, 0), TimeControl.parse(null));
    }

    @Test
    void wireRoundTripsInSeconds() {
        assertEquals("180+2", TimeControl.parse("3+2").wire());
        assertEquals("60+0", TimeControl.parse("1+0").wire());
    }

    @Test
    void blitzFallbackIsDeterministic() {
        TimeControl a = TimeControl.parse("not-a-tc");
        TimeControl b = TimeControl.parse("also-not");
        assertEquals(a, b);
        assertEquals(300, a.baseSeconds());
        assertEquals(0, a.incrementSeconds());
    }
}
