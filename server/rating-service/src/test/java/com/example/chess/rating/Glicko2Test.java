package com.example.chess.rating;

import com.example.chess.rating.glicko.Glicko2;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class Glicko2Test {

    private final Glicko2 glicko = new Glicko2();

    @Test
    void winRaisesRatingAndShrinksDeviation() {
        Glicko2.Result r = glicko.compute(1500, 350, 0.06, 1500, 350, 1.0);
        assertTrue(r.rating() > 1500, "a win should raise rating");
        assertTrue(r.ratingDeviation() < 350, "any game should reduce uncertainty");
    }

    @Test
    void lossLowersRating() {
        Glicko2.Result r = glicko.compute(1500, 350, 0.06, 1500, 350, 0.0);
        assertTrue(r.rating() < 1500, "a loss should lower rating");
    }

    @Test
    void drawBetweenEqualsBarelyMovesRating() {
        Glicko2.Result r = glicko.compute(1500, 200, 0.06, 1500, 200, 0.5);
        assertEquals(1500.0, r.rating(), 1.0, "a draw between equals stays ~1500");
    }

    @Test
    void beatingMuchStrongerOpponentGainsMoreThanBeatingWeaker() {
        double vsStrong = glicko.compute(1500, 200, 0.06, 1900, 100, 1.0).rating();
        double vsWeak = glicko.compute(1500, 200, 0.06, 1100, 100, 1.0).rating();
        assertTrue(vsStrong > vsWeak, "upsets should be rewarded more");
    }
}
