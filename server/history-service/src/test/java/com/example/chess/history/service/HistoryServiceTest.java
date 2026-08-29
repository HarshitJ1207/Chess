package com.example.chess.history.service;

import com.example.chess.history.dto.GameConcludedEvent;
import com.example.chess.history.entity.ArchivedGame;
import com.example.chess.history.repository.ArchivedGameRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class HistoryServiceTest {

    private ArchivedGameRepository repository;
    private HistoryService service;

    @BeforeEach
    void setUp() {
        repository = mock(ArchivedGameRepository.class);
        service = new HistoryService(repository, new PgnBuilder());
    }

    private GameConcludedEvent event(String id) {
        return new GameConcludedEvent(id, "white", "black", "1-0", "checkmate",
                List.of("e2e4", "e7e5", "f1c4", "f8c5", "d1h5", "g8f6", "h5f7"));
    }

    @Test
    void archivePersistsGameWithReconstructedTelemetryAndPgn() {
        when(repository.existsById("g1")).thenReturn(false);

        service.archive(event("g1"));

        verify(repository).save(any(ArchivedGame.class));
        var captured = org.mockito.ArgumentCaptor.forClass(ArchivedGame.class);
        verify(repository).save(captured.capture());
        ArchivedGame g = captured.getValue();
        assertEquals("g1", g.getGameId());
        assertEquals(7, g.getMoves().size());
        assertEquals("e4", g.getMoves().get(0).san());
        assertEquals("Qxf7#", g.getMoves().get(6).san());
        assertTrue(g.getPgn().contains("[Result \"1-0\"]"));
        assertTrue(g.getPgn().contains("1. e4 e5"));
    }

    @Test
    void archiveIsIdempotentForRedeliveredEvents() {
        when(repository.existsById("g1")).thenReturn(true);

        service.archive(event("g1"));

        verify(repository, never()).save(any());
    }

    @Test
    void gamesForPlayerDelegatesToRepository() {
        ArchivedGame g = new ArchivedGame();
        g.setGameId("g1");
        Page<ArchivedGame> page = new PageImpl<>(List.of(g));
        Pageable pageable = PageRequest.of(0, 20);
        when(repository.findByWhiteUsernameOrBlackUsernameOrderByPlayedAtDesc(
                "alice", "alice", pageable)).thenReturn(page);

        Page<ArchivedGame> result = service.gamesForPlayer("alice", pageable);

        assertEquals(1, result.getTotalElements());
        assertEquals("g1", result.getContent().get(0).getGameId());
    }

    @Test
    void getGameReturnsNullWhenMissing() {
        when(repository.findById("nope")).thenReturn(java.util.Optional.empty());
        assertNull(service.getGame("nope"));

        ArchivedGame g = new ArchivedGame();
        g.setGameId("g1");
        when(repository.findById("g1")).thenReturn(java.util.Optional.of(g));
        assertNotNull(service.getGame("g1"));
    }
}
