package com.example.chess.matchmaking.controller;

import com.example.chess.matchmaking.dto.QueueRequest;
import com.example.chess.matchmaking.dto.QueueResponse;
import com.example.chess.matchmaking.service.MatchmakingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/matchmaking")
@RequiredArgsConstructor
public class MatchmakingController {

    private final MatchmakingService matchmakingService;

    @PostMapping("/queue")
    public ResponseEntity<QueueResponse> joinQueue(@Valid @RequestBody QueueRequest request,
                                                   @RequestHeader("X-Username") String username,
                                                   @RequestHeader(value = "X-Anonymous", defaultValue = "false") String anonymous) {
        return ResponseEntity.ok(matchmakingService.joinQueue(username, request, Boolean.parseBoolean(anonymous)));
    }

    @DeleteMapping("/dequeue")
    public ResponseEntity<Void> leaveQueue(@RequestParam String timeControl,
                                           @RequestHeader("X-Username") String username,
                                           @RequestHeader(value = "X-Anonymous", defaultValue = "false") String anonymous) {
        matchmakingService.leaveQueue(username, timeControl, Boolean.parseBoolean(anonymous));
        return ResponseEntity.noContent().build();
    }
}
