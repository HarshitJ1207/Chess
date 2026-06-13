# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current State

> This project is in early scaffolding. Do not assume any planned dependency exists until verified in the relevant build file.

| Layer | What exists | Not yet added |
|---|---|---|
| `server/` | Spring Boot 4 + Gradle + Java 21 + Lombok | WebSocket, Redis, Kafka/Redpanda, chesslib, Eureka, JWT |
| `client/` | Vite + React 19 | MUI, react-chessboard, Tailwind CSS |

---

## 1. Project Overview

A highly decoupled, distributed chess platform inspired by Lichess. Primary concerns: ultra-low latency game loops, event-driven persistence, and strict microservice isolation. Deployment target: a single AWS EC2 instance running all services via Docker Compose.

---

## 2. Tech Stack

| Concern | Technology |
|---|---|
| Services | Java 21 + Spring Boot 4 |
| Chess validation | `chesslib` (bhlangonisan) |
| Relational store | PostgreSQL 16 (JSONB for game telemetry) |
| Cache + Pub/Sub | Redis 7 |
| Event streaming | Redpanda (Kafka-compatible) |
| Service discovery | Netflix Eureka |
| Gateway | Nginx |
| Frontend | React 19 + Vite + MUI + Tailwind + react-chessboard |

---

## 3. Core Architectural Rules

These are non-negotiable constraints. Apply them to every code change.

1. **Database-per-service isolation.** Each microservice owns its own DB/schema. Never write cross-service joins. Share data only via Kafka events or synchronous REST.
2. **Event-driven write offloading.** The game loop (WebSocket + RAM) must never block on a PostgreSQL write. All heavy persistence (PGN saving, Elo calculation) is offloaded via `GameConcludedEvent` on Kafka.
3. **RAM-first game state.** Active games live entirely in the Game Service's JVM memory (`ConcurrentHashMap`). Move validation happens in microseconds via `chesslib` — no DB round-trip.
4. **Server-authoritative reality.** The backend is the absolute source of truth for move validation, clock sync, and lag compensation. The React client is an untrusted display layer.
5. **Aggressive JVM tuning.** All Spring Boot containers run on a single host. Default `JAVA_OPTS=-Xmx160m` per container (some services may use `-Xmx128m`).

---

## 4. Microservice Specifications

### `auth-service`
- **Owns:** `auth_db` — `users` table (identity metadata) + `credentials` table (password hashes).
- **Exposes:** `POST /api/auth/register`, `POST /api/auth/login`.
- **Rule:** Stateless JWT issuance. Gateway validates JWTs locally using shared secret (HMAC-SHA256). B-tree index on `username`.

### `matchmaking-service`
- **Owns:** Redis Sorted Sets — key `queue:{time_control}`, member `player_id`, score `elo_rating`.
- **Consumes:** Player queue-entry requests (WebSocket or REST long-poll).
- **Produces:** `MatchCreatedEvent` → `match-created` Kafka topic (fields: `gameId`, `whitePlayerId`, `blackPlayerId`, `timeControl`).
- **Eureka rule:** When provisioning a new game, do NOT use a load-balanced client. Query `DiscoveryClient` directly to pin both players to the same `game-service` instance (same JVM memory space).

### `game-service`
- **Owns:** Volatile JVM `ConcurrentHashMap` (active games) + Redis list per game (move log via `RPUSH` for crash recovery).
- **Consumes:** `MatchCreatedEvent` (instantiates game in memory).
- **WebSocket endpoint:** `/ws/game/{gameId}` — multiplexed for moves, chat, draw offers, heartbeats via `type` envelope field.
- **Produces:** `GameConcludedEvent` → `game-concluded` Kafka topic (fields: `gameId`, `whitePlayerId`, `blackPlayerId`, `result`, `termination`, `moves[]`).
- **Resiliency:** Every valid move triggers a non-blocking `RPUSH` to Redis. On restart, rebuild state from Redis log.

### `rating-service`
- **Owns:** `rating_db` — `player_ratings` table (Glicko-2 vectors: `player_id`, `rating`, `rating_deviation`, `volatility`) + Redis ZSET `leaderboard`.
- **Consumes:** `GameConcludedEvent`. Writes updated ratings to PostgreSQL then syncs the Redis leaderboard ZSET.

