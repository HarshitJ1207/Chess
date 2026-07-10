# Key User Flows

This document details the exact end-to-end user flows, sequence diagrams, request routing, and data store mutations across the platform, illustrating how **Nginx**, **gateway-service**, **Eureka**, **microservices**, **Redis**, and **Kafka** interact.

---

## 1. Registration, Login, and Guest Access

Authentication requests are public endpoints. The `gateway-service` forwards them to the `auth-service` without performing JWT validation.

### 1a. User Registration (Public)
1. The client sends user details to Nginx.
2. Nginx routes the request to the `gateway-service` (port `8080`).
3. The gateway queries Eureka for the `auth-service` and routes the request (`lb://AUTH-SERVICE`).
4. The `auth-service` inserts the user details into PostgreSQL `auth_db`, hashes the password with BCrypt, signs a JWT using the shared `JWT_SECRET`, and returns it.

```
Browser              Nginx           gateway-service      auth-service        auth_db
   │                   │                    │                  │                 │
   │──POST /register──►│                    │                  │                 │
   │  {u, e, p}        │──(Proxy /api)─────►│                  │                 │
   │                   │  Port 8080         │──(Forward, lb)──►│                 │
   │                   │                    │  Port 8081       │──INSERT users──►│
   │                   │                    │                  │──INSERT creds──►│
   │                   │                    │                  │◄──201 Token─────│
   │                   │                    │◄──201 Response───│                 │
   │                   │◄──201 Response─────│                  │                 │
   │◄──201 Response────│                    │                  │                 │
   │  (Saves JWT)      │                    │                  │                 │
```

---

### 1b. User Login (Public)
1. The client sends login credentials to Nginx.
2. Nginx forwards the request through the gateway to `auth-service`.
3. The `auth-service` verifies the password against the BCrypt hash from `auth_db`.
4. Upon successful validation, it issues a signed JWT token containing claims: `sub` (username) and `anonymous: false`.

```
Browser              Nginx           gateway-service      auth-service        auth_db
   │                   │                    │                  │                 │
   │────POST /login───►│                    │                  │                 │
   │  {u, p}           │──(Proxy /api)─────►│                  │                 │
   │                   │  Port 8080         │──(Forward, lb)──►│                 │
   │                   │                    │  Port 8081       │──SELECT + BCrypt►│
   │                   │                    │                  │◄──200 Token─────│
   │                   │                    │◄──200 Response───│                 │
   │                   │◄──200 Response─────│                  │                 │
   │◄──200 Response────│                    │                  │                 │
   │  (Saves JWT)      │                    │                  │                 │
```

---

### 1c. Guest / Anonymous Authentication (Public)
1. The client hits the "Skip Login" action.
2. Nginx forwards the request through the gateway to `auth-service` (`POST /api/auth/anonymous`).
3. The `auth-service` generates a transient username (e.g. `anon-d2e8f1a2`) and signs a transient JWT with the claim `anonymous: true`.
4. The client saves this token exactly like a standard user, allowing seamless gameplay without an account.

```
Browser              Nginx           gateway-service      auth-service
   │                   │                    │                  │
   │──POST /anonymous─►│                    │                  │
   │                  │──(Proxy /api)─────►│                  │
   │                  │  Port 8080         │──(Forward, lb)──►│
   │                  │                    │  Port 8081       │  Generates UUID:
   │                  │                    │                  │  anon-<UUID-prefix>
   │                  │                    │                  │  Issues JWT with
   │                  │                    │                  │  claim anonymous=true
   │                  │                    │                  │◄──200 Token──────
   │                  │                    │◄──200 Response───│
   │                  │◄──200 Response─────│                  │
   │◄──200 Response───│                    │                  │
   │  (Saves JWT)      │                    │                  │
```

---

## 2. Matchmaking Queue (Authenticated vs. Anonymous)

The `gateway-service` intercepts matchmaking requests, extracts the JWT, verifies its signature locally using `JWT_SECRET`, and injects custom headers `X-Username` and `X-Anonymous` downstream.

### 2a. Joining the Queue (Non-blocking)
1. Browser requests to join the queue.
2. The gateway validates the JWT signature, injects `X-Username` and `X-Anonymous`, and routes to `matchmaking-service`.
3. The `matchmaking-service` checks Redis key `player:{username}:game` to verify the player isn't in an active game.
4. If not in a game, it inserts the player into the appropriate Redis Sorted Set:
   - **Registered Queue:** `queue:{timeControl}` (Score = Glicko-2 rating / ELO)
   - **Anonymous Queue:** `queue:anon:{timeControl}` (Score = default ELO)

