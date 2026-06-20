package com.example.chess.auth.controller;

import com.example.chess.auth.dto.AuthResponse;
import com.example.chess.auth.dto.LoginRequest;
import com.example.chess.auth.dto.RegisterRequest;
import com.example.chess.auth.dto.GoogleAuthRequest;
import com.example.chess.auth.dto.GoogleAuthResponse;
import com.example.chess.auth.dto.GoogleRegisterRequest;
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

    @PostMapping("/google")
    public GoogleAuthResponse loginGoogle(@RequestBody @Valid GoogleAuthRequest request) {
        return authService.loginGoogle(request);
    }

    @PostMapping("/google/register")
    public AuthResponse registerGoogle(@RequestBody @Valid GoogleRegisterRequest request) {
        return authService.registerGoogle(request);
    }
}
