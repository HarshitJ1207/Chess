# Technical Challenges & Solutions

## 1. Out Of Memory (OOM) on Resource-Constrained Environments
**Challenge:** Deploying 11 containers concurrently on a `t3.small` instance (2GB RAM) causes Docker build scripts to consume available memory, triggering OOM kills.
**Solution:**
- Configured 2GB swap space on the instance.
- Implemented `build_all.sh` to enforce strictly sequential image building, preventing multiple heavy Java compilation processes from overlapping.
- Aggressively tuned Spring Boot containers with `JAVA_OPTS=-Xmx160m` to guarantee predictable memory limits.

## 2. Low-Latency Game State Management
**Challenge:** Writing move history to a traditional relational database blockingly inside a WebSocket loop introduces unacceptable latency, especially for Bullet/Blitz time controls.
**Solution:**
- **RAM-First Design:** Active games live entirely in JVM memory (`ConcurrentHashMap`) within the `game-service`.
- **Sub-Millisecond Validation:** `chesslib` performs logic validation in memory.
- **Fast Event Sourcing:** For crash recovery, moves are appended to a Redis List via non-blocking `RPUSH`.
- Heavy writes (PGN generation, Elo calculation) are offloaded to Kafka only *after* the game concludes.

## 3. Server-Authoritative Clock Synchronization
**Challenge:** Browsers throttle `setInterval` for background tabs. Trusting the client's clock enables cheating and causes time-sync drifts.
**Solution:**
- The backend is the absolute source of truth.
- Timeouts are strictly enforced via Server-side schedulers (`ThreadPoolTaskScheduler`).
- **Lag Compensation:** The server measures move-to-move latency and refunds lost network time (hard-capped at 400ms per move).
- The client merely *renders* the clock using `requestAnimationFrame`, synchronizing against the backend baseline received via WebSocket broadcasts.

## 4. Microservice Decoupling & Isolation
**Challenge:** Services sharing a monolithic database usually end up tightly coupled via cross-table JOINs, degrading maintainability.
**Solution:**
- Strict **Database-per-service** model.
- `auth_db`, `rating_db`, and `history_db` are isolated schemas.
- Data required across boundaries is propagated via Kafka events (e.g., `rating-service` updating scores upon consuming `game-concluded` events).
