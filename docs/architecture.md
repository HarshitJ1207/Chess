# System Architecture

## Service Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React)                          │
│                     localhost:5173 (dev)                        │
│                or https://chessblitz.in (prod)                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP / WebSocket
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Nginx (Port 80/443 Edge)                      │
│      1. Serves Static React Frontend                            │
│      2. Proxies /api/* and /ws/* to gateway-service             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              gateway-service (Spring Boot :8080)                │
│      1. Gateway Entry Point for APIs and WebSockets             │
│      2. Queries Eureka for Service Registry / Load Balancing    │
└──────────┬──────────┬──────────┬──────────┬──────────┬──────────┘
           │          │          │          │          │
           ▼          ▼          ▼          ▼          ▼
       auth-      matchmak-   game-     rating-   history-
       service    service    service   service   service
        :8081      :8082      :8083      :8084      :8085
           │          │          │          │          │
           │          ├──────────┤          │          │
           │          │  Redis   │          │          │
           │          │  :6379   │          │          │
           │          │          │          │          │
           └──────────┴──────────┴──────────┴──────────┘
                                  │
                            Redpanda (Kafka)
                               :9092
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
             match-created              game-concluded
                  topic                     topic
                    │                           │
                    ▼                           ├──► rating-service
              game-service                      └──► history-service
```

---

## Service Responsibilities

| Service | Port | Owns | Key Endpoints |
|---|---|---|---|
| **gateway-service** | 8080 | Routing & API Gateway | Routes `/api/**` and `/ws/**` to microservices |
| **auth-service** | 8081 | `auth_db` — users + credentials | `POST /api/auth/register` `POST /api/auth/login` `GET /api/auth/validate` |
| **matchmaking-service** | 8082 | Redis Sorted Sets `queue:{tc}` | `POST /api/matchmaking/queue` `DELETE /api/matchmaking/queue/{tc}` |
| **game-service** | 8083 | JVM `ConcurrentHashMap` + Redis move log | `WS /ws/game/{gameId}` |
| **rating-service** | 8084 | `rating_db` — Glicko-2 vectors + Redis leaderboard | `GET /api/ratings/{userId}` `GET /api/ratings/leaderboard` |
| **history-service** | 8085 | `history_db` — games + JSONB move telemetry | `GET /api/history/player/{id}` `GET /api/history/game/{id}` |
| **eureka-server** | 8761 | Service registry | `/eureka/apps` |

---

## Data Ownership

```
auth_db (PostgreSQL)
├── users          (id UUID, username, email, created_at)
└── credentials    (user_id FK, password_hash)

rating_db (PostgreSQL)
└── player_ratings  (player_id, rating, rating_deviation, volatility)

history_db (PostgreSQL)
└── games  (game_id, white_id, black_id, result, pgn, moves JSONB)

```

### Redis Keys Registry

| Key Pattern | Data Structure | Written By | Read / Deleted By | TTL | Purpose |
|---|---|---|---|---|---|
| `queue:{tc}` | **ZSET**<br>score=rating<br>member=username | `matchmaking-service` | **Read:** `matchmaking-service` (pairing loop)<br>**Delete:** `matchmaking-service` (via `ZREM` on match / queue leave) | None | Active matchmaking queue for registered users, separated by time control (`tc`). |
| `queue:anon:{tc}` | **ZSET**<br>score=elo<br>member=username | `matchmaking-service` | **Read:** `matchmaking-service` (pairing loop)<br>**Delete:** `matchmaking-service` (via `ZREM` on match / queue leave) | None | Active matchmaking queue for guest users, separated by time control (`tc`). Isolated from registered users. |
| `player:{username}:game` | **STRING**<br>(JSON string) | `game-service` | **Write:** `game-service` (atomically via `SETNX` on match consume)<br>**Read:** `matchmaking-service` (via `POST /api/matchmaking/queue` to check active game or poll match status)<br>**Delete:** `game-service` (on game conclusion) | 24h | Active user session claim. Prevents double-queueing, connects players on reconnect, and acts as the match completion detection key for the client poll loop. |
| `game:{gameId}:meta` | **HASH** | `game-service` | **Write:** `game-service` (at game initialization)<br>**Read:** `game-service` (for lazy recovery)<br>**Delete:** `game-service` (sets 1-hour expiration on conclusion) | 1h post-game | Stores active game configuration details: `white`, `black`, `base`, `increment`. |
| `game:{gameId}:moves` | **LIST**<br>(serialized JSON) | `game-service` | **Write:** `game-service` (appends via `RPUSH` on each valid move)<br>**Read:** `game-service` (replays list on lazy crash recovery)<br>**Delete:** `game-service` (sets 1-hour expiration on conclusion) | 1h post-game | Append-only move log. Used to reconstruct the authoritative game board inside JVM RAM after a service crash. |
| `leaderboard` | **ZSET**<br>score=rating<br>member=username | `rating-service` | **Write:** `rating-service` (updates on consuming `game-concluded` Kafka event)<br>**Read:** `rating-service` (serves the leaderboard endpoint `/leaderboard`) | None | Persistent global leaderboard for registered players. |

---

## Kafka Topics

| Topic | Producer | Consumers | Payload |
|---|---|---|---|
| `match-request` | matchmaking-service | game-service | `{ player1Username, player2Username, timeControl, anonymous }` |
| `game-concluded` | game-service | rating-service, history-service | `{ gameId, whiteUsername, blackUsername, result, termination, moves[] }` *(skipped for anonymous games)* |

---

## JWT Flow

1. The **auth-service** generates and signs JWT tokens using `JWT_SECRET`.
2. The **gateway-service** intercepts all incoming API/WS requests, validates the signature using the shared `JWT_SECRET` (in `JwtValidationFilter`), and rejects unauthorized requests.
3. If valid, the gateway extracts user metadata from the claims and injects them as downstream HTTP headers:
   - `X-Username`: The authenticated user's username.
   - `X-Anonymous`: Boolean string indicating if the user is playing anonymously.
4. Downstream microservices (like `matchmaking-service`, `game-service`, etc.) do **not** load `JWT_SECRET` or perform JWT parsing. They trust the gateway and read the user attributes directly from these headers.

```
Client ──POST /login──► auth-service ──► issues JWT (sub=username, anonymous claim)
                                                │
Client stores JWT in memory (Zustand)           │
                                                │
Client ──POST /api/matchmaking/queue ──► Nginx ──► gateway-service
         Authorization: Bearer <JWT>               (validates signature, injects headers:
                                                    X-Username, X-Anonymous)
                                                        │
                                                        ▼
                                               matchmaking-service
                                                (reads X-Username directly)
```

---

## Anonymous / Guest Play Support

The system supports guest players who want to play quick matches without creating an account.

### 1. Token Generation
- The client calls `POST /api/auth/anonymous` to get an anonymous token.
- The `auth-service` generates a transient username (prefixed with `anon-`) and issues a JWT token where the claim `anonymous: true` is set.

### 2. Matchmaking Queue Isolation
- Guest players are matched in entirely separate queues from registered players.
- The `matchmaking-service` inspects the `X-Anonymous` header and prepends `anon:` to the Redis queue keys (e.g. `queue:anon:{timeControl}` instead of `queue:{timeControl}`). This guarantees registered players are never paired with guests.

### 3. Execution & Storage Offloading
- When an anonymous match concludes, the `game-service` checks `game.isAnonymous()`.
- If the game was played anonymously, the `game-concluded` Kafka event is **not published** to Redpanda.
- Because of this, the `rating-service` and `history-service` never receive the match. This protects the registered player statistics and prevents guest games from bloating the `rating_db` and `history_db` databases.
- Active game metadata in Redis is automatically expired after 1 hour, freeing up all memory resources.
