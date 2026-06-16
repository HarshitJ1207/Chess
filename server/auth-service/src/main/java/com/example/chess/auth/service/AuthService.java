package com.example.chess.auth.service;

import com.example.chess.auth.dto.AuthResponse;
import com.example.chess.auth.dto.LoginRequest;
import com.example.chess.auth.dto.RegisterRequest;
import com.example.chess.auth.entity.Credentials;
import com.example.chess.auth.entity.User;
import com.example.chess.auth.repository.CredentialsRepository;
import com.example.chess.auth.repository.UserRepository;
import com.example.chess.auth.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final CredentialsRepository credentialsRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.username())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already taken");
        }
        if (userRepository.existsByEmail(request.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already in use");
        }

        User user = new User();
        user.setUsername(request.username());
        user.setEmail(request.email());

        Credentials credentials = new Credentials();
        credentials.setUser(user);
        credentials.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setCredentials(credentials);

        userRepository.save(user);

        return new AuthResponse(jwtUtil.generateToken(user), user.getUsername());
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByUsername(request.username())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));

        Credentials credentials = credentialsRepository.findById(user.getUsername())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));

        if (!passwordEncoder.matches(request.password(), credentials.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        return new AuthResponse(jwtUtil.generateToken(user), user.getUsername());
    }
}
