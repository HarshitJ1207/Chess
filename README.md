# Chess Microservices Platform

A highly decoupled, distributed chess platform inspired by Lichess.

## Key Features
- **Microservice Isolation:** Strict database-per-service isolation ensuring high decoupling.
- **Event-Driven Architecture:** Fast, non-blocking game loops with offloaded persistence via Redpanda (Kafka).
- **RAM-First Game State:** Active games live entirely in JVM memory for microsecond move validation using `chesslib`.
- **Server-Authoritative Clock:** Strictly synchronized game clock with backend anti-cheat lag compensation.

## Tech Stack
- **Services:** Java 21 + Spring Boot 4
- **Validation:** `chesslib`
- **Data Stores:** PostgreSQL 16, Redis 7
- **Event Streaming:** Redpanda
- **Service Discovery:** Netflix Eureka
- **API Gateway:** Nginx
- **Frontend:** React 19 + Vite + MUI + react-chessboard

## Documentation
- [System Architecture](docs/architecture.md)
- [System Flows & Logic](docs/flows.md)
- [Setup & Infrastructure](docs/setup.md)
- [Technical Challenges](docs/challenges.md)
- [Roadmap & TODOs](docs/todos.md)

## Quick Start
To spin up the entire application stack:
```bash
docker compose up --build
```
*Note: For low-RAM environments (like t3.small instances), use the sequential `build_all.sh` script to avoid OOM issues.*