```
Player A            Nginx           gateway-service     matchmaking-service          Redis           Kafka
   │                  │                    │                     │                     │               │
   │──POST /queue ────►│                    │                     │                     │               │
   │  Auth: Bearer JWT│──(Proxy /api)─────►│                     │                     │               │
   │                  │  Port 8080         │                     │                     │               │
   │                  │                    │[JwtValidationFilter]│                     │               │
   │                  │                    │Verifies JWT locally │                     │               │
   │                  │                    │Injects Headers:     │                     │               │
   │                  │                    │- X-Username         │                     │               │
   │                  │                    │- X-Anonymous        │                     │               │
   │                  │                    │                     │                     │               │
   │                  │                    │──(Forward, lb)─────►│                     │               │
   │                  │                    │  Port 8082          │─GET player:A:game──►│               │
   │                  │                    │                     │◄─(null)─────────────│               │
   │                  │                    │                     │                     │               │
   │                  │                    │                     │─ZADD queue:A or ────►│               │
   │                  │                    │                     │  queue:anon:A ──────│               │
   │                  │                    │                     │  score=elo, mem=A   │               │
   │                  │                    │◄──200 {QUEUED} ─────│                     │               │
   │                  │◄──200 {QUEUED} ────│                     │                     │               │
   │◄──200 {QUEUED} ──│                    │                     │                     │               │
   │ (Starts Polling) │                    │                     │                     │               │
```

---

### 2b. The Pairing Loop & Kafka Offloading
A scheduler in the `matchmaking-service` runs every 10 seconds to scan the active Redis queues.

1. It pulls players from the queue ZSET (e.g. `queue:anon:3+0` or `queue:3+0`) sorted by score.
2. Adjacent players within ELO range are paired.
3. It atomically removes both players from the ZSET via `ZREM`.
4. It publishes a `MatchRequest` payload on the Redpanda/Kafka topic **`match-request`**.

```
matchmaking-service               Redis                                         Kafka
      │                             │                                             │
      │──ZRANGEBYSCORE queue:3+0 ──►│ (Query active queue matching ELO windows)    │
      │◄──[Player A, Player B]──────│                                             │
      │                             │                                             │
      │ (If paired within ELO range)│                                             │
      │──ZREM queue:3+0, A, B ──────►│ (Remove atomically from Redis ZSET queue)     │
      │◄── 1 (each removed successfully)                                          │
      │                             │                                             │
      │──PRODUCE match-request ─────┼────────────────────────────────────────────►│
      │  {p1, p2, tc, anonymous}    │                                             │
```

---

### 2c. Client Redirection (Polling)
While waiting, the browser polls the `POST /api/matchmaking/queue` endpoint every 2 seconds.
When a poll request is received, the `matchmaking-service` checks if the key `player:{username}:game` exists in Redis:
- If the `game-service` has already consumed the match request and set up the game in RAM, it will have written `player:{username}:game` in Redis.
- The `matchmaking-service` reads this JSON payload, detects the active game, and immediately returns a `MATCHED` response.
- Otherwise, it returns `QUEUED`, and the client keeps polling.

```
Player A (next poll) Nginx          gateway-service     matchmaking-service          Redis
   │                  │                    │                     │                     │
   │──POST /queue ────►│                    │                     │                     │
   │  (Poll status)   │──(Proxy /api)─────►│                     │                     │
   │                  │  Port 8080         │[JwtValidationFilter]│                     │
   │                  │                    │Injects Headers      │                     │
   │                  │                    │──(Forward, lb)─────►│                     │
   │                  │                    │                     │─GET player:A:game──►│
   │                  │                    │                     │◄─{"gameId":"...", ──│
   │                  │                    │                     │   "myColor":"white",│
   │                  │                    │                     │   "opponent":...}   │
   │                  │                    │◄──200 {MATCHED} ────│                     │
   │                  │◄──200 {MATCHED} ───│                     │                     │
   │◄──200 {MATCHED} ─│                    │                     │                     │
   │ (navigates to /game/{gameId})         │                     │                     │
```

---

## 3. Game Initialization & WebSocket Handshake

Once matched, the client opens a WebSocket connection to start the game loop.

### 3a. Game Creation in JVM Memory
1. The `game-service` consumes the `match-request` event from Redpanda.
2. It assigns player colors (white vs. black) and generates a unique game ID.
3. It performs an atomic claim on both players in Redis: `setIfAbsent("player:{username}:game", playerMetadata, 24h)`. If either player is already in a game, the match is aborted.
4. It creates the `GameState` in RAM (`ConcurrentHashMap`) and registers the game in the JVM memory of that specific `game-service` instance.
5. It writes game metadata to the Redis Hash: `game:{gameId}:meta`.

---

### 3b. WebSocket Upgrading & Handshake Interception
Browsers do not support custom headers on native WebSockets, so the client sends the JWT inside the query parameter `?token=<JWT>`.

1. **Nginx** handles SSL termination and forwards the WebSocket upgrade request to `gateway-service` on port `8080`.
2. **Gateway** matches the `/ws/game/**` route. The `JwtValidationFilter` extracts the token from the query parameters, validates it, and injects `X-Username` and `X-Anonymous` headers before forwarding to the `game-service`.
3. **Game Service** executes `JwtHandshakeInterceptor` to read the `X-Username` header and assigns attributes to the WebSocket session.
4. It upgrades the connection to WebSocket (`101 Switching Protocols`) and triggers `GameWebSocketHandler`:
   - Validates that the game is loaded in JVM RAM.
   - Verifies the user is a player in this game.
   - Saves the WebSocket session to `GameSessionRegistry` and broadcasts the game's initial state.

