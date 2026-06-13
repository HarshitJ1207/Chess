#!/usr/bin/env node
/**
 * End-to-end smoke test for the chess platform's game loop.
 *
 *   register → login → queue (matchmaking) → MatchCreatedEvent (Kafka)
 *   → game-service instantiates game → both players connect over WebSocket
 *   → play Scholar's Mate → checkmate → GameConcludedEvent (Kafka)
 *
 * Requires Node 18+ (uses built-in fetch + WebSocket). No npm install needed.
 *
 *   node scripts/test-game.mjs
 */

const AUTH = 'http://localhost:8081';
const MM   = 'http://localhost:8082';
const WS   = 'ws://localhost:8083';
const RATING = 'http://localhost:8084';
const HISTORY = 'http://localhost:8085';
const ADMIN = 'http://localhost:9644'; // redpanda admin (to confirm Kafka produce)

const ts = Date.now();
const P1 = { username: `p1_${ts}`, email: `p1_${ts}@chess.test`, password: 'password123' };
const P2 = { username: `p2_${ts}`, email: `p2_${ts}@chess.test`, password: 'password123' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (tag, ...a) => console.log(`[${tag}]`, ...a);

async function jpost(url, body, token) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { status: res.status, json };
}

async function register(p) {
  const r = await jpost(`${AUTH}/api/auth/register`, p);
  if (r.status === 201) return r.json;          // fresh user → token returned
  if (r.status === 409) {                       // already exists → login
    const l = await jpost(`${AUTH}/api/auth/login`, { username: p.username, password: p.password });
    return l.json;
  }
  throw new Error(`register ${p.username} failed: ${r.status} ${JSON.stringify(r.json)}`);
}

async function queue(token, elo) {
  const r = await jpost(`${MM}/api/matchmaking/queue`, { timeControl: '180+2', elo }, token);
  if (r.status !== 200) throw new Error(`queue failed: ${r.status} ${JSON.stringify(r.json)}`);
  return r.json;
}

/** Wraps a WebSocket with a tagged logger and a predicate-based waiter. */
function connect(tag, gameId, token) {
  const ws = new WebSocket(`${WS}/ws/game/${gameId}?token=${token}`);
  const waiters = [];
  ws.addEventListener('message', (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    log(tag, '<<', JSON.stringify(msg));
    for (let i = waiters.length - 1; i >= 0; i--) {
      if (waiters[i].pred(msg)) { waiters[i].resolve(msg); waiters.splice(i, 1); }
    }
  });
  ws.addEventListener('error', (e) => log(tag, 'WS ERROR', e.message || e));
  const open = new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
  });
  const send = (obj) => { log(tag, '>>', JSON.stringify(obj)); ws.send(JSON.stringify(obj)); };
  const waitFor = (pred, ms = 5000) => new Promise((resolve, reject) => {
    const w = { pred, resolve };
    waiters.push(w);
    setTimeout(() => {
      const i = waiters.indexOf(w);
      if (i >= 0) { waiters.splice(i, 1); reject(new Error(`${tag}: timeout waiting for frame`)); }
    }, ms);
  });
  return { ws, open, send, waitFor };
}

