> **POINT-IN-TIME AUDIT** - Reviewed on 2026-09-13 against commit `226429573e9c1655cd751f815a39a7f6eb2790ac`. Revalidate each finding after substantial gateway, game ownership, Redis, Eureka, WebSocket, or deployment changes.

# Sticky Routing Enterprise Readiness Audit

## Status

**Overall rating: 5.5/10 for enterprise readiness**

| Area | Rating | Assessment |
|---|---:|---|
| Single-instance happy path | 8/10 | Coherent owner recording, routing, authorization, and reconnect behavior. |
| Filter ordering and route integration | 8/10 | Authentication precedes affinity and affinity precedes reactive load balancing. |
| Healthy-owner reconnect | 7.5/10 | Reconnect reaches the owner and receives authoritative current state. |
| Multi-instance correctness | 5/10 | Works while ownership metadata and the original instance remain healthy. |
| Rolling deployment and failover | 2/10 | No drain, owner lease, migration, or fenced ownership transfer. |
| Security and trust boundaries | 4/10 | Query-token leakage and unrestricted Redis-provided routing targets are serious. |
| Redis ownership lifecycle | 4.5/10 | Claims lack atomic pair creation, generations, fencing, and safe deletion. |
| Observability | 3/10 | Logging exists, but routing outcomes and stale ownership are not measured. |
| Test depth | 4.5/10 | Basic unit coverage exists; distributed and adversarial paths are untested. |

The implementation is a solid prototype-level affinity mechanism. It should work well in the current single-host happy path, but it is not yet a failure-safe routing layer for horizontally scaled or rolling-deployed RAM-authoritative game instances.

## Scope and Recovery Assumption

This audit covers what is currently implemented:

- Game-service instance identity and ownership metadata creation.
- Redis player-game claims, serialization, TTL, and cleanup.
- Gateway authentication, sticky route resolution, and filter ordering.
- Eureka and direct WebSocket routing behavior.
- Game-service handshake and participant authorization.
- Healthy-instance reconnect behavior.
- Docker networking, security boundaries, observability, and tests.

Lazy crash recovery and game-state migration are known to be unimplemented and are not treated as accidental omissions. Their absence still defines what stale-owner fallback can safely do, so deployment and routing consequences are documented where relevant.

Primary implementation references:

- `server/gateway-service/src/main/java/com/example/chess/gateway/filter/GameRoutingFilter.java`
- `server/gateway-service/src/main/java/com/example/chess/gateway/filter/JwtValidationFilter.java`
- `server/gateway-service/src/main/resources/application.yml`
- `server/game-service/src/main/java/com/example/chess/game/service/GameManager.java`
- `server/game-service/src/main/java/com/example/chess/game/websocket/GameWebSocketHandler.java`
- `server/game-service/src/main/java/com/example/chess/game/websocket/JwtHandshakeInterceptor.java`
- `client/src/hooks/useGameSocket.js`
- `nginx/nginx.conf`

## Implemented Flow

The healthy path is coherent:

1. A game-service Kafka consumer creates a game in its own JVM.
2. It derives a local `ws://IP:port` URI.
3. It stores that URI in both players' `player:{username}:game` JSON claims.
4. The browser connects to `/ws/game/{gameId}?token={JWT}`.
5. `JwtValidationFilter` validates the token and injects `X-Username`.
6. `GameRoutingFilter` reads the authenticated player's Redis claim.
7. It replaces the load-balanced URI with the recorded direct instance URI before the reactive load balancer runs.
8. Game-service extracts the trusted username and path game ID during the handshake.
9. `GameWebSocketHandler` checks that the game exists in local RAM and that the user is a participant.
10. On reconnect to a healthy unchanged owner, game-service sends a complete authoritative `init` state.

## Strengths

