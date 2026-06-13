package com.example.chess.game.service;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

/**
 * Server-authoritative flag-fall. When a player's turn begins we schedule a one-shot
 * task {@code remainingSeconds} into the future; a valid move cancels and reschedules it.
 * If it ever fires, that player has flagged and the game concludes on a timeout — the
 * client is never trusted to declare its own loss.
 */
@Component
@RequiredArgsConstructor
public class TimeoutScheduler {

    private final TaskScheduler taskScheduler;
    private final ConcurrentHashMap<String, ScheduledFuture<?>> pending = new ConcurrentHashMap<>();

    /** (Re)arm the flag-fall for a game. Replaces any task already pending for it. */
    public void arm(String gameId, double remainingSeconds, Runnable onFlag) {
        cancel(gameId);
        long delayMs = Math.max(0, Math.round(remainingSeconds * 1000.0));
        ScheduledFuture<?> future = taskScheduler.schedule(
                () -> {
                    pending.remove(gameId);
                    onFlag.run();
                },
                Instant.now().plusMillis(delayMs));
        pending.put(gameId, future);
    }

    public void cancel(String gameId) {
        ScheduledFuture<?> existing = pending.remove(gameId);
        if (existing != null) {
            existing.cancel(false);
        }
    }
}
