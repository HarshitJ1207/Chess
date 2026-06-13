# System Architecture

## Service Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React)                          │
│                     localhost:5173 (dev)                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP / WebSocket
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Nginx (port 80)                             │
│                    Static file server                           │
│                    + API Gateway / Reverse Proxy                │
└──┬──────────┬──────────┬──────────┬──────────┬─────────────────┘
   │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼
:8081      :8082      :8083      :8084      :8085
auth-    matchmak-   game-     rating-   history-
service   service    service   service   service
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

Redis
├── queue:{timeControl}        ZSET  member=playerId  score=elo
├── pending_match:{playerId}   STRING  "gameId:color:opponentId"  TTL=30s
└── game:{gameId}:moves        LIST  each entry = UCI move string

rating_db (PostgreSQL)
└── player_ratings  (player_id, rating, rating_deviation, volatility)
    + Redis ZSET: leaderboard

history_db (PostgreSQL)
└── games  (game_id, white_id, black_id, result, pgn, moves JSONB)
```

---

## Kafka Topics

| Topic | Producer | Consumers | Payload |
|---|---|---|---|
| `match-created` | matchmaking-service | game-service | `{ gameId, whitePlayerId, blackPlayerId, timeControl }` |
| `game-concluded` | game-service | rating-service, history-service | `{ gameId, whitePlayerId, blackPlayerId, result, termination, moves[] }` |

---

## JWT Flow

All services share the same `JWT_SECRET`. The auth-service **issues** tokens; every other service **validates** them locally using the same key — no round-trip to auth-service on each request.

```
Client ──POST /login──► auth-service ──► issues JWT (sub=userId, username claim)
                                                │
Client stores JWT in memory (Zustand)           │
                                                │
Client ──POST /api/matchmaking/queue──► nginx ──► matchmaking-service
         Authorization: Bearer <JWT>                JwtAuthFilter validates
                                                    signature locally
```
