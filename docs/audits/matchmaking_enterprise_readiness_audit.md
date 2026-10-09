> **POINT-IN-TIME AUDIT** - Reviewed on 2026-09-13 against commit `226429573e9c1655cd751f815a39a7f6eb2790ac`. Revalidate each finding after substantial matchmaking, Redis, Kafka, or game-claim changes.

# Matchmaking Enterprise Readiness Audit

**Cleanup follow-up (2026-10-09):** Deterministic sorted-pair Kafka keys and the configurable 200-point default rating range have been restored. The random-key and 1000-point-range observations below describe the audited working tree, not the current defaults. The distributed correctness findings remain open.

## Status

**Severity: Critical before production scale-out**

**Overall rating: 4/10 for enterprise readiness**

| Area | Rating | Assessment |
|---|---:|---|
| Redis ZSET as a rating index | 7/10 | A suitable primitive for ordered candidate lookup. |
| Single-instance prototype | 6/10 | Coherent happy path with several useful local race mitigations. |
| Multi-instance correctness | 2-3/10 | Queue lifecycle operations are not atomic across workers or failures. |
| Overall enterprise readiness | 4/10 | Requires a versioned state machine, atomic reservation, durable dispatch, and recovery. |

The Redis sorted set should remain a candidate index, but it cannot safely represent the complete lifecycle of a distributed match by itself. The principal risk is not the choice of ZSET. It is that the implementation treats a sequence of individually atomic Redis commands as though the whole matchmaking workflow were atomic.

This remediation is currently deferred and tracked in [`../todos.md`](../todos.md). It should be treated as a release blocker before horizontal matchmaking scale-out or production availability claims.

## Scope

The review covered:

- Matchmaking join, poll, cancel, and scheduled pairing behavior.
- Redis queue and per-player claim keys.
- Kafka match dispatch.
- Game-service consumption and two-player game claims.
- Client polling and unload cleanup.
- Documentation and current unit-test coverage.

Primary implementation references:

- `server/matchmaking-service/src/main/java/com/example/chess/matchmaking/service/MatchmakingService.java`
- `server/game-service/src/main/java/com/example/chess/game/service/GameManager.java`
- `client/src/pages/QueuePage.jsx`
- `docs/flows.md`
- `docs/architecture.md`

## Strengths

- Redis ZSETs are a natural index for rating-ordered candidate discovery.
- Registered ratings are fetched server-side rather than trusted from clients.
- Registered and anonymous players use separate queues.
- `SETNX player:{username}:queue` handles the simple simultaneous two-tab case.
- Existing polls do not reinsert a player after the pairing loop has removed them.
- Kafka keeps game creation outside the matchmaking scheduler's immediate work.
- Game-service has a secondary `SETNX` guard against simultaneous duplicate games.
- Redis game metadata supports match detection and sticky game-service routing.

These are good prototype decisions, but they do not establish end-to-end distributed correctness.

## Critical Findings

### 1. Pair removal is not atomic

The pairing loop reads a full snapshot and then removes each player with a separate Redis command:

```java
Long r1 = redis.opsForZSet().remove(queueKey, p1.username);
Long r2 = redis.opsForZSet().remove(queueKey, p2.username);
```

See `MatchmakingService.java:247-278`.

The current documentation says both players are removed atomically, but that is not true. A crash between the commands can strand one player. Concurrent cancellation or another matcher can also invalidate the snapshot. The compensating `ZADD` can resurrect an entry that was canceled or superseded while pairing was in progress.

A multi-member `ZREM` would improve the narrow removal operation, but enterprise correctness requires an atomic reservation script that also validates queue generations and claims and creates a recoverable pending-match record.

### 2. Redis removal and Kafka publication have an unrecoverable dual-write gap

After removing both players, matchmaking calls `kafkaTemplate.send(...)` and ignores its completion result. See `MatchmakingService.java:269-297`.

Failure scenarios include:

- Process failure after Redis removal and before Kafka send.
- Asynchronous Kafka send failure.
- Broker unavailability or uncertain producer delivery.
- Process termination after send but before its result is known.

Players can disappear without a game, while a blind retry could produce duplicate requests. Logging "published" immediately after the asynchronous call is also stronger than the actual delivery guarantee.