```
Browser              Nginx           gateway-service        game-service
   │                   │                    │                     │
   │──GET /ws/game/123─►│                    │                     │
   │  ?token=<JWT>     │──(Proxy /ws)──────►│                     │
   │  Upgrade: ws      │  Port 8080         │                     │
   │                   │                    │[JwtValidationFilter]│
   │                   │                    │Extracts ?token      │
   │                   │                    │Verifies JWT locally │
   │                   │                    │Injects Headers      │
   │                   │                    │                     │
   │                   │                    │──(Forward, lb)─────►│
   │                   │                    │  Port 8083          │[JwtHandshakeInterceptor]
   │                   │                    │                     │Reads X-Username
   │                   │                    │                     │Puts user into session
   │                   │                    │                     │Upgrade Success (101)
   │                   │                    │◄──101 Switching─────│
   │                   │◄──101 Switching────│                     │
   │◄──101 Switching───│                    │                     │
```

---

## 4. Game Loop (3-Way Handshake & Move Persistence)

Every move made in active play follows a low-latency 3-way handshake design to prevent lag and keep clocks synced.

1. **Client** sends the move (`t: "move"`, `d: { u: "e2e4", a: 1 }`).
2. **Game Service** immediately sends back a quiet **ACK** (`t: "ack"`, `d: 1`) to suppress the client-side loading spinner, providing a lag-free visual response.
3. **Game Service** validates the move using `chesslib`.
4. If legal, it logs the move to the Redis List `game:{gameId}:moves` (used for backup/crash recovery).
5. It calculates clocks (subtracting elapsed time and adding the time control increment) and broadcasts the authoritative state update to both players.

```
White Browser               game-service                Redis              Black Browser
     │                           │                        │                     │
     │──WS move ────────────────►│                        │                     │
     │  {t:"move",               │                        │                     │
     │   d:{u:"e2e4", a:1}}      │                        │                     │
     │                           │                        │                     │
     │◄── ACK ───────────────────│ (Immediate, before     │                     │
     │  {t:"ack", d:1}           │  validation)           │                     │
     │                           │                        │                     │
     │                           │ Validate via chesslib  │                     │
     │                           │                        │                     │
     │                           │──RPUSH game:123:moves──►                     │
     │                           │  UCI Move record       │                     │
     │                           │                        │                     │
     │◄── Broadcast ─────────────┼────────────────────────┼────────────────────►│
     │  {t:"move", v:1,          │                        │                     │
     │   d:{uci, san, fen...}}   │                        │                     │
```

---

## 5. Game Conclusion & Persistence Offloading

When a game ends (checkmate, timeout, draw, resignation, abort), persistence operations are offloaded asynchronously via Redpanda/Kafka to avoid blocking the WebSocket thread.

### 5a. Authenticated Matches
1. The `game-service` concludes the game, clears the `player:{username}:game` claim keys in Redis, and removes the game state from RAM.
2. It publishes a `GameConcludedEvent` on the Redpanda topic `game-concluded`.
3. **`rating-service`** consumes the event, runs Glicko-2 rating updates, persists ratings to `player_ratings` in `rating_db`, and updates the Redis `leaderboard` ZSET.
4. **`history-service`** consumes the event, generates the PGN format string, and records the match history in `games` table of `history_db`.
5. Redis keys `game:{gameId}:meta` and `game:{gameId}:moves` expire after 1 hour.

```
game-service          Kafka           rating-service    history-service
     │                  │                   │                 │
     │  (Concludes)     │                   │                 │
     │──PRODUCE ────────►│                   │                 │
     │  game-concluded   │                   │                 │
     │  {gameId, w, b,   │                   │                 │
     │   result,         │                   │                 │
     │   termination,    │                   │                 │
     │   moves[]}        │                   │                 │
     │                  │                   │                 │
     │                  │──CONSUME ─────────►│                 │
     │                  │                   │  Glicko-2 calc  │
     │                  │                   │──UPDATE ratings─► (rating_db)
     │                  │                   │──ZADD leaderboard (Redis ZSET)
     │                  │                   │                 │
     │                  │──CONSUME ──────────────────────────►│
     │                  │                   │                 │  Archive PGN
     │                  │                   │                 │──INSERT games
     │                  │                   │                 │  (history_db)
```

### 5b. Guest / Anonymous Matches
1. The `game-service` concludes the game, deletes the transient guest claim keys `player:anon-{uuid}:game` in Redis, and removes the game state from RAM.
2. **It does NOT publish a Kafka event.** Since the game is anonymous, it skips Redpanda entirely.
3. The `rating-service` and `history-service` are completely bypassed, preventing rating modifications or database bloat in PostgreSQL.
4. Redis keys `game:{gameId}:meta` and `game:{gameId}:moves` expire after 1 hour.
