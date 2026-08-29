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
5. **Aggressive JVM tuning.** All Spring Boot containers run on a single host. Default `JAVA_OPTS=-Xmx160m` per container (some services may use `-Xmx128m`).


