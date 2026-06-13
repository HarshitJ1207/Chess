package com.example.chess.game.service;

import com.example.chess.game.model.MoveRecord;
import com.example.chess.game.model.TimeControl;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * On startup, rebuilds any games that were live when the JVM last died. The set
 * {@code games:active} names them; each game's meta hash and {@code RPUSH} move log are
 * replayed back into RAM so a restart is invisible to connected players.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class GameRecoveryService implements ApplicationRunner {

    private static final String ACTIVE_SET = "games:active";

    private final StringRedisTemplate redis;
    private final ObjectMapper mapper;
    private final GameManager gameManager;

    @Override
    public void run(ApplicationArguments args) {
        Set<String> activeGameIds = redis.opsForSet().members(ACTIVE_SET);
        if (activeGameIds == null || activeGameIds.isEmpty()) {
            return;
        }
        log.info("Recovering {} active game(s) from Redis", activeGameIds.size());
        for (String gameId : activeGameIds) {
            try {
                recoverOne(gameId);
            } catch (Exception e) {
                log.error("Failed to recover game {} — dropping from active set", gameId, e);
                redis.opsForSet().remove(ACTIVE_SET, gameId);
            }
        }
    }

    private void recoverOne(String gameId) {
        Map<Object, Object> meta = redis.opsForHash().entries("game:" + gameId + ":meta");
        if (meta.isEmpty()) {
            redis.opsForSet().remove(ACTIVE_SET, gameId);
            return;
        }
        String white = (String) meta.get("white");
        String black = (String) meta.get("black");
        TimeControl tc = new TimeControl(
                Integer.parseInt((String) meta.get("base")),
                Integer.parseInt((String) meta.get("increment")));

        List<String> raw = redis.opsForList().range("game:" + gameId + ":moves", 0, -1);
        List<MoveRecord> moves = new ArrayList<>();
        if (raw != null) {
            for (String json : raw) {
                try {
                    moves.add(mapper.readValue(json, MoveRecord.class));
                } catch (Exception e) {
                    log.warn("Skipping unparseable move record in game {}: {}", gameId, json);
                }
            }
        }
        gameManager.restoreGame(gameId, white, black, tc, moves);
    }
}
