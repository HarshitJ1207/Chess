package com.example.chess.history.service;

import com.example.chess.history.dto.GameConcludedEvent;
import com.example.chess.history.model.MoveTelemetry;
import com.github.bhlangonijr.chesslib.Board;
import com.github.bhlangonijr.chesslib.move.Move;
import com.github.bhlangonijr.chesslib.move.MoveList;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Reconstructs SAN move telemetry and a standard PGN string by replaying the event's UCI
 * move list through a chesslib board. The event carries only UCI, so SAN is derived here —
 * this is why history-service depends on chesslib.
 */
@Component
@Slf4j
public class PgnBuilder {

    public record Reconstruction(List<MoveTelemetry> telemetry, String pgn) {}

    public Reconstruction build(GameConcludedEvent event) {
        List<String> ucis = event.moves() == null ? List.of() : event.moves();
        Board board = new Board();
        MoveList moveList = new MoveList();
        List<MoveTelemetry> telemetry = new ArrayList<>(ucis.size());

        for (String uci : ucis) {
            try {
                Move move = new Move(uci.trim().toLowerCase(), board.getSideToMove());
                board.doMove(move);
                moveList.add(move);
            } catch (RuntimeException e) {
                // Our own engine produced these moves, so this is unexpected; archive what we have.
                log.warn("Stopping PGN reconstruction for game {} at bad move '{}'", event.gameId(), uci);
                break;
            }
        }

        String[] sans = safeSanArray(moveList);
        for (int i = 0; i < sans.length; i++) {
            telemetry.add(new MoveTelemetry(i + 1, ucis.get(i), sans[i]));
        }

        return new Reconstruction(telemetry, pgn(event, sans));
    }

    private String[] safeSanArray(MoveList moveList) {
        try {
            return moveList.toSanArray();
        } catch (RuntimeException e) {
            return new String[0]; // SAN is cosmetic; never fail archival over it
        }
    }

    private String pgn(GameConcludedEvent event, String[] sans) {
        StringBuilder sb = new StringBuilder();
        sb.append("[Event \"Chess Platform\"]\n");
        sb.append("[Site \"chess\"]\n");
        sb.append("[White \"").append(event.whitePlayerId()).append("\"]\n");
        sb.append("[Black \"").append(event.blackPlayerId()).append("\"]\n");
        sb.append("[Result \"").append(event.result()).append("\"]\n");
        sb.append("[Termination \"").append(event.termination()).append("\"]\n\n");

        StringBuilder movetext = new StringBuilder();
        for (int i = 0; i < sans.length; i++) {
            if (i % 2 == 0) {
                movetext.append(i / 2 + 1).append(". ");
            }
            movetext.append(sans[i]).append(' ');
        }
        movetext.append(event.result());
        return sb.append(movetext).toString();
    }
}