- The routing key comes from a validated JWT subject, not a client-selected username.
- `JwtValidationFilter` runs before `GameRoutingFilter` in the route filter chain.
- Sticky routing is explicitly ordered before Spring Cloud Gateway's reactive load-balancer stage.
- Both players receive the same owner URI at game creation.
- The gateway remains stateless; multiple gateway replicas can read the same Redis ownership claim.
- Route selection alone does not authorize game access. Game-service checks local game existence and player participation.
- Reconnect initializes the client from server-authoritative RAM state.
- A 24-hour TTL bounds normal player-claim leakage.
- Normal game conclusion deletes player claims and gives game debugging keys a post-game expiry.
- Nginx forwards the required WebSocket upgrade headers and uses bounded idle timeouts.
- In the current Docker bridge network, the game container IP should normally be reachable from the gateway container.

## Critical Findings

### 1. WebSocket bearer tokens are exposed in logs

The browser puts the normal JWT in the WebSocket query string:

```javascript
new WebSocket(`${WS_BASE}/${gameId}?token=${token}`)
```

See `client/src/hooks/useGameSocket.js:73-80`.

`GameRoutingFilter` preserves the original query string when building the direct target and logs the complete merged URI at INFO. See `GameRoutingFilter.java:65-68`. The resulting log contains `?token={JWT}`.

Nginx also has no access-log format that redacts query parameters. With standard access logging, the request target can create a second bearer-token disclosure path. The current token lifetime defaults to 24 hours, increasing the impact of log access.

Required remediation:

- Never log the merged URI or any query string.
- Log only game ID, a safe owner identifier, routing outcome, and correlation ID.
- Redact or suppress `/ws/` query strings in Nginx and tracing/APM systems.
- After gateway validation, remove `token` before forwarding to game-service.
- Prefer a short-lived, one-use WebSocket ticket over putting the normal access token in the URL.

### 2. Redis `instanceUri` is an unrestricted routing and SSRF input

The gateway parses `instanceUri` from Redis and installs it directly as the outbound target. See `GameRoutingFilter.java:54-70`.

It does not verify:

- The scheme is `ws` or `wss`.
- The host belongs to an approved network.
- The port is a game-service port.
- The target is a currently registered, healthy `GAME-SERVICE` instance.
- The metadata game ID matches the requested path game ID.
- The claim has a valid owner generation or signature.

Redis is shared, exposed on host port 6379, and has no visible authentication or TLS in `docker-compose.yml`. A Redis compromise or a compromised Redis-writing service can therefore direct gateway egress toward an arbitrary internal destination. This bypasses Eureka's service identity and health information.

Recommended design:

```text
ownerInstanceId
ownerGeneration
gameId
claimVersion
```

Persist an opaque owner identity instead of a routable URI. Resolve it through a trusted registry or controlled instance directory, require current health, validate the game ID, and restrict scheme, port, and network destination. At minimum, strictly validate URIs and isolate Redis with credentials, ACLs, TLS where appropriate, and network policy.

## High-Severity Findings

### 3. A stale valid URI bypasses Eureka and hard-fails

Once a direct URI is installed, the filter removes the load-balancer scheme prefix. Eureka no longer participates in selection or health checking for that request. See `GameRoutingFilter.java:65-70` and filter order `10149` at line 86.

After a container restart or replacement:

- The RAM game is gone.
- The container IP may change.
- Player claims can continue pointing to the old IP for up to 24 hours.
- Reconnects keep targeting the dead address.
- There is no owner heartbeat, drain, claim invalidation, or retry policy.

This is partly the expected result of deferred recovery, but a controlled rolling deployment still needs explicit draining and stale-owner detection. A syntactically valid stale URI does not trigger the documented fallback.

Before multi-instance production deployment:

- Stop assigning matches to draining instances.
- Track active games per owner.
- Add owner heartbeats with short leases.
- Verify an owner is live before direct routing.
- Prevent termination while active games remain unless fenced migration/recovery is available.
- Return an explicit retryable owner-unavailable result rather than an opaque connection failure.

### 4. Eureka fallback is not correctness-preserving in multi-instance mode

