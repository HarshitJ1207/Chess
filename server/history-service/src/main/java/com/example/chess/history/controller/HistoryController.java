package com.example.chess.history.controller;

import com.example.chess.history.entity.ArchivedGame;
import com.example.chess.history.service.HistoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/history")
@RequiredArgsConstructor
public class HistoryController {

    private static final int MAX_PAGE_SIZE = 50;

    private final HistoryService historyService;

    /** Paginated game archive for a player (as either color), newest first. */
    @GetMapping("/player/{playerId}")
    public PagedGames byPlayer(@PathVariable String playerId,
                               @RequestParam(defaultValue = "0") int page,
                               @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(Math.max(0, page), clampSize(size));
        Page<ArchivedGame> result = historyService.gamesForPlayer(playerId, pageable);
        return new PagedGames(
                result.getContent(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages());
    }

    private int clampSize(int size) {
        if (size < 1) return 1;
        return Math.min(size, MAX_PAGE_SIZE);
    }

    /** Stable pagination envelope (avoids serializing Spring's PageImpl directly). */
    public record PagedGames(
            List<ArchivedGame> content,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {}
}
