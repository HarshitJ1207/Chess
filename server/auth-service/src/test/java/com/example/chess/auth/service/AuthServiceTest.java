package com.example.chess.auth.service;

import com.example.chess.auth.dto.AuthResponse;
import com.example.chess.auth.dto.LoginRequest;
import com.example.chess.auth.dto.RegisterRequest;
import com.example.chess.auth.entity.Credentials;
import com.example.chess.auth.entity.User;
import com.example.chess.auth.repository.CredentialsRepository;
import com.example.chess.auth.repository.UserRepository;
import com.example.chess.auth.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceTest {

    private UserRepository userRepository;
    private CredentialsRepository credentialsRepository;
    private PasswordEncoder passwordEncoder;
    private JwtUtil jwtUtil;
    private AuthService service;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        credentialsRepository = mock(CredentialsRepository.class);
        passwordEncoder = new BCryptPasswordEncoder();
        jwtUtil = mock(JwtUtil.class);
        service = new AuthService(userRepository, credentialsRepository, passwordEncoder, jwtUtil);

        when(jwtUtil.generateToken(any(User.class))).thenReturn("jwt-token");
    }

    @Test
    void registerCreatesUserAndCredentialsAndReturnsToken() {
        when(userRepository.existsByUsername("alice")).thenReturn(false);
        when(userRepository.existsByEmail("alice@example.com")).thenReturn(false);

        AuthResponse resp = service.register(
                new RegisterRequest("alice", "alice@example.com", "password123"));

        assertEquals("alice", resp.username());
        assertEquals("jwt-token", resp.token());
        verify(userRepository).save(any(User.class));
    }

    @Test
    void registerRejectsDuplicateUsername() {
        when(userRepository.existsByUsername("alice")).thenReturn(true);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                service.register(new RegisterRequest("alice", "alice@example.com", "password123")));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
    }

    @Test
    void registerRejectsDuplicateEmail() {
        when(userRepository.existsByUsername("alice")).thenReturn(false);
        when(userRepository.existsByEmail("alice@example.com")).thenReturn(true);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                service.register(new RegisterRequest("alice", "alice@example.com", "password123")));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
    }

    @Test
    void loginSucceedsWithCorrectPassword() {
        User user = new User();
        user.setUsername("alice");
        user.setEmail("alice@example.com");

        Credentials creds = new Credentials();
        creds.setUser(user);
        creds.setPasswordHash(passwordEncoder.encode("password123"));

        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(credentialsRepository.findById("alice")).thenReturn(Optional.of(creds));

        AuthResponse resp = service.login(new LoginRequest("alice", "password123"));

        assertNotNull(resp);
        assertEquals("alice", resp.username());
        assertEquals("jwt-token", resp.token());
    }

    @Test
    void loginRejectsWrongPassword() {
        User user = new User();
        user.setUsername("alice");
        user.setEmail("alice@example.com");

        Credentials creds = new Credentials();
        creds.setUser(user);
        creds.setPasswordHash(passwordEncoder.encode("correct-password"));

        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(credentialsRepository.findById("alice")).thenReturn(Optional.of(creds));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                service.login(new LoginRequest("alice", "wrong-password")));

        assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatusCode());
    }

    @Test
    void loginRejectsUnknownUser() {
        when(userRepository.findByUsername("nobody")).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                service.login(new LoginRequest("nobody", "whatever")));

        assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatusCode());
    }

    @Test
    void registerStoresBcryptHashNotPlaintext() {
        when(userRepository.existsByUsername("alice")).thenReturn(false);
        when(userRepository.existsByEmail("alice@example.com")).thenReturn(false);

        service.register(new RegisterRequest("alice", "alice@example.com", "password123"));

        var captor = org.mockito.ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        String storedHash = captor.getValue().getCredentials().getPasswordHash();
        assertTrue(storedHash.startsWith("$2"));
        assertTrue(passwordEncoder.matches("password123", storedHash));
    }
}
