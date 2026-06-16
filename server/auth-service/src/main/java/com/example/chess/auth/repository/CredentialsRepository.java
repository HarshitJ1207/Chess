package com.example.chess.auth.repository;

import com.example.chess.auth.entity.Credentials;
import com.example.chess.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CredentialsRepository extends JpaRepository<Credentials, String> {
    Optional<Credentials> findByUser(User user);
}
