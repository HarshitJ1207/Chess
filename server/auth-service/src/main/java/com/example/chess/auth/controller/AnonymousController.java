package com.example.chess.auth.controller;

import com.example.chess.auth.dto.AuthResponse;
import com.example.chess.auth.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AnonymousController {

    private final JwtUtil jwtUtil;

    @PostMapping("/anonymous")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse playAsGuest() {
        String anonymousId = "anon-" + UUID.randomUUID().toString().substring(0, 8); // Shorter UUID is fine
        String token = jwtUtil.generateAnonymousToken(anonymousId);
        return new AuthResponse(token, anonymousId);
    }
}
