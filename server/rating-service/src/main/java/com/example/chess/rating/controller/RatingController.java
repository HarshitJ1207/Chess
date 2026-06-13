package com.example.chess.rating.controller;

import com.example.chess.rating.entity.PlayerRating;
import com.example.chess.rating.repository.PlayerRatingRepository;
import com.example.chess.rating.service.RatingService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Set;

/**
 * Read-only views over ratings. The authoritative store is PostgreSQL; the leaderboard is
 * served from the Redis ZSET for O(log n) top-N reads.
 */
@RestController
@RequestMapping("/api/ratings")
@RequiredArgsConstructor
public class RatingController {

    private final PlayerRatingRepository repository;
    private final StringRedisTemplate redis;

    @GetMapping("/{playerId}")
    public ResponseEntity<PlayerRating> getRating(@PathVariable String playerId) {
        return repository.findById(playerId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    public record LeaderboardEntry(String playerId, double rating) {}

    @GetMapping("/leaderboard")
    public List<LeaderboardEntry> leaderboard(@RequestParam(defaultValue = "10") int top) {
        Set<ZSetOperations.TypedTuple<String>> rows =
                redis.opsForZSet().reverseRangeWithScores(RatingService.LEADERBOARD_KEY, 0, Math.max(0, top - 1));
        if (rows == null) {
            return List.of();
        }
        return rows.stream()
                .map(t -> new LeaderboardEntry(t.getValue(), t.getScore() == null ? 0 : t.getScore()))
                .toList();
    }
}