Missing metadata, a missing `instanceUri`, or parse failure leaves the original `lb:ws://GAME-SERVICE` route in place. See `GameRoutingFilter.java:47-79`.

With RAM-local game state, only one instance can accept the game. Randomly selecting another healthy instance produces `GAME_NOT_READY` and closes the socket. Fallback works reliably only with one game-service instance or by chance with approximately `1/N` probability.

Therefore this is transport fallback, not safe game-owner fallback. Until recovery exists, multi-instance mode should fail closed with a specific owner-missing response rather than route randomly. After recovery exists, stale ownership should route through a designated recovery/ownership-acquisition protocol.

### 5. Redis failures do not follow the documented fallback path

The reactive chain handles present, absent, and parse-invalid values but has no `onErrorResume` for Redis connection failures, timeouts, or command errors. See `GameRoutingFilter.java:54-79`.

A Redis outage therefore propagates an error rather than falling back. The service needs an explicit policy:

- In controlled single-instance mode, load-balancer fallback may be acceptable.
- In multi-instance mode, return a bounded 503/retry response instead of random owner selection.
- Configure Redis timeouts and a circuit breaker.
- Measure Redis latency, errors, circuit state, and routing outcomes.

### 6. Instance identity is derived independently from Eureka

Game-service builds its owner URI using `InetAddress.getLocalHost().getHostAddress()` and `server.port`. See `GameManager.java:56-63`. Eureka separately registers the service with `prefer-ip-address: true`.

There is no guarantee that both mechanisms select the same reachable address on multi-homed hosts, Kubernetes, NAT, IPv4/IPv6 environments, cross-node deployments, or service meshes. The exception fallback to `ws://localhost:{port}` is unsafe: from the gateway container, `localhost` identifies the gateway, not game-service.

Use explicit `GAME_INSTANCE_ID` and advertised-address configuration, preferably resolving the opaque instance ID through Eureka. If no valid advertised identity exists, fail startup rather than writing `localhost` into ownership metadata.

### 7. Player claims and game initialization are not one atomic transition

Game-service writes the two player claims with sequential `SETNX` calls before constructing and inserting the RAM game. See `GameManager.java:112-149`.

Problems include:

- A crash or Redis exception after the first claim strands one player.
- `setIfAbsent` returning `null` is treated as success because only `Boolean.FALSE` is checked.
- Rollback is an unconditional delete rather than compare-and-delete.
- Duplicate Kafka delivery has no stable `matchId`.
- Time-control parsing or later initialization failure leaves claims behind.
- Claims are visible before the game exists in RAM.

Use one atomic Redis script or Function to claim both players with stable `matchId`, game ID, owner ID, owner epoch, and claim version. Build an idempotent `CREATING -> ACTIVE` transition and reconcile partial initialization.

### 8. Routing metadata is not matched to the requested game ID

The filter extracts the path game ID but reads only `instanceUri` from the claim. It never checks `metadata.gameId == path.gameId`. See `GameRoutingFilter.java:41-68`.

Game-service later prevents unauthorized participation, which limits direct authorization impact, but stale or corrupt metadata can route a valid player to the wrong owner and hide integrity failures.

Reject a mismatch, record a structured integrity metric, and do not treat it as ordinary missing metadata.

## Medium-Severity Findings

### 9. Claim deletion is not ownership-safe

Normal conclusion unconditionally deletes both player claims. See `GameManager.java:341-360`.

If a claim expired, was repaired, or was reassigned to a newer game, an old game's cleanup can delete the new claim. The 24-hour TTL is also not renewed while a game remains active.

Delete with a compare-and-delete script that checks `gameId`, `matchId`, and claim version. Treat ownership as a renewable lease rather than relying only on a fixed duration.

### 10. Active game metadata can survive indefinitely after a crash

`game:{gameId}:meta` and `game:{gameId}:moves` are created without TTLs. Their one-hour expiration is applied only on normal game conclusion. See `GameManager.java:355-359` and `407-420`.

