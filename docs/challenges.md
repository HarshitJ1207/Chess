# Technical Challenges & Solutions

## 1. Out Of Memory (OOM) on Resource-Constrained Environments
**Challenge:** Deploying 11 containers concurrently on a `t3.small` instance (2GB RAM) causes Docker build scripts to consume available memory, triggering OOM kills.
**Solution:**
- Configured 2GB swap space on the instance.
- Build images sequentially through the private host setup script or the loop in [Setup & Infrastructure](setup.md), preventing multiple heavy Java compilation processes from overlapping.
- Aggressively tuned Spring Boot containers with `JAVA_OPTS=-Xmx160m` to guarantee predictable memory limits.

## 2. Low-Latency Game State Management
**Challenge:** Writing move history to a traditional relational database blockingly inside a WebSocket loop introduces unacceptable latency, especially for Bullet/Blitz time controls.
**Solution:**
- **RAM-First Design:** Active games live entirely in JVM memory (`ConcurrentHashMap`) within the `game-service`.
- **Sub-Millisecond Validation:** `chesslib` performs logic validation in memory.
- **Move Log:** Moves are appended to a Redis List via synchronous `RPUSH`. The log is available for future crash recovery; automatic recovery is not implemented yet.
- Heavy writes (PGN generation, Elo calculation) are offloaded to Kafka only *after* the game concludes.

## 3. Server-Authoritative Clock Synchronization
**Challenge:** Browsers throttle `setInterval` for background tabs. Trusting the client's clock enables cheating and causes time-sync drifts.
**Solution:**
- The backend is the absolute source of truth.
- Timeouts are strictly enforced via Server-side schedulers (`ThreadPoolTaskScheduler`).
- The client merely *renders* the clock using `requestAnimationFrame`, synchronizing against the backend baseline received via WebSocket broadcasts (e.g., hard-snapping if the drift exceeds 500ms).

## 4. Microservice Decoupling & Isolation
**Challenge:** Services sharing a monolithic database usually end up tightly coupled via cross-table JOINs, degrading maintainability.
**Solution:**
- Strict **Database-per-service** model.
- `auth_db`, `rating_db`, and `history_db` are separate databases on the shared PostgreSQL instance.
- Data required across boundaries is propagated via Kafka events (e.g., `rating-service` updating scores upon consuming `game-concluded` events).

## 5. Sticky Routing for RAM-Resident Games
**Challenge:** Active games live in one game-service instance's JVM memory. With multiple instances behind Eureka, a naive load balancer can route a player's WebSocket to an instance that does not hold their game.
**Solution:**
- On match creation, `game-service` writes an `instanceUri` into each player's Redis claim (`player:{username}:game`).
- The gateway's `GameRoutingFilter` intercepts `/ws/game/**`, reads the claim, and rewrites the route URI to the owning instance *before* load balancing happens.
- Missing or malformed claims fall back to Eureka load balancing. A valid but stale owner URI can still fail, and load-balancer fallback does not guarantee reaching the game owner in a multi-instance deployment. See the [sticky routing audit](audits/sticky_routing_enterprise_readiness_audit.md).
