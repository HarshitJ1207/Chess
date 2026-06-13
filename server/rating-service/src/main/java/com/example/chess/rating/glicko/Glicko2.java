package com.example.chess.rating.glicko;

import org.springframework.stereotype.Component;

/**
 * Glicko-2 rating calculator (Mark Glickman's algorithm). We treat each game as its own
 * rating period — the common "online" simplification — so a result updates both players
 * immediately rather than batching a period's games.
 *
 * <p>Each player carries three values: a {@code rating}, a {@code ratingDeviation} (RD,
 * the uncertainty), and a {@code volatility} (how erratic their results are). Both players
 * must be updated from each other's <em>pre-game</em> values.
 */
@Component
public class Glicko2 {

    /** Conversion factor between the public (1500-centered) scale and the internal scale. */
    private static final double SCALE = 173.7178;
    /** System constant τ — constrains volatility change. Smaller = steadier ratings. */
    private static final double TAU = 0.5;
    private static final double EPSILON = 0.000001;

    public static final double DEFAULT_RATING = 1500.0;
    public static final double DEFAULT_RD = 350.0;
    public static final double DEFAULT_VOLATILITY = 0.06;

    /** A player's rating vector after an update. */
    public record Result(double rating, double ratingDeviation, double volatility) {}

    /**
     * Compute a player's new rating vector after one game.
     *
     * @param score 1.0 win, 0.5 draw, 0.0 loss (from this player's perspective)
     */
    public Result compute(double rating, double rd, double volatility,
                          double oppRating, double oppRd, double score) {
        // Step 2: to the Glicko-2 scale.
        double mu = (rating - DEFAULT_RATING) / SCALE;
        double phi = rd / SCALE;
        double muJ = (oppRating - DEFAULT_RATING) / SCALE;
        double phiJ = oppRd / SCALE;

        // Step 3–4: estimated variance v and the rating-change direction Δ.
        double g = g(phiJ);
        double e = e(mu, muJ, phiJ);
        double v = 1.0 / (g * g * e * (1.0 - e));
        double delta = v * g * (score - e);

        // Step 5: new volatility via Illinois (regula falsi) root finding.
        double newVolatility = newVolatility(phi, v, delta, volatility);

        // Step 6–7: pre-rating-period RD, then new RD.
        double phiStar = Math.sqrt(phi * phi + newVolatility * newVolatility);
        double newPhi = 1.0 / Math.sqrt(1.0 / (phiStar * phiStar) + 1.0 / v);

        // Step 8: new rating.
        double newMu = mu + newPhi * newPhi * g * (score - e);

        // Back to the public scale.
        return new Result(SCALE * newMu + DEFAULT_RATING, SCALE * newPhi, newVolatility);
    }

    private double g(double phi) {
        return 1.0 / Math.sqrt(1.0 + 3.0 * phi * phi / (Math.PI * Math.PI));
    }

    private double e(double mu, double muJ, double phiJ) {
        return 1.0 / (1.0 + Math.exp(-g(phiJ) * (mu - muJ)));
    }

    private double newVolatility(double phi, double v, double delta, double volatility) {
        double a = Math.log(volatility * volatility);
        double delta2 = delta * delta;
        double phi2 = phi * phi;

        double A = a;
        double B;
        if (delta2 > phi2 + v) {
            B = Math.log(delta2 - phi2 - v);
        } else {
            double k = 1;
            while (f(a - k * TAU, a, delta2, phi2, v) < 0) {
                k++;
            }
            B = a - k * TAU;
        }

        double fA = f(A, a, delta2, phi2, v);
        double fB = f(B, a, delta2, phi2, v);
        while (Math.abs(B - A) > EPSILON) {
            double C = A + (A - B) * fA / (fB - fA);
            double fC = f(C, a, delta2, phi2, v);
            if (fC * fB <= 0) {
                A = B;
                fA = fB;
            } else {
                fA = fA / 2.0;
            }
            B = C;
            fB = fC;
        }
        return Math.exp(A / 2.0);
    }

    private double f(double x, double a, double delta2, double phi2, double v) {
        double ex = Math.exp(x);
        double num = ex * (delta2 - phi2 - v - ex);
        double den = 2.0 * Math.pow(phi2 + v + ex, 2);
        return num / den - (x - a) / (TAU * TAU);
    }
}
