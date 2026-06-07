# Backend: Master Architecture Document

## 1. Project Overview & Mission
* **Goal:** Build a highly decoupled, distributed chess platform inspired by the Lichess architecture.
* **Primary Focus:** Ultra-low latency game loops, event-driven persistence, and strict microservice isolation.
* **Deployment Target:** A single AWS EC2 instance (resource-constrained) running an internal Docker Compose virtual network.

## 2. Global Tech Stack
* **Core Framework:** Java + Spring Boot
* **Chess Engine / Validation:** `chesslib` (bhlangonisan)
* **Relational & Document Store:** PostgreSQL 16 (Utilizing `JSONB` for game telemetry)
* **Real-time Pub/Sub & Cache:** Redis 7
* **Event Streaming:** Redpanda (Lightweight, single-binary Apache Kafka alternative)
* **Service Discovery:** Netflix Eureka
* **API Gateway / Reverse Proxy:** Nginx

## 3. Core Architectural Directives
When generating code for this project, you MUST adhere to the following architectural rules:
1. **Strict Database-per-Service Isolation:** Each microservice manages its own database/schema. You may never write queries that join tables across different microservices. Data sharing must happen via Kafka events or synchronous REST calls.
2. **Event-Driven Write Offloading:** The critical game loop (WebSockets + RAM) must NEVER wait for a disk write to PostgreSQL. All heavy persistence (saving PGNs, calculating Elos) must be offloaded asynchronously via Kafka events (e.g., `GameConcludedEvent`).
3. **RAM-First Game State:** Active chess games live entirely in the Game Service's memory (`ConcurrentHashMap`). Moves are validated in-memory in microseconds. 
4. **Server-Authoritative Reality:** The backend is the absolute source of truth for move validation, clock synchronization, and lag compensation. The React client is treated as an untrusted display layer.
5. **Aggressive JVM Tuning:** Because this entire distributed cluster runs on a single host machine, all Spring Boot container instances must be generated with strict memory limits (`JAVA_OPTS=-Xmx128m` or `-Xmx160m`).

## 4. Microservice Specifications

### Service 1: Auth & User Service (`auth-service`)
* **Core Responsibility:** Single source of truth for identities, user profiles, and security credentials.
* **Database Target:** `auth_db` (PostgreSQL)
  * `users` table: Identity metadata (`id`, `username`, `email`).
  * `credentials` table: Secure access hashes (`user_id`, `password_hash`).
* **Communication Patterns:**
  * **Inbound:** Synchronous REST endpoints (`POST /api/auth/register`, `POST /api/auth/login`).
  * **Inter-Service:** Synchronous REST endpoint for token validation (`GET /api/auth/validate`) used by other services.
* **Developer Directive:** Keep this stateless. Use standard JWT issuance. Ensure `username` lookups are fast using standard B-tree indexing.

### Service 2: Matchmaking Service (`matchmaking-service`)
* **Core Responsibility:** Manage player queues and group players into balanced matches based on Elo ratings and target time controls.
* **Data Store Target:** Redis (`chess-cache`)
  * Data Structure: Redis Sorted Sets (`ZSET`). Key: `queue:{time_control}`, Member: `player_id`, Score: `elo_rating`.
* **Communication Patterns:**
  * **Inbound:** WebSocket or REST long-polling connection from the gateway to accept queue entry intents.
  * **Outbound:** Asynchronous event producer. Drops a `MatchCreatedEvent` into Kafka when a valid pair is formed.
* **Kafka Output Payload (`match-created` topic):**
  ```json
  {
    "gameId": "UUID",
    "whitePlayerId": "UUID",
    "blackPlayerId": "UUID",
    "timeControl": "3+2"
  }
  ```

### Service 3: Game Coordination Service (`game-service`)

* **Core Responsibility:** Low-latency stateful node holding active chess games inside JVM memory using `chesslib`.
* **Data Store Target:** Volatile RAM + Redis (`chess-cache`) for transactional durability.
* **Communication Patterns:**
  * **Inbound (Async):** Listens to Kafka for `MatchCreatedEvent` to instantiate the game state in memory.
  * **Inbound (Real-time):** Multiplexed WebSockets (`/ws/game/{gameId}`) handling client-side game interactions: moves, chats, and heartbeats.
  * **Outbound (Async):** Fires a `GameConcludedEvent` into Kafka immediately upon game termination.
