package com.example.chess.history.entity;

import com.example.chess.history.model.MoveTelemetry;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.List;

/**
 * An archived, completed game. The move telemetry lives in a {@code JSONB} column
 * (Hibernate serializes the list via Jackson), keeping the full sequence queryable
 * without a side table. This DB never joins to any other service's store.
 */
@Entity
@Table(name = "games")
@Getter
@Setter
@NoArgsConstructor
public class ArchivedGame {

    @Id
    @Column(name = "game_id")
    private String gameId;

    @Column(name = "white_player_id", nullable = false)
    private String whitePlayerId;

    @Column(name = "black_player_id", nullable = false)
    private String blackPlayerId;

    private String result;       // 1-0 / 0-1 / 1/2-1/2 / *
    private String termination;  // checkmate, resignation, timeout, ...

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<MoveTelemetry> moves;

    @Column(columnDefinition = "text")
    private String pgn;

    @CreationTimestamp
    @Column(name = "played_at", updatable = false)
    private LocalDateTime playedAt;
}
