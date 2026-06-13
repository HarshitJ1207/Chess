package com.example.chess.game.model;

import com.github.bhlangonijr.chesslib.Board;
import com.github.bhlangonijr.chesslib.Side;
import com.github.bhlangonijr.chesslib.move.MoveList;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

/**
 * The complete, authoritative state of one active game — held entirely in JVM RAM
 * (the {@link com.example.chess.game.service.GameManager}'s {@code ConcurrentHashMap}).
 * Move validation and clock math happen here in microseconds; no DB round-trip is on
 * the hot path. All mutation is performed under {@code synchronized(gameState)} by the
 * GameManager, so the fields themselves carry no locks.
 */
@Getter
public class GameState {

    private final String gameId;
    private final String whitePlayerId;
    private final String blackPlayerId;
    private final TimeControl timeControl;

    /** Live position; the source of truth for legality and end-of-game detection. */
    private final Board board = new Board();
    /** Parallel move log, used only to derive SAN for broadcasts. */
    private final MoveList moveList = new MoveList();

    private final List<MoveRecord> history = new ArrayList<>();
    private final List<ChatMessage> chat = new ArrayList<>();

    @Setter private double whiteTimeRemaining;
    @Setter private double blackTimeRemaining;
    /** Epoch millis at which the side-to-move's clock started running. */
    @Setter private long lastMoveTimestamp;
    @Setter private int ply;
    @Setter private GameStatus status = GameStatus.ACTIVE;
    @Setter private String terminationReason;
    /** playerId of whoever has an outstanding draw offer, or {@code null}. */
    @Setter private String pendingDrawOfferBy;

    public GameState(String gameId, String whitePlayerId, String blackPlayerId, TimeControl timeControl) {
        this.gameId = gameId;
        this.whitePlayerId = whitePlayerId;
        this.blackPlayerId = blackPlayerId;
        this.timeControl = timeControl;
        this.whiteTimeRemaining = timeControl.baseSeconds();
        this.blackTimeRemaining = timeControl.baseSeconds();
    }

    public boolean isParticipant(String playerId) {
        return whitePlayerId.equals(playerId) || blackPlayerId.equals(playerId);
    }

    public String colorOf(String playerId) {
        if (whitePlayerId.equals(playerId)) return "white";
        if (blackPlayerId.equals(playerId)) return "black";
        return null;
    }

    public String activeColor() {
        return board.getSideToMove() == Side.WHITE ? "white" : "black";
    }

    public String activePlayerId() {
        return board.getSideToMove() == Side.WHITE ? whitePlayerId : blackPlayerId;
    }

    public String opponentColor(String color) {
        return "white".equals(color) ? "black" : "white";
    }

    /**
     * Remaining seconds for {@code color}, accounting for time already burned in the
     * current turn. For the side not on move (or a finished game) this equals the
     * banked balance; for the side to move it subtracts elapsed wall-clock.
     */
    public double effectiveRemaining(String color, long nowMs) {
        double banked = "white".equals(color) ? whiteTimeRemaining : blackTimeRemaining;
        if (status == GameStatus.ACTIVE && color.equals(activeColor())) {
            banked -= (nowMs - lastMoveTimestamp) / 1000.0;
        }
        return Math.max(0.0, banked);
    }

    public List<String> uciList() {
        return history.stream().map(MoveRecord::uci).toList();
    }
}