* **Resiliency Logic:** Every valid move received over the WebSocket must execute a non-blocking `RPUSH` to Redis containing the move log. If the container crashes, the backup worker rebuilds the state instantly from Redis.
* **Kafka Output Payload (`game-concluded` topic):**
  ```json
  {
    "gameId": "UUID",
    "whitePlayerId": "UUID",
    "blackPlayerId": "UUID",
    "result": "WHITE_WIN | BLACK_WIN | DRAW",
    "termination": "CHECKMATE | RESIGNATION | TIMEOUT",
    "moves": ["e2e4", "e7e5", "g1f3", "..."]
  }
  ```



### Service 4: Rating & Leaderboard Service (`rating-service`)

* **Core Responsibility:** Asynchronously compute skill tier fluctuations and manage the global top-player rankings.
* **Database Target:** `rating_db` (PostgreSQL) + Redis for live lists.
  * `player_ratings` table: Glicko-2 vectors (`player_id`, `rating`, `rating_deviation`, `volatility`).
  * Redis Structure: Global Leaderboard `ZSET`. Key: `leaderboard`, Member: `username`, Score: `rating`.
* **Communication Patterns:**
  * **Inbound (Async):** Listens to Kafka for `GameConcludedEvent`.
  * **Outbound:** Updates the Redis sorted set after saving calculated metrics to PostgreSQL.



### Service 5: History & PGN Archive Service (`history-service`)

* **Core Responsibility:** Aggregate raw match metrics, transform them into standardized chess PGN representations, and expose historical record lookups.
* **Database Target:** `history_db` (PostgreSQL)
  * `games` table: Game history metadata with a `JSONB` document field mapping every move and clock delta sequentially.
* **Communication Patterns:**
  * **Inbound (Async):** Listens to Kafka for `GameConcludedEvent`.
  * **Inbound (Sync):** REST endpoint (`GET /api/history/player/{playerId}`) to serve paginated dashboard arrays.


## 5. Cross-Cutting Concerns & Game Loop Mechanics

### A. The Server-Authoritative Clock
* **Rule:** The frontend React client is an untrusted display layer. It NEVER dictates the remaining time.
* **Mechanism:** 
  * The `game-service` tracks `whiteTimeRemaining`, `blackTimeRemaining`, and `lastMoveTimestamp` in its local RAM.
  * Time Spent = `currentServerTimestamp` - `lastMoveTimestamp`.
  * The server applies the time control increment, subtracts the delta, and broadcasts the new authoritative clock balances down to the clients.
* **Timeouts:** A lightweight background thread (`ThreadPoolTaskScheduler` or Hashed Wheel Timer) must be scheduled for the exact moment the active player's clock hits zero. If they move, cancel the task. If it triggers, the server autonomously publishes a timeout `GameConcludedEvent`.

### B. Trusted Lag Compensation
* **Vulnerability Prevention:** Clients will attempt to send fake timestamps (`d.l = 500ms`) to gain infinite time.
* **Mechanism:**
  * The `game-service` MUST utilize native, low-level WebSocket `Ping`/`Pong` binary control frames (which cannot be intercepted or modified by browser extensions) to establish a background RTT (Round Trip Time) baseline.
  * When a client claims network lag, the server cross-references it against the native Ping baseline.
  * **The Hard Cap:** Regardless of the claimed lag or Ping baseline, lag compensation refunded to the clock must never exceed a strict hard cap (e.g., `400ms`).

### C. Netflix Eureka Routing Rules
* **Standard Discovery:** Stateless HTTP calls (e.g., `matchmaking-service` verifying a token with `auth-service`) should utilize standard `@LoadBalanced` WebClients to automatically round-robin traffic.
* **Pinned State Bypassing:** When `matchmaking-service` provisions a new game, it must NOT use a load-balanced client. It must query the `DiscoveryClient` to fetch a specific `game-service` instance URL, bypassing round-robin to ensure both players are routed to the exact same JVM memory space.

### D. Multiplexed WebSockets
* **Chat Handling:** Do not build a separate chat microservice. The `/ws/game/{gameId}` connection handles all traffic.
* **Data Envelopes:** Use a `type` field in the JSON payload (e.g., `type: "MOVE"`, `type: "CHAT"`, `type: "DRAW_OFFER"`). Chat payloads are simply echoed to the opponent in real-time and briefly held in memory to be attached to the final Kafka event, keeping PostgreSQL database writes to an absolute minimum during gameplay.