While recovery is deferred, crash-orphaned records are neither consumed nor bounded. Add renewable maximum retention, owner-heartbeat reconciliation, and alerts for games whose owners no longer exist.

### 11. Reconnect has no terminal-failure classification or backoff

The client reconnects every second for every close while the hook is active. See `useGameSocket.js:108-119`.

Dead owner, expired authentication, malformed ownership, and permanent game loss all create the same retry loop. There is no jitter, exponential backoff, retry window, or machine-readable terminal behavior. Reconnect storms can amplify an owner or Redis failure.

Define WebSocket close/error codes for retryable owner initialization, authentication failure, concluded game, and permanent ownership loss. Add jittered exponential backoff and stop retrying terminal states.

### 12. Game-service trusts gateway identity based on network placement

Game-service does not validate the JWT. `JwtHandshakeInterceptor` trusts `X-Username`, and the WebSocket handler accepts all origins. See `JwtHandshakeInterceptor.java:17-35` and `WebSocketConfig.java:23-27`.

Current Compose does not expose game-service's port to the host, which is a useful boundary. However, any compromised workload on the internal network can connect directly and forge a participant identity.

Required production controls:

- Permit only gateway instances to reach game-service.
- Prefer mTLS or a gateway-signed short-lived internal identity assertion.
- Explicitly remove inbound identity headers before injecting authoritative values.
- Add duplicate/spoofed-header tests.
- Restrict allowed origins where practical.

### 13. Route matching is broader than the backend contract

The gateway accepts `/ws/game/**`. The filter uses an unanchored regex and `find()`, while game-service registers exactly one path segment at `/ws/game/*`.

Paths with extra segments can be sticky-routed using one ID and then interpreted differently or rejected downstream. The regex accepts a broad alphanumeric-and-hyphen value even though game IDs are UUIDs.

Anchor matching to the complete path, parse the exact UUID grammar, reject encoded separators, and align gateway and backend path contracts.

### 14. Observability is insufficient and currently leaks sensitive data

There are no dedicated metrics for:

- Sticky route success.
- Claim absence or malformed metadata.
- Game-ID mismatch.
- Redis latency and failures.
- Stale or dead owner.
- Direct-target connection failures.
- Load-balancer fallback.
- Reconnect storms.
- Active games and claims per owner.

The filter logs every successful route at INFO and includes the full URI. Parse failures log the complete Redis JSON, including opponent identity and internal network location.

Use structured, redacted logs and Micrometer counters/timers. Alert on stale claims, missing owners, reconnect spikes, target failures, and owner imbalance.

## Filter Ordering Assessment

The effective order is a notable strength:

1. The game route selects `JwtValidationFilter` followed by `GameRoutingFilter`.
2. JWT validation injects authenticated identity into the mutated exchange.
3. `GameRoutingFilter` reads that identity and runs at order `10149`.
4. The Spring Cloud reactive load balancer normally runs at order `10150`.
5. A valid direct URI therefore replaces the route immediately before load balancing.

The dependency is encoded as an unexplained magic number. Define a named constant, document the Spring Cloud order dependency, and add a real gateway integration test proving authentication-before-affinity and affinity-before-load-balancing across dependency upgrades.

## Capacity and Placement Assessment

Kafka partition assignment distributes future match events among game-service consumers, allowing multiple owners. It does not provide:

- Capacity-aware game placement.
- Active-game-aware balancing.
- Regional placement.
- Draining awareness.
- Migration of existing RAM games after a consumer rebalance.

Track active games and resource pressure per instance. Stop assigning matches to unhealthy or draining owners and define an admission policy independent of accidental Kafka partition distribution.

## Documentation Mismatches

At the audited commit:

