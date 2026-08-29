package com.example.chess.rating.service;

import com.example.chess.rating.dto.GameConcludedEvent;
import com.example.chess.rating.entity.PlayerRating;
import com.example.chess.rating.glicko.Glicko2;
import com.example.chess.rating.repository.PlayerRatingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.ZSetOperations;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RatingServiceTest {

    private PlayerRatingRepository repository;
    private StringRedisTemplate redis;
    private SetOperations<String, String> setOps;
    private ZSetOperations<String, String> zsetOps;
    private ValueOperations<String, String> valueOps;
    private RatingService service;

    @BeforeEach
    void setUp() {
        repository = mock(PlayerRatingRepository.class);
        redis = mock(StringRedisTemplate.class);
        setOps = mock(SetOperations.class);
        zsetOps = mock(ZSetOperations.class);
        valueOps = mock(ValueOperations.class);
        service = new RatingService(repository, new Glicko2(), redis);

        when(redis.opsForSet()).thenReturn(setOps);
        when(redis.opsForZSet()).thenReturn(zsetOps);
        when(redis.opsForValue()).thenReturn(valueOps);
        // First rating of a gameId: SADD returns 1 (not previously present).
        when(setOps.add(anyString(), anyString())).thenReturn(1L);
    }

    private GameConcludedEvent event(String id, String result) {
        return new GameConcludedEvent(id, "white", "black", result, "checkmate", List.of("e2e4"));
    }

    @Test
    void abortedGamesAreIgnored() {
        service.applyResult(event("g1", "*"));
        verify(repository, never()).save(any());
        verify(zsetOps, never()).add(anyString(), anyString(), anyDouble());
    }

    @Test
    void whiteWinRaisesWhiteAndLowersBlack() {
        when(repository.findById("white")).thenReturn(Optional.empty());
        when(repository.findById("black")).thenReturn(Optional.empty());

        service.applyResult(event("g1", "1-0"));

        var captor = org.mockito.ArgumentCaptor.forClass(PlayerRating.class);
        verify(repository, times(2)).save(captor.capture());
        List<PlayerRating> saved = captor.getAllValues();

        PlayerRating white = saved.stream().filter(p -> p.getUsername().equals("white")).findFirst().orElseThrow();
        PlayerRating black = saved.stream().filter(p -> p.getUsername().equals("black")).findFirst().orElseThrow();

        assertTrue(white.getRating() > 1500, "winner should gain rating");
        assertTrue(black.getRating() < 1500, "loser should lose rating");
        assertEquals(1, white.getGamesPlayed());
        assertEquals(1, black.getGamesPlayed());

        // leaderboard must reflect the new ratings
        verify(zsetOps).add("leaderboard", "white", white.getRating());
        verify(zsetOps).add("leaderboard", "black", black.getRating());
    }

    @Test
    void freshPlayersUseGlickoDefaults() {
        when(repository.findById("white")).thenReturn(Optional.empty());
        when(repository.findById("black")).thenReturn(Optional.empty());

        service.applyResult(event("g1", "1/2-1/2"));

        var captor = org.mockito.ArgumentCaptor.forClass(PlayerRating.class);
        verify(repository, times(2)).save(captor.capture());
        for (PlayerRating p : captor.getAllValues()) {
            assertEquals(1500.0, p.getRating(), 1.0, "draw between equals ~1500");
        }
    }

    @Test
    void duplicateEventIsSkippedByIdempotencyGuard() {
        when(repository.findById("white")).thenReturn(Optional.empty());
        when(repository.findById("black")).thenReturn(Optional.empty());
        // SADD returns 0 => already processed
        when(setOps.add(anyString(), anyString())).thenReturn(0L);

        service.applyResult(event("g1", "1-0"));

        verify(repository, never()).save(any());
        verify(zsetOps, never()).add(anyString(), anyString(), anyDouble());
    }
}