## 6. Comprehensive Time Handling & Clock Synchronization

### A. Core Architectural Axioms
1. **Zero Client Trust:** The frontend React client is an untrusted presentation layer. It never determines remaining time, nor does it decide when a player has run out of time (flagged).
2. **State-Driven Sync:** The server does not stream continuous clock ticks. Clocks are updated and hard-synchronized strictly when a state mutation occurs (e.g., a move is executed, a game is aborted, or a player resigns).
3. **Decoupled Pings:** Native WebSocket binary `Ping` and `Pong` frames are utilized strictly to calculate network Round-Trip Time (RTT). They operate completely independent of game clock payloads.

---

### B. Network Messaging Lifecycle & Payload Contracts

The real-time time-tracking flow operates in a strict 3-way handshake every time a piece is moved:

#### Step 1: Client Move Intent (`t: "move"`)
When a user plays a move on the local board, the client captures the current local timestamp, creates an incremental action/acknowledgment counter (`a`), and fires a lightweight payload:
```json
{
  "t": "move",
  "d": {
    "u": "f1e2",
    "s": "ps",
    "a": 3
  }
}
```

* `u`: The move in Universal Chess Interface (UCI) notation.
* `a`: The sequential client action identifier to track transaction round-trips.

#### Step 2: Immediate Server Acknowledgment (`t: "ack"`)

Upon reading the socket frame, the server instantly reflects an acknowledgment packet matching the action ID back to the sender before running heavy validation logic:

```json
{
  "t": "ack",
  "d": 3
}
```

* **Purpose:** Instructs the UI layer to suppress network timeout indicators or loading spinners, confirming the packet successfully hit the cloud instance gateway.

#### Step 3: Authoritative Game State & Clock Broadcast

After executing the move via `chesslib` and resolving time accounting, the server broadcasts the new absolute truth to both players:

```json
{
  "t": "move",
  "v": 5,
  "d": {
    "uci": "f1e2",
    "san": "Be2",
    "fen": "rnbqkbnr/pp2pppp/2p5/3p4/4P3/5N2/PPPPBPPP/RNBQK2R",
    "ply": 5,
    "clock": {
      "white": 162.68,
      "black": 178.56,
      "lag": 15
    }
  }
}
```

* `v`: State Version / Ply Counter. Used by the client to detect packet drops and force full state resynchronization if a version mismatch occurs.
* `clock.white` & `clock.black`: Authoritative remaining balances represented as precise floating-point seconds.
* `clock.lag`: The calculated network latency window (in milliseconds) that the server successfully refunded to the player's clock before compiling the current balances.

---

### C. Backend Implementation Specifications

#### 1. Delta Timing Engine

The `game-service` tracks active games in-memory using three core primitives per match: `whiteTimeRemaining`, `blackTimeRemaining`, and `lastMoveTimestamp`.

* When a move packet lands, the server captures `currentServerTimestamp`.
* **Elapsed Calculation:** $\text{Time Spent} = \text{currentServerTimestamp} - \text{lastMoveTimestamp}$
* **Deduction Rule:** Subtract $\text{Time Spent}$ from the active player's clock, add the time control increment (e.g., +2s), update `lastMoveTimestamp` to `currentServerTimestamp`, and broadcast.

#### 2. Bounded Trust & Lag Compensation

To prevent cheaters from modifying client-side packets to fake infinite latency:

* **The Baseline:** The server continually sends low-level WebSocket `Ping` control frames every 1 to 2 seconds. The browser automatically responds with native `Pong` frames. JavaScript extensions cannot intercept or manipulate these frames.
* **The Validation:** When a move packet arrives, the server cross-references the client's implied latency against the native background RTT baseline.
* **The Clamp:** If the client's implied latency heavily deviates from the baseline RTT, the server discards the client metric and calculates elapsed time strictly via server timestamps. Regardless of true network conditions, the refunded lag compensation is capped at a hard maximum threshold (e.g., `400ms`).

#### 3. Passive Flagging (Server-Authoritative Timeouts)

To catch a player who abandons a match without running an expensive loop per game:

