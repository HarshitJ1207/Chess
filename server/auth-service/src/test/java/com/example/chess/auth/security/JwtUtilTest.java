package com.example.chess.auth.security;

import com.example.chess.auth.entity.User;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JwtUtilTest {

    private JwtUtil jwtUtil;

    @BeforeEach
    void setUp() throws Exception {
        jwtUtil = new JwtUtil();
        var secretField = JwtUtil.class.getDeclaredField("secret");
        secretField.setAccessible(true);
        // Base64-encoded 32-byte secret (matches app config).
        secretField.set(jwtUtil, "THK0uahmITVIkLbJPqp6cGXbFrjvcS4MTFLM9+ybESM=");
        var expirationField = JwtUtil.class.getDeclaredField("expirationMs");
        expirationField.setAccessible(true);
        expirationField.set(jwtUtil, 86_400_000L);
    }

    private User user(String username) {
        User u = new User();
        u.setUsername(username);
        u.setEmail(username + "@example.com");
        return u;
    }

    @Test
    void generatedTokenCarriesUsernameClaims() {
        String token = jwtUtil.generateToken(user("alice"));
        Claims claims = jwtUtil.parseClaims(token);
        assertEquals("alice", claims.getSubject());
        assertEquals("alice", claims.get("username", String.class));
        assertTrue(jwtUtil.isValid(token));
    }

    @Test
    void anonymousTokenSetsAnonymousClaim() {
        String token = jwtUtil.generateAnonymousToken("anon-12345678");
        Claims claims = jwtUtil.parseClaims(token);
        assertEquals("anon-12345678", claims.getSubject());
        assertEquals(true, claims.get("anonymous", Boolean.class));
        assertTrue(jwtUtil.isValid(token));
    }

    @Test
    void regularTokenDoesNotSetAnonymousClaim() {
        String token = jwtUtil.generateToken(user("alice"));
        Claims claims = jwtUtil.parseClaims(token);
        assertTrue(claims.get("anonymous") == null);
    }

    @Test
    void invalidTokenIsRejected() {
        assertFalse(jwtUtil.isValid("not-a-token"));
        assertFalse(jwtUtil.isValid(""));
        assertFalse(jwtUtil.isValid(null));
    }

    @Test
    void tamperedTokenIsRejected() {
        String token = jwtUtil.generateToken(user("alice"));
        // Flip the last character — signature will no longer match.
        String tampered = token.substring(0, token.length() - 1) + (token.endsWith("a") ? "b" : "a");
        assertFalse(jwtUtil.isValid(tampered));
    }
}
