package com.example.chess.game.websocket;

import com.example.chess.game.model.GameState;
import com.example.chess.game.model.GameStatus;
import com.example.chess.game.model.MoveRecord;
import com.example.chess.game.model.TimeControl;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.TextMessage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class GameMessagesTest {

    private final GameMessages messages = new GameMessages(new ObjectMapper());
    private final ObjectMapper mapper = new ObjectMapper();

    private GameState state() {
        GameState g = new GameState("g1", "alice", "bob", TimeControl.parse("5+0"), false);
        g.setPly(2);
        g.getHistory().add(new MoveRecord(1, "e2e4", "e4", g.getBoard().getFen(), 299.0, 300.0));
        return g;
    }

    private JsonNode parse(TextMessage m) throws Exception {
        return mapper.readTree(m.getPayload());
    }

    @Test
    void initFrameCarriesFullState() throws Exception {
        JsonNode root = parse(messages.init(state(), "white", 0L));
        assertEquals("init", root.path("t").asText());
        JsonNode d = root.path("d");
        assertEquals("g1", d.path("gameId").asText());
        assertEquals("white", d.path("color").asText());
        assertEquals("alice", d.path("whiteUsername").asText());
        assertEquals("bob", d.path("blackUsername").asText());
        assertEquals("white", d.path("turn").asText());
        assertEquals(300, d.path("timeControl").path("base").asInt());
        assertEquals(1, d.path("moves").size());
    }

    @Test
    void moveFrameIsVersionedAndCarriesClock() throws Exception {
        MoveRecord rec = new MoveRecord(3, "g1f3", "Nf3", "fen", 295.5, 300.0);
        JsonNode root = parse(messages.move(state(), rec));
        assertEquals("move", root.path("t").asText());
        assertEquals(3, root.path("v").asInt());
        assertEquals("Nf3", root.path("d").path("san").asText());
        assertEquals(295.5, root.path("d").path("clock").path("white").asDouble());
    }

    @Test
    void ackFrameEchoesActionCounter() throws Exception {
        JsonNode root = parse(messages.ack(42));
        assertEquals("ack", root.path("t").asText());
        assertEquals(42, root.path("d").asInt());
    }

    @Test
    void endFrameExposesWinnerForDecisiveResult() throws Exception {
        GameState g = state();
        g.setStatus(GameStatus.WHITE_WON);
        g.setTerminationReason("checkmate");
        JsonNode d = parse(messages.end(g)).path("d");
        assertEquals("1-0", d.path("result").asText());
        assertEquals("checkmate", d.path("termination").asText());
        assertEquals("white", d.path("winner").asText());
    }

    @Test
    void endFrameHasNullWinnerForDraw() throws Exception {
        GameState g = state();
        g.setStatus(GameStatus.DRAW);
        JsonNode d = parse(messages.end(g)).path("d");
        assertEquals("1/2-1/2", d.path("result").asText());
        assertNull(d.path("winner").asText(null));
    }

    @Test
    void errorFrameCarriesCodeAndDetail() throws Exception {
        JsonNode d = parse(messages.error("ILLEGAL_MOVE", "Illegal move: e2e5")).path("d");
        assertEquals("ILLEGAL_MOVE", d.path("code").asText());
        assertNotNull(d.path("detail").asText());
    }
}
