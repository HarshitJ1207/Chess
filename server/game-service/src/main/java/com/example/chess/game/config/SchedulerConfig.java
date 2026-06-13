package com.example.chess.game.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

/**
 * Backs both the server-authoritative flag-fall timers ({@code TimeoutScheduler}) and the
 * {@code @Scheduled} Ping sweep. A small pool suffices — tasks are short and mostly idle
 * (one armed timeout per active game, cancelled on every move).
 */
@Configuration
public class SchedulerConfig {

    @Bean
    public TaskScheduler taskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(4);
        scheduler.setThreadNamePrefix("game-sched-");
        scheduler.setRemoveOnCancelPolicy(true); // cancelled flag-falls shouldn't pile up
        scheduler.initialize();
        return scheduler;
    }
}
