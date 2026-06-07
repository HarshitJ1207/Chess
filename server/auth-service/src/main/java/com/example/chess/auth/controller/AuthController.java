package com.example.chess.auth.controller;

import com.example.chess.auth.dto.AuthResponse;
import com.example.chess.auth.dto.LoginRequest;
import com.example.chess.auth.dto.RegisterRequest;
import com.example.chess.auth.dto.ValidateResponse;
import com.example.chess.auth.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(@RequestBody @Valid RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/login")
    public AuthResponse login(@RequestBody @Valid LoginRequest request) {
        return authService.login(request);
    }

    // Called by peer services to validate a JWT. Returns user info if valid.
    @GetMapping("/validate")
    public ValidateResponse validate(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        String token = null;
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
        }
        return authService.validate(token);
    }
}
