# Key User Flows

## 1. Registration & Login

```
Browser          Nginx/Vite       auth-service        auth_db
   │                 │                 │                  │
   │─POST /register─►│                 │                  │
   │                 │─────────────────►│                  │
   │                 │                 │─INSERT users ────►│
   │                 │                 │─INSERT credentials►│
   │                 │◄── 201 {token, userId, username} ──│
   │◄── 201 ─────────│                 │                  │
   │  stores JWT      │                 │                  │
   │  in Zustand      │                 │                  │
   │                 │                 │                  │
   │─POST /login ────►│                 │                  │
   │                 │─────────────────►│                  │
   │                 │                 │─SELECT + bcrypt──►│
   │                 │◄── 200 {token, userId, username} ──│
   │◄── 200 ─────────│                 │                  │
```

---

## 2. Matchmaking

Two players, A and B, looking for a game.

```
Player A          matchmaking-service           Redis              Kafka
   │                      │                      │                  │
   │──POST /queue ────────►│                      │                  │
   │  {timeControl, elo}   │                      │                  │
   │                       │─ZRANGEBYSCORE ───────►│                  │
   │                       │◄── [] (empty) ────────│                  │
   │                       │─ZADD queue:180+2 ─────►│                  │
   │                       │  score=elo, mem=A      │                  │
   │◄── 200 {QUEUED} ──────│                      │                  │
   │  starts polling       │                      │                  │
   │  every 2 seconds      │                      │                  │
   │                       │                      │                  │

Player B          matchmaking-service           Redis              Kafka
   │                      │                      │                  │
   │──POST /queue ────────►│                      │                  │
   │  {timeControl, elo}   │                      │                  │
   │                       │─ZRANGEBYSCORE ───────►│                  │
   │                       │◄── [A] ───────────────│                  │
   │                       │─ZREM queue:180+2, A ──►│  (atomic claim)  │
   │                       │                      │                  │
   │                       │─SET pending_match:A ──►│  TTL=30s         │
   │                       │  "gameId:white:B"      │                  │
   │                       │                      │                  │
   │                       │──PRODUCE ────────────────────────────────►│
   │                       │  match-created                           │
   │                       │  {gameId, white=A, black=B}              │
   │                       │                      │                  │
   │◄── 200 {MATCHED,      │                      │                  │
   │    gameId, black} ────│                      │                  │
   │  navigates to /game   │                      │                  │
   │                       │                      │                  │

Player A (next poll, ≤2 seconds later):
   │──POST /queue ────────►│                      │                  │
   │                       │─GETDEL pending_match:A►│                  │
   │                       │◄── "gameId:white:B" ──│                  │
   │◄── 200 {MATCHED,      │                      │                  │
   │    gameId, white} ────│                      │                  │
   │  navigates to /game   │                      │                  │
```

---

## 3. Game Lifecycle

### 3a. Game Initialization

```
game-service            Kafka                Redis
     │                    │                    │
     │◄─CONSUME ──────────│                    │
     │  match-created     │                    │
     │  {gameId, w, b, tc}│                    │
     │                    │                    │
     │  creates Game obj  │                    │
     │  in ConcurrentHashMap                   │
     │  (white/black clocks set from tc)       │
     │                    │                    │
     │  (on crash: replays│                    │
     │  moves from Redis  │                    │
     │  list to rebuild)  │                    │
```

### 3b. Move Handshake (3-way)

```
White Browser     game-service            Redis        Black Browser
     │                 │                    │                │
     │──WS move ──────►│                    │                │
     │ {t:"move",       │                    │                │
     │  d:{u:"e2e4",    │                    │                │
     │     a:1}}        │                    │                │
     │                 │                    │                │
     │◄── ACK ─────────│  (immediate,        │                │
     │  {t:"ack", d:1}  │   before validate)  │                │
     │                 │                    │                │
     │                 │  validate via       │                │
     │                 │  chesslib           │                │
     │                 │                    │                │
     │                 │──RPUSH game:moves──►│                │
     │                 │  "e2e4"            │                │
     │                 │                    │                │
     │◄── broadcast ───┤─────────────────────────────────────►│
     │  {t:"move",      │                    │                │
     │   v:1,           │                    │                │
     │   d:{uci:"e2e4", │                    │                │
     │      san:"e4",   │                    │                │
     │      fen:"...",  │                    │                │
     │      ply:1,      │                    │                │
     │      clock:{     │                    │                │
     │        white:178,│                    │                │
     │        black:180,│                    │                │
     │        lag:12}}} │                    │                │
```

**Clock math on each move:**
```
timeSpent       = now - lastMoveTimestamp
lagRefund       = min(measuredRTT/2, 400ms)  ← hard cap
newBalance      = activePlayerTime - timeSpent + lagRefund + increment
```

**Lag measurement:** Server sends WebSocket Ping frames every 1–2 s. Browser replies with native Pong (cannot be blocked by extensions). RTT = time between Ping send and Pong receipt.

### 3c. Game Conclusion

```
game-service          Kafka           rating-service    history-service
     │                  │                   │                 │
     │  (checkmate /     │                   │                 │
     │   timeout /       │                   │                 │
     │   resign /        │                   │                 │
     │   draw)           │                   │                 │
     │                  │                   │                 │
     │──PRODUCE ────────►│                   │                 │
     │  game-concluded   │                   │                 │
     │  {gameId, w, b,   │                   │                 │
     │   result,         │                   │                 │
     │   termination,    │                   │                 │
     │   moves[]}        │                   │                 │
     │                  │                   │                 │
     │                  │──CONSUME ─────────►│                 │
     │                  │                   │  Glicko-2 calc  │
     │                  │                   │──UPDATE ratings─►│ (rating_db)
     │                  │                   │──ZADD leaderboard►│ (Redis)
     │                  │                   │                 │
     │                  │──CONSUME ──────────────────────────►│
     │                  │                   │                 │  archive PGN
     │                  │                   │                 │──INSERT games
     │                  │                   │                 │  (history_db)
```

---

## 4. Frontend Clock Rendering

The client never trusts its own clock for authoritative time — it only renders.

```
On move broadcast received:
  serverBaseline = clock.white or clock.black (from the message)
  localTurnStart = Date.now()

requestAnimationFrame loop:
  visibleTime = serverBaseline - (Date.now() - localTurnStart)

On next move broadcast (drift reconciliation):
  drift = |visibleTime - newServerBaseline|
  if drift > 500ms:  hard-snap to server value
  else:              smear at ±5% tick rate over ~1.5s
```

---

## 5. WebSocket Message Envelope

All messages over `/ws/game/{gameId}` share a `type` discriminator:

| `t` field | Direction | Purpose |
|---|---|---|
| `move` | client→server | Player submits a move (`u`=UCI, `a`=action counter) |
| `ack` | server→client | Immediate receipt confirmation (suppresses spinner) |
| `move` | server→both | Authoritative state broadcast after validation |
| `chat` | client→server | Chat message (buffered in memory, no DB write) |
| `chat` | server→both | Chat broadcast |
| `draw_offer` | client→server | Offer a draw |
| `draw_offer` | server→opponent | Forward draw offer |
| `draw_accept` | client→server | Accept draw → triggers GameConcludedEvent |
| `resign` | client→server | Resign → triggers GameConcludedEvent |
| `heartbeat` | server→client | Sent if no activity for N seconds (keep-alive) |

**Version counter (`v`):** Each authoritative move broadcast includes the ply count. If the client's local ply count mismatches `v`, it requests a full board resync.
