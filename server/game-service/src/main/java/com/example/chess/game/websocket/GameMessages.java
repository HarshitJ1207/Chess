package com.example.chess.game.websocket;

import com.example.chess.game.dto.ClockSnapshot;
import com.example.chess.game.model.ChatMessage;
import com.example.chess.game.model.GameState;
import com.example.chess.game.model.MoveRecord;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Builds the multiplexed wire messages. Every frame is a JSON envelope with a {@code t}
 * (type) discriminator; mutation frames also carry {@code v} (the ply/version counter the
 * client uses to detect desync) and a {@code d} payload.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class GameMessages {

    private final ObjectMapper mapper;

    private TextMessage frame(Map<String, Object> envelope) {
        try {
            return new TextMessage(mapper.writeValueAsString(envelope));
        } catch (JsonProcessingException e) {
            // Should never happen for plain maps; degrade to an empty error frame.
            log.error("Failed to serialize outbound frame", e);
            return new TextMessage("{\"t\":\"error\",\"d\":{\"code\":\"INTERNAL\"}}");
        }
    }

    private static Map<String, Object> env(String type) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("t", type);
        return m;
    }

    /** Full state dump on connect, so a fresh or reconnecting client can render immediately. */
    public TextMessage init(GameState g, String yourColor, long nowMs) {
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("gameId", g.getGameId());
        d.put("color", yourColor);
        d.put("white", g.getWhitePlayerId());
        d.put("black", g.getBlackPlayerId());
        d.put("fen", g.getBoard().getFen());
        d.put("ply", g.getPly());
        d.put("status", g.getStatus().name());
        d.put("turn", g.activeColor());
        d.put("timeControl", Map.of(
                "base", g.getTimeControl().baseSeconds(),
                "increment", g.getTimeControl().incrementSeconds()));
        d.put("clock", clock(g, nowMs, 0));
        d.put("moves", g.getHistory().stream()
                .map(m -> Map.of("uci", m.uci(), "san", m.san()))
                .toList());
        Map<String, Object> e = env("init");
        e.put("d", d);
        return frame(e);
    }

    /** Immediate pre-validation acknowledgement that suppresses the client spinner. */
    public TextMessage ack(int actionCounter) {
        Map<String, Object> e = env("ack");
        e.put("d", actionCounter);
        return frame(e);
    }

    /** Authoritative move broadcast to both players. */
    public TextMessage move(GameState g, MoveRecord m, long lagMs) {
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("uci", m.uci());
        d.put("san", m.san());
        d.put("fen", m.fen());
        d.put("ply", m.ply());
        d.put("clock", new ClockSnapshot(m.whiteRemaining(), m.blackRemaining(), lagMs));
        Map<String, Object> e = env("move");
        e.put("v", m.ply());
        e.put("d", d);
        return frame(e);
    }

    public TextMessage chat(ChatMessage c) {
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("from", c.fromPlayerId());
        d.put("color", c.fromColor());
        d.put("msg", c.text());
        Map<String, Object> e = env("chat");
        e.put("d", d);
        return frame(e);
    }

    public TextMessage draw(String action, String byColor) {
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("action", action); // "offer" | "declined"
        d.put("by", byColor);
        Map<String, Object> e = env("draw");
        e.put("d", d);
        return frame(e);
    }

    /** Terminal frame: the game is over. */
    public TextMessage end(GameState g) {
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("result", g.getStatus().resultTag());
        d.put("termination", g.getTerminationReason());
        d.put("winner", switch (g.getStatus()) {
            case WHITE_WON -> "white";
            case BLACK_WON -> "black";
            default -> null;
        });
        Map<String, Object> e = env("end");
        e.put("d", d);
        return frame(e);
    }

    public TextMessage error(String code, String detail) {
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("code", code);
        d.put("detail", detail);
        Map<String, Object> e = env("error");
        e.put("d", d);
        return frame(e);
    }

    private Map<String, Object> clock(GameState g, long nowMs, long lagMs) {
        return Map.of(
                "white", round(g.effectiveRemaining("white", nowMs)),
                "black", round(g.effectiveRemaining("black", nowMs)),
                "lag", lagMs);
    }

    private static double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
