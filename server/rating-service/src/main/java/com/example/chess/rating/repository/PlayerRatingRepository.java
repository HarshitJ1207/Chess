package com.example.chess.rating.repository;

import com.example.chess.rating.entity.PlayerRating;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlayerRatingRepository extends JpaRepository<PlayerRating, String> {
}