Redis and Kafka do not share a transaction. A durable `PENDING` match record, idempotent publication, and reconciliation workflow are required.

### 3. Join is not one atomic state transition

Joining separately checks the game key, reads/creates the queue claim, and inserts the ZSET member. See `MatchmakingService.java:77-154`.

Possible inconsistencies include:

- Claim exists without a ZSET member after a crash or Redis error.
- ZSET member survives after the claim expires.
- A game is created after the game check but before `ZADD`.
- Concurrent requests observe intermediate states.

Joining should atomically create a versioned queue entry and lease after verifying the relevant state.

### 4. Cancellation races with pair dispatch

Cancellation separately checks game state, reads the queue claim, removes the member, and deletes the claim. See `MatchmakingService.java:165-197`.

A matcher can reserve or remove a player immediately before cancellation. Cancellation may return success even though a match request will still be sent. Conversely, compensation from a competing matcher can reinsert a canceled player.

Cancellation needs an atomic transition for the exact queue-entry generation and must return whether it changed `WAITING` to `CANCELED` or found the entry already `DISPATCHING` or `MATCHED`.

### 5. Expiring claims leave permanent ghost queue entries

`player:{username}:queue` has a two-minute sliding TTL, while queue ZSETs have no TTL. Polling renews the claim only while the member is visible.

If the client stops polling or the service is unavailable, the claim can expire while the ZSET member remains indefinitely. The identity may then join another queue while the stale entry is still eligible for matching.

Client `beforeunload` requests are best effort and cannot be a correctness mechanism. Queue entries need server-owned leases plus reconciliation and stale-entry cleanup.

### 6. Game-service does not atomically claim both players

Game-service performs two sequential `SETNX` operations for `player:{username}:game`. See `GameManager.java:112-131`.

A crash between claims can strand one player for up to 24 hours. If the second claim fails, the first is locally rolled back, but the available opponent has already been removed from matchmaking. There is no rejection event or deterministic requeue workflow.

Both player claims must be one atomic operation associated with a stable `matchId`, and repeat delivery of that `matchId` must return the original result.

## High-Risk Scalability Findings

### Full scans create Redis hot keys

Every matchmaking instance runs the scheduler every ten seconds and calls `rangeWithScores(queueKey, 0, -1)` for every queue. This transfers and allocates each complete ZSET on every instance. Adding matcher instances multiplies scans and stale-snapshot races rather than cleanly increasing throughput.

Use queue sharding, bounded candidate reads, rating buckets, and deterministic worker ownership or a concurrency-safe atomic worker algorithm.

### Polling amplifies rating-service traffic

The client polls every two seconds. Matchmaking fetches a registered player's rating before checking whether the request is only a same-queue status poll. A waiting player can therefore cause roughly 30 rating-service calls per minute.

Separate join from status polling and fetch a rating only for a new queue generation. A bounded rating cache or trusted local read model may be appropriate.

### Match requests lack durable identity

`MatchRequest` has no `matchId` or queue-entry generation IDs, while game-service generates a new game ID for every delivery. Kafka redelivery, delayed delivery, and cancel/rejoin ABA races therefore cannot be distinguished reliably.

Every join should receive a `queueEntryId`, and every pair reservation should receive a stable `matchId` included in all downstream events and deduplication records.

### Random Kafka keys weaken coordination

Match requests currently use random UUID keys. Related requests involving the same player can be processed concurrently on different partitions. A sorted pair key only orders the same pair and does not coordinate `A/B` with `A/C`.

Correctness should come from atomic player claims and idempotent match processing, not partition-key coincidence. Partitioning should then be chosen deliberately for workload ownership and throughput.

## Match Quality and Fairness

The current greedy adjacent-player algorithm uses rating only. It does not account for enqueue time, widening search ranges, starvation, rematches, region/latency, or color history. Equal-rated members are ordered lexicographically by Redis, allowing usernames to affect matching order.

The production configuration also sets a fixed 1000-point range, which substantially weakens rating-based match quality.

A more mature policy should anchor on an old waiting entry and widen its eligible rating range over time, for example:

```text
allowedDifference = min(maxRange, baseRange + waitSeconds * expansionRate)
```