- `docs/flows.md` describes `GameRoutingFilter` before JWT identity injection, but sticky routing requires and receives authenticated identity first.
- `docs/challenges.md` says missing or invalid claims degrade gracefully and stale claims never hard-fail. A syntactically valid stale URI is used directly and can hard-fail indefinitely.
- `AGENTS.md` describes load-balancer fallback as safe. It is not correctness-preserving with multiple RAM-owning instances.
- `docs/architecture.md` describes meta/move keys as being read for lazy recovery, but recovery is not implemented yet.
- `docs/challenges.md` describes Redis `RPUSH` as non-blocking, while `StringRedisTemplate` performs synchronous Redis calls on the move path.
- `docs/setup.md` uses stale Redis key examples that do not match `game:{gameId}:meta` and `game:{gameId}:moves`.

These should be corrected when implementation work resumes so documentation distinguishes current happy-path behavior from delivered failure guarantees.

## Existing Test Coverage

`GameRoutingFilterTest` covers:

- Successful direct URI replacement.
- Missing-key load-balancer fallback.
- Missing-`instanceUri` fallback.
- Non-game paths.

JWT tests cover query-token authentication and identity injection. GameManager tests cover basic game creation and one claim-conflict path.

These unit tests validate local branches but do not establish routing correctness across real Redis, Eureka, gateway filters, WebSocket upgrade, or multiple game-service instances.

## Required Verification Before Enterprise Rollout

Add tests for:

- Real gateway filter ordering and WebSocket upgrade.
- Direct route resolution versus reactive load balancing.
- Redis outage, timeout, cancellation, and circuit-open behavior.
- Malformed, oversized, hostile, and unsupported owner URIs.
- Loopback, link-local, arbitrary internal, and invalid-port targets.
- Metadata game-ID/path mismatch.
- Dead and stale owners.
- Query-token redaction in gateway, Nginx, and tracing.
- Spoofed or duplicate `X-Username` headers.
- Strict UUID paths, extra segments, and encoded separators.
- Docker/Kubernetes multi-instance reachability.
- Rolling restart and drain behavior.
- Kafka redelivery and idempotent game creation.
- Crash between two player claims.
- Redis `setIfAbsent` returning `null`.
- Failure after claims but before RAM insertion.
- Compare-and-delete cleanup races.
- Claim expiry during an active game.
- Client reconnect backoff and terminal errors.
- Session behavior after game conclusion.
- Multiple gateway replicas reading the same owner state.
- Owner load distribution and capacity limits.

## Recommended Roadmap

### Immediate Security

1. Remove tokens and query strings from gateway and Nginx logs.
2. Remove the token query parameter after gateway validation.
3. Replace unrestricted URI trust with validated owner resolution.
4. Stop exposing Redis publicly and enforce authentication/network isolation.
5. Validate metadata game ID against the requested game ID.
6. Restrict direct access to game-service and protect forwarded identity.

### Near-Term Correctness

1. Replace `instanceUri` ownership with opaque `ownerInstanceId` plus owner generation.
2. Introduce versioned claim metadata with stable `matchId`, lifecycle state, and timestamps.
3. Atomically claim both players and make game initialization idempotent.
4. Use compare-and-delete cleanup.
5. Define explicit Redis-failure and owner-missing policies.
6. Add bounded active TTLs and orphan reconciliation.
7. Return machine-readable owner-related close/error codes.

### Deployment and Recovery Preparation

1. Add owner heartbeats and health verification.
2. Add graceful game-service draining and stop new placement on draining owners.
3. Track active games per owner and enforce deployment disruption budgets.
4. Add dead-owner reconciliation and controlled claim invalidation.
5. When recovery is implemented, transfer ownership with monotonically increasing fenced epochs so two instances can never both become authoritative.

## Decision

The current design is acceptable for local development, controlled single-host deployment, and healthy-owner reconnect testing. It should not be represented as secure, failure-safe sticky routing for horizontally scaled production instances.

The highest-priority fixes do not depend on implementing crash recovery:

1. Eliminate bearer-token logging.
2. Remove unrestricted Redis-controlled routing targets.
3. Validate game ID and owner identity.
4. Define correct behavior for missing, stale, and unavailable ownership state.
5. Add ownership-safe claim creation and deletion.
6. Add real gateway/WebSocket multi-instance integration tests.