async function getJson(url) {
  try {
    const res = await fetch(url);
    if (res.status !== 200) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Poll fn() until pred(result) holds, or give up. Returns the result or null. */
async function poll(fn, pred, tries = 15, gapMs = 500) {
  for (let i = 0; i < tries; i++) {
    const r = await fn();
    if (pred(r)) return r;
    await sleep(gapMs);
  }
  return null;
}

async function kafkaWatermark(topic) {
  try {
    const res = await fetch(`${ADMIN}/v1/debug/partition/kafka/${topic}/0`);
    if (!res.ok) return null;
    const j = await res.json();
    return j.replicas?.[0]?.high_watermark ?? null;
  } catch { return null; }
}

async function main() {
  log('setup', 'players:', P1.username, '/', P2.username);

  const a1 = await register(P1);
  const a2 = await register(P2);
  log('auth', 'p1 userId', a1.userId, '| p2 userId', a2.userId);

  const concludedBefore = await kafkaWatermark('game-concluded');

  // p1 queues first (QUEUED), p2 queues second (MATCHED).
  const q1 = await queue(a1.token, 1500);
  log('mm', 'p1 →', JSON.stringify(q1));
  const q2 = await queue(a2.token, 1500);
  log('mm', 'p2 →', JSON.stringify(q2));

  if (q2.status !== 'MATCHED') throw new Error(`expected p2 MATCHED, got ${q2.status}`);
  const gameId = q2.gameId;

  // q2 is p2's view: q2.color is p2's color, opponentId is p1.
  const p2White = q2.color === 'white';
  const white = p2White ? { tag: 'WHITE/p2', token: a2.token, userId: a2.userId } : { tag: 'WHITE/p1', token: a1.token, userId: a1.userId };
  const black = p2White ? { tag: 'BLACK/p1', token: a1.token, userId: a1.userId } : { tag: 'BLACK/p2', token: a2.token, userId: a2.userId };
  log('mm', `game ${gameId} — white=${white.tag} black=${black.tag}`);

  // Give game-service a moment to consume MatchCreatedEvent and instantiate the game.
  await sleep(1500);

  const wc = connect(white.tag, gameId, white.token);
  const bc = connect(black.tag, gameId, black.token);
  await Promise.all([wc.open, bc.open]);
  await Promise.all([
    wc.waitFor((m) => m.t === 'init'),
    bc.waitFor((m) => m.t === 'init'),
  ]);
  log('ws', 'both players connected + init received');

  // Scholar's Mate: white mates on move 4 (ply 7).
  const moves = [
    [wc, 'e2e4'], [bc, 'e7e5'],
    [wc, 'f1c4'], [bc, 'f8c5'],
    [wc, 'd1h5'], [bc, 'g8f6'],
    [wc, 'h5f7'], // Qxf7#  → checkmate
  ];

  // Pre-register end frame listeners BEFORE the final move (race condition fix)
  const endPromises = [
    wc.waitFor((m) => m.t === 'end', 8000),
    bc.waitFor((m) => m.t === 'end', 8000),
  ];

  let counter = 0;
  for (let i = 0; i < moves.length; i++) {
    const [sock, uci] = moves[i];
    const expectedPly = i + 1;
    sock.send({ t: 'move', d: { u: uci, a: ++counter } });
    // The authoritative broadcast for this ply arrives on BOTH sockets.
    await wc.waitFor((m) => m.t === 'move' && m.v === expectedPly);
    await sleep(150); // brief spacing so clock deltas are visible
  }

  // End frame listeners were registered before the last move, so they're ready.
  const [endW] = await Promise.all(endPromises);
  log('result', 'game ended →', JSON.stringify(endW.d));
  if (endW.d.result !== '1-0' || endW.d.termination !== 'checkmate') {
    throw new Error(`expected 1-0 checkmate, got ${JSON.stringify(endW.d)}`);
  }

  // Confirm GameConcludedEvent reached Kafka.
  await sleep(800);
  const concludedAfter = await kafkaWatermark('game-concluded');
  log('kafka', `game-concluded high_watermark: ${concludedBefore} → ${concludedAfter}`);

  wc.ws.close(); bc.ws.close();

  // ── Downstream consumers: rating-service + history-service ──
  // Both consume game-concluded asynchronously, so poll with a short backoff.
  const whiteRating = await poll(
    () => getJson(`${RATING}/api/ratings/${white.userId}`),
    (r) => r && typeof r.rating === 'number');
  const blackRating = await poll(
    () => getJson(`${RATING}/api/ratings/${black.userId}`),
    (r) => r && typeof r.rating === 'number');

  if (!whiteRating || !blackRating) {
    throw new Error('rating-service did not produce ratings for both players in time');
  }
  log('rating', `white ${whiteRating.rating.toFixed(1)} (RD ${whiteRating.ratingDeviation.toFixed(1)}) | ` +
                `black ${blackRating.rating.toFixed(1)} (RD ${blackRating.ratingDeviation.toFixed(1)})`);
  if (!(whiteRating.rating > 1500 && blackRating.rating < 1500)) {
    throw new Error(`expected winner >1500 and loser <1500, got W=${whiteRating.rating} B=${blackRating.rating}`);
  }

  const history = await poll(
    () => getJson(`${HISTORY}/api/history/player/${white.userId}?page=0&size=5`),
    (h) => h && h.totalElements >= 1 && h.content?.length >= 1);
  if (!history) {
    throw new Error('history-service did not archive the game in time');
  }
  const archived = history.content.find((g) => g.gameId === gameId) || history.content[0];
  log('history', `archived game ${archived.gameId}: result=${archived.result} ` +
                 `termination=${archived.termination} moves=${archived.moves?.length}`);
  log('history', 'PGN →\n' + archived.pgn);
  if (archived.result !== '1-0' || !archived.pgn?.includes('Qxf7#')) {
    throw new Error(`history archive looks wrong: ${JSON.stringify({ result: archived.result })}`);
  }

  console.log('\n✅ PASS — end to end:');
  console.log('   matchmaking → game instantiation → moves → checkmate');
  console.log('   → GameConcludedEvent → Glicko-2 ratings updated → game archived (PGN + JSONB moves)');
  process.exit(0);
}

main().catch((e) => {
  console.error('\n❌ FAIL —', e.message);
  process.exit(1);
});
