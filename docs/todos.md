# Active Codebase TODOs & Roadmap

## 0. Critical: Matchmaking Distributed Correctness

> **Deferred, but release-blocking before production scale-out.** See the full [Matchmaking Enterprise Readiness Audit](audits/matchmaking_enterprise_readiness_audit.md), rated **4/10 for enterprise readiness**.

- [ ] Introduce versioned queue entries (`queueEntryId`) and stable, idempotent `matchId` values.
- [ ] Replace multi-command join, cancel, pair reservation, and two-player game claims with atomic Redis Lua scripts or Redis Functions.
- [ ] Add durable pending-match dispatch, Kafka delivery tracking, game-service accept/reject outcomes, retries, and reconciliation.
- [ ] Add server-owned queue leases and cleanup for stale ZSET entries and orphan claims.
- [ ] Replace full ZSET scans on every instance with sharded ownership and bounded candidate selection.
- [ ] Separate queue status polling from joining so polls do not repeatedly call rating-service.
- [ ] Add real Redis/Kafka multi-instance concurrency, failure-recovery, idempotency, fairness, and load tests.

The current implementation is suitable for prototype development but must not be described as failure-safe or horizontally scalable until these items are completed and verified.

## 1. Security Enhancements
- [ ] **Asymmetric JWT Signing**: Transition from HMAC-SHA256 (symmetric shared secret) to **RS256** or **ES256**. The Auth Service should hold the private key, while the API Gateway fetches public keys via a JWKS endpoint (`/api/auth/.well-known/jwks.json`).
- [ ] **Access & Refresh Tokens**: Implement short-lived Access Tokens stored in memory alongside long-lived Refresh Tokens (`HttpOnly` cookies) to prevent XSS and allow session revocation via Redis.

## 2. Infrastructure & Routing
- [x] **Sticky Routing**: Implemented in the gateway (`GameRoutingFilter`). Players are pinned to the game-service instance owning their match via the `instanceUri` field of the Redis claim `player:{username}:game`; falls back to Eureka load balancing when the claim is absent.

## 3. Game Lifecycle Resiliency
- [ ] **Auto-Start Clocks**: White's stats clock running automatically on game creation in `GameManager`. This should not be the case. A players clock should only start running after their first move. 
- [ ] **Server-Side Cleanup**: Implement auto-abort cleanup in `game-service` if a player fails to connect or make a move within the initial threshold.
- [ ] **Lazy Crash Recovery**: On WebSocket connection, if the game state is missing from RAM, lazily read and reconstruct the board state from the Redis move log.
- [ ] **Refactoring**: Refactor game-state mutation design pattern following the "Tell Don't Ask" principle.
