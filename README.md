# Chess Microservices Platform

A highly decoupled, distributed chess platform inspired by Lichess.

## Key Features
- **Microservice Isolation:** Strict database-per-service isolation ensuring high decoupling.
- **Event-Driven Architecture:** Fast, non-blocking game loops with offloaded persistence via Redpanda (Kafka).
- **RAM-First Game State:** Active games live entirely in JVM memory for microsecond move validation using `chesslib`.
- **Server-Authoritative Clock:** Strictly synchronized game clock with backend anti-cheat lag compensation.

## Tech Stack
- **Services:** Java 21 + Spring Boot 3.5
- **Validation:** `chesslib`
- **Data Stores:** PostgreSQL 16, Redis 7
- **Event Streaming:** Redpanda
- **Service Discovery:** Netflix Eureka
- **API Gateway:** Spring Cloud Gateway (with sticky game routing via Redis)
- **Edge Proxy:** Nginx (static frontend, TLS, reverse proxy)
- **Inter-service Calls:** OpenFeign (e.g. matchmaking → rating)
- **Frontend:** React 19 + Vite + MUI + react-chessboard

## Documentation
- [System Architecture](docs/architecture.md)
- [System Flows & Logic](docs/flows.md)
- [Setup & Infrastructure](docs/setup.md)
- [Technical Challenges](docs/challenges.md)
- [Roadmap & TODOs](docs/todos.md)
- [Matchmaking Enterprise Readiness Audit](docs/audits/matchmaking_enterprise_readiness_audit.md) - **critical remediation required before production scale-out**
- [Sticky Routing Enterprise Readiness Audit](docs/audits/sticky_routing_enterprise_readiness_audit.md) - current implementation and production-readiness findings

## Quick Start
To spin up the entire application stack:
```bash
cp .env.example .env
# Set JWT_SECRET in .env to a strong secret (openssl rand -base64 48).
docker compose up --build
```
See [Setup & Infrastructure](docs/setup.md) for sequential builds and the private host setup workflow.