* When a player's turn starts, schedule a single-use background task using Spring's `ThreadPoolTaskScheduler` or a Hashed Wheel Timer.
* Set the task execution time precisely to $X$ seconds out, where $X$ is the active player's remaining clock balance.
* If a valid move packet is processed before the task fires, cancel the scheduled task.
* If the task fires, the server automatically declares a timeout victory for the opponent and pushes a `GameConcludedEvent` to Kafka.

---

### D. Frontend Presentation & Reconciliation Logic

#### 1. High-Precision Local Ticking

* **Rule:** Never use standard JavaScript `setInterval()` to count down the clock. Browsers heavily throttle intervals down to 1Hz when tabs are backgrounded or minimized, causing catastrophic clock drift.
* **Implementation:** Use a continuous loop powered by `requestAnimationFrame()`. When a state update sets a turn active, record `localTurnStartTime = Date.now()`.
* **Formula:** Render the visible clock on every frame via:

$$\text{Visible Time} = \text{Server Baseline Time} - (\text{Date.now()} - \text{localTurnStartTime})$$

#### 2. Clock Smearing (Drift Reconciliation)

When a move broadcast arrives from the server, the local UI clock will naturally deviate slightly from the server's floating-point numbers due to paint loops and rendering overhead. Do not execute an instantaneous hard reset for minor drift, as it creates jarring visual jumps. Use a threshold algorithm:

* **Hard Snap (> 500ms Drift):** If the drift is severe (indicates the user switched tabs or locked their device), forcibly overwrite the React clock state with the exact server metrics instantly.
* **Smooth Smearing (< 500ms Drift):** If the drift is minor, apply clock smearing. Artificially accelerate or decelerate the local visual countdown tick-rate by a tiny fraction (e.g., $\pm 5\%$) over the next 1.5 seconds until the frontend timeline seamlessly merges with the server baseline.


## 7. Frontend Development

**Status:** Frontend development is deferred. Initially build and test the backend in isolation.

### Stack & Tools
* **Framework:** React
* **Build Tool:** Vite
* **UI Library:** Material-UI (MUI)
* **Styling:** Tailwind CSS
* **Chess UI:** react-chessboard

### Theme Configuration
```typescript
import { ThemeOptions } from '@material-ui/core/styles/createMuiTheme';

export const themeOptions: ThemeOptions = {
  palette: {
    type: 'dark',
    primary: {
      main: '#0a7158',
    },
    secondary: {
      main: '#de0253',
    },
  },
};
```

### Client Responsibilities
* Single-page application (SPA) with minimal state management during gameplay.
* Display layer only — never trust client-side time, move validation, or score calculations.
* WebSocket connection to `/ws/game/{gameId}` for real-time move broadcasting and chat.
* Clock synchronization via server-sent authoritative time updates (see Section 6 for protocol).


## 8. Deployment & Local Development

### Prerequisites
* Docker and Docker Compose
* Java 21 (JDK)
* Maven 3.9+
* Node.js 20+

### Build & Run
```bash
# Build all services
docker-compose build

# Start the entire stack (PostgreSQL, Redis, Redpanda, all Spring Boot services, Nginx)
docker-compose up

# Shut down gracefully
docker-compose down
```

### Local Development (Without Docker)
```bash
# Start only PostgreSQL, Redis, Redpanda via Docker
docker-compose up postgres redis redpanda

# In each service directory, run:
mvn clean install
mvn spring-boot:run -Dspring-boot.run.arguments="--server.port=808X"
```

### Testing
```bash
# Run all tests
mvn test

# Run a single service's tests
cd auth-service && mvn test

# Integration tests (requires services running)
mvn verify
```

### Common Development Commands
```bash
# Check service health via Eureka (http://localhost:8761)
curl http://localhost:8761/eureka/apps

# Tail logs from a specific service
docker-compose logs -f game-service

# Access Redis CLI (if running in Docker)
docker-compose exec redis redis-cli
```


## 9. Key Implementation Notes

### Memory Constraints
All JVM services are tuned for single-host deployment. Default `JAVA_OPTS=-Xmx160m` per container.

### Game State Recovery
If `game-service` crashes, Redis backup logs (`RPUSH` move history) enable instant state reconstruction. No transactional loss of move data.

### WebSocket Multiplexing
All game interactions (moves, chats, draw offers) multiplex over a single `/ws/game/{gameId}` connection using message `type` envelopes.

### Lag Compensation Hard Cap
Regardless of measured network latency, clock refunds never exceed 400ms (configurable per deployment). 