Policy should be explicit per time control and measured with queue wait and rating-difference metrics.

## Recommended Target Design

### 1. Versioned queue state

Represent a search with at least:

```text
queueEntryId
username
queue
ratingSnapshot
joinedAt
leaseUntil
generation
state
```

Recommended states:

```text
WAITING -> DISPATCHING -> MATCHED
        -> CANCELED
        -> EXPIRED
```

### 2. Atomic Redis transitions

Use Lua scripts or Redis Functions for:

- **Join:** Verify no active game, create the exact queue generation and lease, and insert its index entry.
- **Renew:** Extend only the exact active generation.
- **Cancel:** Remove only a matching `WAITING` generation and return the resulting state.
- **Reserve pair:** Verify both entries and leases, remove both from waiting indexes, transition them to `DISPATCHING`, and create `match:{matchId}=PENDING`.
- **Claim game:** Atomically claim both players for the same `matchId` or return a deterministic conflict/idempotent result.

### 3. Durable dispatch and reconciliation

Do not use absence from a ZSET as the only evidence that dispatch is in progress. A publisher should retry pending records until game-service explicitly accepts or rejects them. Timed-out records should be safely retried, canceled, or requeued according to their versioned state.

Possible implementations:

- Redis pending-match records plus an idempotent Kafka publisher and acceptance/rejection events.
- Redis Streams, with pair reservation and `XADD` performed atomically inside Redis, followed by consumer-group recovery.
- A durable database state machine with a transactional outbox, using Redis only as the candidate index.

### 4. Sharded candidate discovery

Avoid one global full scan per queue per instance. Partition by time control and region, optionally add rating buckets, assign shards to workers, and perform bounded reads. A Redis Cluster design must account for hash-slot restrictions: a Lua script cannot freely operate across unrelated slots, so hash tags and shard ownership must be designed before implementation.

### 5. Production observability

Add metrics and alerts for:

- Queue depth and oldest wait by queue and shard.
- Join, cancellation, expiration, match, and rejection rates.
- Candidate scan size and latency.
- Pair reservation contention.
- Pending dispatch age and Kafka send failures.
- Orphan claims and ghost entries.
- Duplicate `matchId` deliveries.
- Match rating difference and wait-time percentiles.
- Game-claim conflicts and recovery outcomes.

## Required Verification

Mockito unit tests currently verify command invocation but cannot establish Redis atomicity or distributed behavior. Before enterprise rollout, add real Redis and Kafka integration tests covering:

- Two matcher instances selecting the same candidates.
- Cancellation during reservation.
- Failure after reservation and before dispatch.
- Asynchronous Kafka send failure and broker outage.
- Duplicate and delayed Kafka delivery.
- Cancel/rejoin ABA races.
- Claim expiry and ghost cleanup.
- Game-service failure between player claims.
- Conflict where one selected player is already in a game.
- Redis restart/failover and matcher recovery.
- Large-queue throughput, fairness, and hot-key behavior.
- Idempotent repeat processing of a stable `matchId`.

## Documentation Corrections Identified

At the audited commit, the documentation overstates or differs from implementation in these areas:

- `docs/flows.md` says pair removal is atomic; implementation uses two `ZREM` calls.
- `docs/flows.md` illustrates `ZRANGEBYSCORE`; implementation reads the complete queue by rank.
- `docs/flows.md` says both game claims are atomic; implementation uses two `SETNX` calls.
- `docs/architecture.md` describes claim expiry as self-healing, but the permanent ZSET member can remain.
- The match DTO describes deterministic pair partitioning, but publication currently uses a random UUID.

These descriptions should not be treated as delivered guarantees until the remediation is implemented and verified.

## Decision

The existing implementation is acceptable for continued local development and controlled prototype testing. It should not be represented as failure-safe, horizontally scalable matchmaking.

Before production scale-out, require:

1. Versioned queue entries and stable match IDs.
2. Atomic join, cancel, pair-reservation, and two-player game-claim transitions.
3. Durable pending-match dispatch and reconciliation.
4. Idempotent downstream processing and explicit accept/reject outcomes.
5. Server-owned leases and stale-entry cleanup.
6. Sharded, bounded candidate selection.
7. Real multi-instance failure and concurrency testing.
