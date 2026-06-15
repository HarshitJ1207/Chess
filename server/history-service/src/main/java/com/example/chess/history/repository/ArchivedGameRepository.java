package com.example.chess.history.repository;

import com.example.chess.history.entity.ArchivedGame;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ArchivedGameRepository extends JpaRepository<ArchivedGame, String> {

    /** A player's games (as either color), newest first. */
    Page<ArchivedGame> findByWhiteUsernameOrBlackUsernameOrderByPlayedAtDesc(
            String whiteUsername, String blackUsername, Pageable pageable);
}
