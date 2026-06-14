package com.example.chess.game.service;

import com.example.chess.game.dto.GameConcludedEvent;
import com.example.chess.game.model.ChatMessage;
import com.example.chess.game.model.GameState;
import com.example.chess.game.model.GameStatus;
import com.example.chess.game.model.MoveRecord;
import com.example.chess.game.model.TimeControl;
import com.example.chess.game.websocket.GameMessages;
import com.example.chess.game.websocket.GameSessionRegistry;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.bhlangonijr.chesslib.Board;
import com.github.bhlangonijr.chesslib.move.Move;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.WebSocketSession;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Owns the volatile, RAM-first reality of every active game. Active games live in the
 * {@code games} map; move validation and clock math run synchronously under each game's
 * monitor in microseconds. The only persistence on the hot path is a fire-and-forget
 * Redis {@code RPUSH} of each move (for crash recovery); all heavy work is deferred to a
 * single {@code GameConcludedEvent} on Kafka when the game ends.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GameManager {

    private final ConcurrentHashMap<String, GameState> games = new ConcurrentHashMap<>();

    private final StringRedisTemplate redis;
    private final ObjectMapper mapper;
    private final TimeoutScheduler timeoutScheduler;
    private final GameEventPublisher publisher;
    private final GameSessionRegistry registry;
    private final GameMessages messages;

    @Value("${spring.application.name}")
    private String instanceId;

    @Value("${server.port}")
    private int serverPort;

    public GameState get(String gameId) {
        return games.get(gameId);
    }

    private String getInstanceId() {
        return instanceId;
    }

    private String buildInstanceUri() {
        // In production, use actual hostname/IP from Eureka
        // For now, use localhost:port
        return "http://localhost:" + serverPort;
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────────

    /**
     * Instantiate a game in memory from a match request.
     *
     * ATOMIC CLAIM: Uses Redis SETNX to atomically claim both players before creating game.
     * If either player is already in a game, aborts and rolls back.
     *
     * INVARIANT: Registry ⊆ RAM. Game must exist in RAM before being added to registry.
     */
    public void createGameFromMatchRequest(com.example.chess.game.dto.MatchRequest request) {
        String player1Id = request.player1Id();
        String player2Id = request.player2Id();
        String timeControl = request.timeControl();

        // Generate unique game ID
        java.util.UUID gameId = java.util.UUID.randomUUID();

        log.info("Processing match request: {} vs {} (gameId={})", player1Id, player2Id, gameId);

        // STEP 1: Flip coin for colors
        boolean player1IsWhite = gameId.getLeastSignificantBits() > 0;
        String whiteId = player1IsWhite ? player1Id : player2Id;
        String blackId = player1IsWhite ? player2Id : player1Id;

        log.info("Color assignment: white={}, black={}", whiteId, blackId);

        // STEP 2: Build JSON metadata for both players
        String finalInstanceUri = buildInstanceUri();
        String whiteMetadata = """
            {"gameId":"%s","myColor":"white","opponentId":"%s","timeControl":"%s","instanceUri":"%s"}
            """.formatted(gameId, blackId, timeControl, finalInstanceUri).strip();
        String blackMetadata = """
            {"gameId":"%s","myColor":"black","opponentId":"%s","timeControl":"%s","instanceUri":"%s"}
            """.formatted(gameId, whiteId, timeControl, finalInstanceUri).strip();

        // STEP 3: Atomic claim of both players using SETNX
        Boolean p1Claimed = redis.opsForValue()
            .setIfAbsent("player:" + whiteId + ":game", whiteMetadata, Duration.ofHours(24));

        if (Boolean.FALSE.equals(p1Claimed)) {
            log.warn("Player {} already in game, aborting match request", whiteId);
            return;
        }

        Boolean p2Claimed = redis.opsForValue()
            .setIfAbsent("player:" + blackId + ":game", blackMetadata, Duration.ofHours(24));

        if (Boolean.FALSE.equals(p2Claimed)) {
            log.warn("Player {} already in game, rolling back player {} claim", blackId, whiteId);
            // Rollback: Remove player1's claim
            redis.delete("player:" + whiteId + ":game");
            return;
        }

        // STEP 4: Create game in RAM
        TimeControl tc = TimeControl.parse(timeControl);
        GameState game = new GameState(gameId.toString(), whiteId, blackId, tc);
        game.setLastMoveTimestamp(System.currentTimeMillis());
        games.put(gameId.toString(), game);

        // STEP 5: Remove both players from matchmaking queue
        redis.opsForZSet().remove("queue:" + timeControl, whiteId);
        redis.opsForZSet().remove("queue:" + timeControl, blackId);

        // STEP 6: Setup persistence and timeout
        persistMeta(game);
        timeoutScheduler.arm(gameId.toString(), game.getWhiteTimeRemaining(), () -> handleTimeout(gameId.toString()));

        log.info("Game {} created: {} (white) vs {} (black), {}",
            gameId, whiteId, blackId, tc.wire());
    }


    // ── Move handling (the hot path) ─────────────────────────────────────────────

    /**
     * Validate and apply a move under the 3-way handshake. The caller has already sent
     * the immediate ACK; here we run authoritative validation, the clock engine, Redis
     * persistence, and the broadcast. Errors go back only to the mover.
     */
    public void applyMove(String gameId, String playerId, WebSocketSession moverSession,
                          String uci, long lagMs) {
        GameState game = games.get(gameId);
        if (game == null) {
            registry.sendQuietly(moverSession, messages.error("NO_GAME", "Unknown game"));
            return;
        }
        synchronized (game) {
            if (game.getStatus().isOver()) {
                registry.sendQuietly(moverSession, messages.error("GAME_OVER", "Game already concluded"));
                return;
            }
            String moverColor = game.colorOf(playerId);
            if (moverColor == null) {
                registry.sendQuietly(moverSession, messages.error("NOT_PARTICIPANT", "Not in this game"));
                return;
            }
            if (!moverColor.equals(game.activeColor())) {
                registry.sendQuietly(moverSession, messages.error("NOT_YOUR_TURN", "Not your turn"));
                return;
            }

            Board board = game.getBoard();
            Move move;
            try {
                move = new Move(uci.trim().toLowerCase(), board.getSideToMove());
            } catch (RuntimeException e) {
                registry.sendQuietly(moverSession, messages.error("BAD_UCI", "Malformed move: " + uci));
                return;
            }
            if (!board.isMoveLegal(move, true)) {
                registry.sendQuietly(moverSession, messages.error("ILLEGAL_MOVE", "Illegal move: " + uci));
                return;
            }

            // ── Clock engine ──
            long now = System.currentTimeMillis();
            long elapsedMs = now - game.getLastMoveTimestamp();

            double banked = "white".equals(moverColor)
                    ? game.getWhiteTimeRemaining() : game.getBlackTimeRemaining();
            double newBalance = banked - elapsedMs / 1000.0;
            if (newBalance <= 0) {
                // Flagged on their own move — opponent wins on time.
                setBalance(game, moverColor, 0);
                concludeWithLoser(game, moverColor, "timeout");
                return;
            }
            newBalance += game.getTimeControl().incrementSeconds();
            setBalance(game, moverColor, newBalance);

            // ── Apply to board ──
            board.doMove(move);
            game.getMoveList().add(move);
            String san = lastSan(game);
            game.setPly(game.getPly() + 1);
            game.setPendingDrawOfferBy(null); // any move withdraws a pending draw offer

            MoveRecord rec = new MoveRecord(
                    game.getPly(), move.toString(), san, board.getFen(),
                    round(game.getWhiteTimeRemaining()), round(game.getBlackTimeRemaining()));
            game.getHistory().add(rec);
            game.setLastMoveTimestamp(now); // opponent's clock starts now

            // TODO: Lazy crash recovery — on WS connect, if gameId not in RAM, read
            // game:{id}:meta + game:{id}:moves from Redis and rebuild in-memory state.
            // Implement after gateway affinity (game:{id}:instance) is wired up.
            persistMove(gameId, rec);
            registry.broadcast(gameId, messages.move(game, rec, 0L));

            // ── End-of-game detection ──
            GameStatus end = detectEnd(board, moverColor);
            if (end != null) {
                concludeWith(game, end, terminationFor(board, end));
                return;
            }

            // Arm the opponent's flag-fall.
            double oppRemaining = game.effectiveRemaining(game.activeColor(), now);
            timeoutScheduler.arm(gameId, oppRemaining, () -> handleTimeout(gameId));
        }
    }

    // ── Non-move actions ─────────────────────────────────────────────────────────

    public void resign(String gameId, String playerId) {
        GameState game = games.get(gameId);
        if (game == null) return;
        synchronized (game) {
            if (game.getStatus().isOver()) return;
            String color = game.colorOf(playerId);
            if (color == null) return;
            concludeWithLoser(game, color, "resignation");
        }
    }

    public void abort(String gameId, String playerId, WebSocketSession session) {
        GameState game = games.get(gameId);
        if (game == null) return;
        synchronized (game) {
            if (game.getStatus().isOver()) return;
            if (game.colorOf(playerId) == null) return;
            // Abort is only valid before the game is truly underway (no reply by black yet).
            if (game.getPly() >= 2) {
                registry.sendQuietly(session, messages.error("CANNOT_ABORT", "Game already underway; resign instead"));
                return;
            }
            concludeWith(game, GameStatus.ABORTED, "abort");
        }
    }

    public void handleDraw(String gameId, String playerId, String action) {
        GameState game = games.get(gameId);
        if (game == null) return;
        synchronized (game) {
            if (game.getStatus().isOver()) return;
            String color = game.colorOf(playerId);
            if (color == null) return;
            String opponentId = "white".equals(color) ? game.getBlackPlayerId() : game.getWhitePlayerId();

            switch (action == null ? "" : action) {
                case "offer", "accept" -> {
                    if (opponentId.equals(game.getPendingDrawOfferBy())) {
                        // Both sides now want a draw.
                        concludeWith(game, GameStatus.DRAW, "draw_agreement");
                    } else if ("offer".equals(action)) {
                        game.setPendingDrawOfferBy(playerId);
                        registry.broadcast(gameId, messages.draw("offer", color));
                    }
                }
                case "decline" -> {
                    game.setPendingDrawOfferBy(null);
                    registry.broadcast(gameId, messages.draw("declined", color));
                }
                default -> { /* ignore unknown draw action */ }
            }
        }
    }

    public void chat(String gameId, String playerId, String text) {
        GameState game = games.get(gameId);
        if (game == null || text == null || text.isBlank()) return;
        String color = game.colorOf(playerId);
        if (color == null) return;
        ChatMessage msg = new ChatMessage(playerId, color, text);
        synchronized (game) {
            game.getChat().add(msg);
        }
        registry.broadcast(gameId, messages.chat(msg));
    }

    /** Fired by the {@link TimeoutScheduler} when a player's flag falls. */
    public void handleTimeout(String gameId) {
        GameState game = games.get(gameId);
        if (game == null) return;
        synchronized (game) {
            if (game.getStatus().isOver()) return;
            long now = System.currentTimeMillis();
            String active = game.activeColor();
            double remaining = game.effectiveRemaining(active, now);
            if (remaining > 0.05) {
                // A move slipped in and reset the clock — re-arm rather than flag.
                timeoutScheduler.arm(gameId, remaining, () -> handleTimeout(gameId));
                return;
            }
            setBalance(game, active, 0);
            concludeWithLoser(game, active, "timeout");
        }
    }

    // ── Conclusion ───────────────────────────────────────────────────────────────

    private void concludeWithLoser(GameState game, String loserColor, String termination) {
        GameStatus status = "white".equals(loserColor) ? GameStatus.BLACK_WON : GameStatus.WHITE_WON;
        concludeWith(game, status, termination);
    }

    private void concludeWith(GameState game, GameStatus status, String termination) {
        game.setStatus(status);
        game.setTerminationReason(termination);
        String gameId = game.getGameId();
        timeoutScheduler.cancel(gameId);

        publisher.publishConcluded(new GameConcludedEvent(
                gameId, game.getWhitePlayerId(), game.getBlackPlayerId(),
                status.resultTag(), termination, game.uciList()));

        registry.broadcast(gameId, messages.end(game));

        // Free RAM; clean up player registry; keep meta/moves briefly for debugging, then expire.
        redis.delete("player:" + game.getWhitePlayerId() + ":game");
        redis.delete("player:" + game.getBlackPlayerId() + ":game");
        redis.expire(metaKey(gameId), Duration.ofHours(1));
        redis.expire(movesKey(gameId), Duration.ofHours(1));
        games.remove(gameId);
        log.info("Game {} concluded: {} ({})", gameId, status.resultTag(), termination);
    }

    // ── chesslib helpers ─────────────────────────────────────────────────────────

    /** Returns a finished {@link GameStatus} if the position ends the game, else null. */
    private GameStatus detectEnd(Board board, String moverColor) {
        if (board.isMated()) {
            return "white".equals(moverColor) ? GameStatus.WHITE_WON : GameStatus.BLACK_WON;
        }
        if (board.isStaleMate() || board.isInsufficientMaterial()
                || board.getHalfMoveCounter() >= 100 || board.isDraw()) {
            return GameStatus.DRAW;
        }
        return null;
    }

    private String terminationFor(Board board, GameStatus end) {
        if (end != GameStatus.DRAW) {
            return "checkmate";
        }
        if (board.isStaleMate()) return "stalemate";
        if (board.isInsufficientMaterial()) return "insufficient_material";
        if (board.getHalfMoveCounter() >= 100) return "fifty_move";
        return "threefold";
    }

    private String lastSan(GameState game) {
        try {
            String[] sans = game.getMoveList().toSanArray();
            return sans.length == 0 ? "" : sans[sans.length - 1];
        } catch (RuntimeException e) {
            return ""; // SAN is cosmetic; never fail a legal move over it
        }
    }

    private void setBalance(GameState game, String color, double seconds) {
        if ("white".equals(color)) {
            game.setWhiteTimeRemaining(seconds);
        } else {
            game.setBlackTimeRemaining(seconds);
        }
    }

    // ── Redis persistence ────────────────────────────────────────────────────────

    private void persistMeta(GameState game) {
        String key = metaKey(game.getGameId());
        redis.opsForHash().putAll(key, Map.of(
                "white", game.getWhitePlayerId(),
                "black", game.getBlackPlayerId(),
                "base", String.valueOf(game.getTimeControl().baseSeconds()),
                "increment", String.valueOf(game.getTimeControl().incrementSeconds())));
    }

    private void persistMove(String gameId, MoveRecord rec) {
        try {
            redis.opsForList().rightPush(movesKey(gameId), mapper.writeValueAsString(rec));
        } catch (JsonProcessingException e) {
            log.error("Failed to persist move for game {}", gameId, e); // non-fatal: RAM stays authoritative
        }
    }

    private static String metaKey(String gameId) {
        return "game:" + gameId + ":meta";
    }

    private static String movesKey(String gameId) {
        return "game:" + gameId + ":moves";
    }

    private static double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
