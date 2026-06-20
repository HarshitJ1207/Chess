package com.example.chess.auth;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class TestBcrypt {
    @Test
    public void test() {
        BCryptPasswordEncoder enc = new BCryptPasswordEncoder();
        System.out.println("TEST_RESULT_IS_MATCH: " + enc.matches("password", "$2a$10$wOqZqK7s21JqI8i48k.bS.F7Rk0l72B1u6oQ0fG6tO7R8X8U0p2t2"));
    }
}
