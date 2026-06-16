package com.example.chess.auth.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "credentials")
@Getter @Setter @NoArgsConstructor
public class Credentials {

    @Id
    private String username;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "username")
    private User user;

    @Column(nullable = false)
    private String passwordHash;
}
