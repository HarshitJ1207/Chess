This file provides guidance to AI assistants when working with code in this repository.

## Documentation Navigation

The detailed project documentation has been migrated and modularized into the `docs/` directory. When exploring or modifying the architecture, please refer to:

- **[README.md](README.md)**: Project overview, quick start, tech stack.
- **[System Architecture](docs/architecture.md)**: Service boundaries, DB per service, data ownership.
- **[Key User Flows](docs/flows.md)**: JWT auth flow, matchmaking flow, game handshake, WebSocket spec.
- **[Setup & Debugging](docs/setup.md)**: Local/Docker setup, redis/kafka/postgres debug commands.
- **[Technical Challenges](docs/challenges.md)**: OOM solutions, lag compensation, RAM-first state management.
- **[Active TODOs](docs/todos.md)**: Roadmap, refactoring backlog, security enhancements.

## Core Architectural Rules

These are non-negotiable constraints. Apply them to every code change.

1. **Database-per-service isolation.** Each microservice owns its own DB/schema. Never write cross-service joins. Share data only via Kafka events or synchronous REST.
2. **Event-driven write offloading.** The game loop (WebSocket + RAM) must never block on a PostgreSQL write. All heavy persistence (PGN saving, Elo calculation) is offloaded via `GameConcludedEvent` on Kafka.
3. **RAM-first game state.** Active games live entirely in the Game Service's JVM memory (`ConcurrentHashMap`). Move validation happens in microseconds via `chesslib` — no DB round-trip.
4. **Server-authoritative reality.** The backend is the absolute source of truth for move validation, clock sync, and lag compensation. The React client is an untrusted display layer.
5. **Aggressive JVM tuning.** All Spring Boot containers run on a single host. Default `JAVA_OPTS=-Xmx160m` per container (some services may use `-Xmx128m`; `game-service` uses `-Xmx256m` — a deliberate exception, since it holds all active game state in RAM).
6. **Sticky game routing.** Because active games live in one instance's RAM (rule 3), the gateway's `GameRoutingFilter` pins `/ws/game/**` requests to the owning instance via the `instanceUri` stored in the Redis claim `player:{username}:game`. Never route game traffic around this filter or drop `instanceUri` from the claim payload; if the claim is missing, the filter safely falls back to Eureka load balancing.
7. **Server-confirmed client state.** The WebSocket server immediately `ack`s each move (pre-validation) and follows with either a `move` broadcast or an `error` frame. The React client applies moves optimistically but MUST roll back to the last server-confirmed state on `error`. Unknown client messages get an `error`; the server replies `pong` to `ping` keepalives (client pings every 30s).

## Build & Verification

Run these before committing. There is no `dockerBuild` Gradle task — do not pass `-x dockerBuild`.

```bash
# Server: compiles all microservices and runs every unit test
cd server && ./gradlew build

# Client: lint and production build
cd client && npm run lint && npm run build
```


