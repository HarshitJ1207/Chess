package com.example.chess.rating.service;

import com.example.chess.rating.dto.GameConcludedEvent;
import com.example.chess.rating.entity.PlayerRating;
import com.example.chess.rating.glicko.Glicko2;
import com.example.chess.rating.repository.PlayerRatingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class RatingService {

    public static final String LEADERBOARD_KEY = "leaderboard";
    private static final String PROCESSED_SET = "rating:processed";

    private final PlayerRatingRepository repository;
    private final Glicko2 glicko2;
    private final StringRedisTemplate redis;

    /**
     * Apply a concluded game to both players' Glicko-2 vectors, then sync the leaderboard.
     * Aborted games (result {@code "*"}) carry no sporting outcome and are ignored.
     * Idempotent: a redelivered event (Kafka is at-least-once) is skipped via a Redis guard.
     */
    @Transactional
    public void applyResult(GameConcludedEvent event) {
        double whiteScore = scoreForWhite(event.result());
        if (whiteScore < 0) {
            log.debug("Ignoring non-scoring result {} for game {}", event.result(), event.gameId());
            return;
        }
        // Idempotency: SADD returns 0 if the gameId was already counted.
        Long added = redis.opsForSet().add(PROCESSED_SET, event.gameId());
        if (added != null && added == 0) {
            log.debug("Game {} already rated; skipping duplicate", event.gameId());
            return;
        }

        PlayerRating white = repository.findById(event.whiteUsername())
                .orElseGet(() -> PlayerRating.fresh(event.whiteUsername()));
        PlayerRating black = repository.findById(event.blackUsername())
                .orElseGet(() -> PlayerRating.fresh(event.blackUsername()));

        // Snapshot pre-game values — each player updates against the other's OLD rating.
        double wR = white.getRating(), wD = white.getRatingDeviation(), wV = white.getVolatility();
        double bR = black.getRating(), bD = black.getRatingDeviation(), bV = black.getVolatility();

        Glicko2.Result newWhite = glicko2.compute(wR, wD, wV, bR, bD, whiteScore);
        Glicko2.Result newBlack = glicko2.compute(bR, bD, bV, wR, wD, 1.0 - whiteScore);

        applyTo(white, newWhite);
        applyTo(black, newBlack);
        repository.save(white);
        repository.save(black);

        // Sync the Redis leaderboard ZSET (score = rating).
        redis.opsForZSet().add(LEADERBOARD_KEY, white.getUsername(), newWhite.rating());
        redis.opsForZSet().add(LEADERBOARD_KEY, black.getUsername(), newBlack.rating());

        log.info("Rated game {}: white {}→{} | black {}→{}", event.gameId(),
                Math.round(wR), Math.round(newWhite.rating()),
                Math.round(bR), Math.round(newBlack.rating()));
    }

    private void applyTo(PlayerRating entity, Glicko2.Result result) {
        entity.setRating(result.rating());
        entity.setRatingDeviation(result.ratingDeviation());
        entity.setVolatility(result.volatility());
        entity.setGamesPlayed(entity.getGamesPlayed() + 1);
    }

    /** White's score, or -1 for a non-scoring result (abort / unknown). */
    private double scoreForWhite(String result) {
        return switch (result == null ? "" : result) {
            case "1-0" -> 1.0;
            case "0-1" -> 0.0;
            case "1/2-1/2" -> 0.5;
            default -> -1.0;
        };
    }
}
