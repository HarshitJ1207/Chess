package com.example.chess.auth.service;

import com.example.chess.auth.dto.AuthResponse;
import com.example.chess.auth.dto.LoginRequest;
import com.example.chess.auth.dto.RegisterRequest;
import com.example.chess.auth.dto.GoogleAuthRequest;
import com.example.chess.auth.dto.GoogleAuthResponse;
import com.example.chess.auth.dto.GoogleRegisterRequest;
import com.example.chess.auth.entity.Credentials;
import com.example.chess.auth.entity.User;
import com.example.chess.auth.repository.CredentialsRepository;
import com.example.chess.auth.repository.UserRepository;
import com.example.chess.auth.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;

import java.util.Optional;
import java.util.UUID;

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

    private final GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(
            new NetHttpTransport(),
            new GsonFactory())
            //.setAudience(Collections.singletonList("353052442875-qdgbjldclpk2r472urld9p9rhve0q0nr.apps.googleusercontent.com"))
            .build();

    @Transactional
    public GoogleAuthResponse loginGoogle(GoogleAuthRequest request) {
        try {
            GoogleIdToken idToken = verifier.verify(request.token());
            if (idToken != null) {
                GoogleIdToken.Payload payload = idToken.getPayload();
                String email = payload.getEmail();
                
                Optional<User> existingUser = userRepository.findByEmail(email);
                if (existingUser.isPresent()) {
                    return new GoogleAuthResponse(jwtUtil.generateToken(existingUser.get()), existingUser.get().getUsername(), false, email);
                } else {
                    return new GoogleAuthResponse(null, null, true, email);
                }
            } else {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid Google ID token.");
            }
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Failed to authenticate with Google: " + e.getMessage());
        }
    }

    @Transactional
    public AuthResponse registerGoogle(GoogleRegisterRequest request) {
        try {
            GoogleIdToken idToken = verifier.verify(request.token());
            if (idToken != null) {
                GoogleIdToken.Payload payload = idToken.getPayload();
                String email = payload.getEmail();
                
                if (userRepository.existsByEmail(email)) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
                }
                if (userRepository.existsByUsername(request.username())) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already taken");
                }
                
                User user = new User();
                user.setUsername(request.username());
                user.setEmail(email);
                
                Credentials credentials = new Credentials();
                credentials.setUser(user);
                credentials.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
                user.setCredentials(credentials);
                
                userRepository.save(user);
                return new AuthResponse(jwtUtil.generateToken(user), user.getUsername());
            } else {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid Google ID token.");
            }
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Failed to register with Google: " + e.getMessage());
        }
    }
}