### `history-service`
- **Owns:** `history_db` — `games` table with a `JSONB` column mapping each move and clock delta sequentially.
- **Consumes:** `GameConcludedEvent`. Archives PGN and move telemetry.
- **Exposes:** `GET /api/history/player/{playerId}` (paginated).

---

## 5. Clock Synchronization & Lag Compensation

### Architectural axioms
- The client never determines remaining time or timeouts.
- Clocks are re-synchronized only on state mutations (move, resign, abort) — the server does not stream continuous ticks.
- Native WebSocket `Ping`/`Pong` binary frames are used exclusively for RTT measurement, independent of game payloads.

### 3-way move handshake

**Step 1 — Client move intent:**
```json
{ "t": "move", "d": { "u": "f1e2", "s": "ps", "a": 3 } }
```
`u` = UCI move, `a` = sequential action counter.

**Step 2 — Immediate server ACK** (before validation):
```json
{ "t": "ack", "d": 3 }
```
Suppresses loading spinners on the client.

**Step 3 — Authoritative broadcast** (to both players):
```json
{
  "t": "move", "v": 5,
  "d": {
    "uci": "f1e2", "san": "Be2",
    "fen": "...",
    "ply": 5,
    "clock": { "white": 162.68, "black": 178.56, "lag": 15 }
  }
}
```
`v` = ply/version counter (client requests full resync on mismatch). `clock.lag` = milliseconds refunded before compiling these balances.

### Backend clock engine
Track per game: `whiteTimeRemaining`, `blackTimeRemaining`, `lastMoveTimestamp`.
```
timeSpent = currentServerTimestamp - lastMoveTimestamp
newBalance = activePlayerTime - timeSpent + increment
```

### Lag compensation (anti-cheat)
- Server sends `Ping` frames every 1–2 s; browser auto-responds with native `Pong` (unkillable by extensions).
- If client-implied latency deviates significantly from the Ping baseline, discard the client metric.
- **Hard cap:** Regardless of measured latency, clock refunds never exceed **400 ms**.

### Server-authoritative timeouts
Use Spring `ThreadPoolTaskScheduler` (or a Hashed Wheel Timer). When a player's turn starts, schedule a task `X` seconds out where `X` = their remaining time. Cancel on valid move. If it fires, publish a timeout `GameConcludedEvent` to Kafka.

### Frontend clock rendering
- Use `requestAnimationFrame` — never `setInterval` (browsers throttle to 1 Hz when backgrounded).
```
visibleTime = serverBaselineTime - (Date.now() - localTurnStartTime)
```
- **Drift reconciliation on move broadcast:**
  - Drift > 500 ms: hard-snap to server value.
  - Drift ≤ 500 ms: smear at ±5% tick rate over ~1.5 s until converged.

### WebSocket multiplexing
All game traffic (moves, chat, draw offers) shares `/ws/game/{gameId}`. Use a `type` field as the envelope discriminator. Chat payloads are echoed in-memory and attached to the final Kafka event — no DB writes during gameplay.

---

## 6. Frontend Theme

```typescript
import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#0a7158' },
    secondary: { main: '#de0253' },
  },
});
```

---

## 7. Build & Run

### Server (Gradle)
```bash
cd server

# Build
./gradlew build

# Run locally
./gradlew bootRun

# Run all tests
./gradlew test

# Run a single test class
./gradlew test --tests "com.example.chess.SomeServiceTest"
```

### Client (npm)
```bash
cd client
npm install
npm run dev      # dev server
npm run build    # production build
npm run lint     # ESLint
```

### Full stack (Docker Compose)
```bash
# Build and start everything
docker-compose build
docker-compose up

# Graceful shutdown
docker-compose down

# Start only infrastructure (DB, cache, broker) for local service dev
docker-compose up postgres redis redpanda
```

### Useful dev commands
```bash
# Check Eureka registry
curl http://localhost:8761/eureka/apps

# Tail a service's logs
docker-compose logs -f game-service

# Redis CLI
docker-compose exec redis redis-cli
```
