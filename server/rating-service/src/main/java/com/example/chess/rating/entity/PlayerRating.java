package com.example.chess.rating.entity;

import com.example.chess.rating.glicko.Glicko2;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * One player's Glicko-2 vector. Keyed by the player's id (the JWT subject / auth userId),
 * carried opaquely as a string — this DB never joins to auth_db (isolation rule).
 */
@Entity
@Table(name = "player_ratings")
@Getter
@Setter
@NoArgsConstructor
public class PlayerRating {

    @Id
    @Column(name = "player_id")
    private String playerId;

    private double rating;
    private double ratingDeviation;
    private double volatility;
    private int gamesPlayed;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    /** A never-before-seen player starts at the Glicko-2 defaults (1500 / 350 / 0.06). */
    public static PlayerRating fresh(String playerId) {
        PlayerRating r = new PlayerRating();
        r.playerId = playerId;
        r.rating = Glicko2.DEFAULT_RATING;
        r.ratingDeviation = Glicko2.DEFAULT_RD;
        r.volatility = Glicko2.DEFAULT_VOLATILITY;
        r.gamesPlayed = 0;
        return r;
    }
}
