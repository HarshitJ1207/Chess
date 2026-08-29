package com.example.chess.auth.controller;

import com.example.chess.auth.dto.AuthResponse;
import com.example.chess.auth.security.JwtUtil;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AnonymousControllerTest {

    @Test
    void playAsGuestIssuesPrefixedAnonymousToken() {
        JwtUtil jwtUtil = mock(JwtUtil.class);
        when(jwtUtil.generateAnonymousToken(anyString())).thenReturn("anon-token");
        AnonymousController controller = new AnonymousController(jwtUtil);

        AuthResponse resp = controller.playAsGuest();

        assertTrue(resp.username().startsWith("anon-"));
        assertEquals("anon-token", resp.token());
    }
}
