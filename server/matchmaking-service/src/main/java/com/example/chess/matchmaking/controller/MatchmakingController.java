package com.example.chess.matchmaking.controller;

import com.example.chess.matchmaking.dto.QueueRequest;
import com.example.chess.matchmaking.dto.QueueResponse;
import com.example.chess.matchmaking.service.MatchmakingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/matchmaking")
@RequiredArgsConstructor
public class MatchmakingController {

    private final MatchmakingService matchmakingService;

    @PostMapping("/queue")
    public ResponseEntity<QueueResponse> joinQueue(@Valid @RequestBody QueueRequest request,
                                                   Authentication auth) {
        String playerId = auth.getName(); // subject = userId from JWT
        return ResponseEntity.ok(matchmakingService.joinQueue(playerId, request));
    }

    @DeleteMapping("/queue/{timeControl}")
    public ResponseEntity<Void> leaveQueue(@PathVariable String timeControl,
                                           Authentication auth) {
        matchmakingService.leaveQueue(auth.getName(), timeControl);
        return ResponseEntity.noContent().build();
    }
}
