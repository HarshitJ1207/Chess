#!/usr/bin/env node
/**
 * End-to-end test for matchmaking-service boundary via gateway.
 *
 * Tests:
 *   1. P1 registers and queues → QUEUED status
 *   2. P2 registers and queues → MATCHED status with gameId + color + opponentId
 *   3. P3 registers, queues, then leaves queue → DELETE returns 204, next queue returns QUEUED (no match)
 *
 * Requires: gateway on localhost:8080
 *   node scripts/test-matchmaking.mjs
 */

const GATEWAY = 'http://localhost:8080';
const AUTH = GATEWAY;
const MM = GATEWAY;

const ts = Date.now();
const P1 = { username: `mm_p1_${ts}`, email: `mm_p1_${ts}@chess.test`, password: 'password123' };
const P2 = { username: `mm_p2_${ts}`, email: `mm_p2_${ts}@chess.test`, password: 'password123' };
const P3 = { username: `mm_p3_${ts}`, email: `mm_p3_${ts}@chess.test`, password: 'password123' };

const log = (tag, ...a) => console.log(`[${tag}]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function jdelete(url, token) {
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { status: res.status, json };
}

async function register(p) {
  const r = await jpost(`${AUTH}/api/auth/register`, p);
  if (r.status === 201) return r.json;
  if (r.status === 409) {
    const l = await jpost(`${AUTH}/api/auth/login`, { username: p.username, password: p.password });
    return l.json;
  }
  throw new Error(`register ${p.username} failed: ${r.status} ${JSON.stringify(r.json)}`);
}

async function queue(token, elo) {
  const r = await jpost(`${MM}/api/matchmaking/queue`, { timeControl: '10+0', elo }, token);
  if (r.status !== 200) throw new Error(`queue failed: ${r.status} ${JSON.stringify(r.json)}`);
  return r.json;
}

async function main() {
  log('setup', `players: ${P1.username} / ${P2.username} / ${P3.username}`);

  // Register all three players
  const a1 = await register(P1);
  const a2 = await register(P2);
  const a3 = await register(P3);
  log('auth', `p1 userId=${a1.userId}, p2 userId=${a2.userId}, p3 userId=${a3.userId}`);

  // Test 1: P1 queues (should be QUEUED, no opponent yet)
  log('test', '1. P1 queues 180+2 @ 1500 ELO');
  const q1 = await queue(a1.token, 1500);
  if (q1.status !== 'QUEUED') {
    throw new Error(`expected QUEUED, got ${q1.status}`);
  }
  if (q1.gameId !== null) {
    throw new Error(`expected gameId=null when QUEUED, got ${q1.gameId}`);
  }
  log('pass', `P1 is QUEUED (no match yet)`);

  // Test 2: P2 queues (should eventually be MATCHED after batch job runs)
  log('test', '2. P2 queues 180+2 @ 1500 ELO');
  let q2 = await queue(a2.token, 1500);

  // Batch job runs every 10 seconds, so poll until MATCHED (max 30 attempts, 1 sec interval)
  if (q2.status === 'QUEUED') {
    log('test', '2b. Polling for match (batch job runs every 10s)...');
    let matched = false;
    for (let attempt = 1; attempt <= 30; attempt++) {
      await sleep(1000);
      q2 = await queue(a2.token, 1500);
      if (q2.status === 'MATCHED') {
        log('pass', `MATCHED after ${attempt}s`);
        matched = true;
        break;
      }
    }
    if (!matched) {
      throw new Error(`P2 still QUEUED after 30s polling (batch job didn't run?)`);
    }
  }

  if (q2.status !== 'MATCHED') {
    throw new Error(`expected MATCHED, got ${q2.status}`);
  }
  if (!q2.gameId) {
    throw new Error(`expected gameId when MATCHED, got ${q2.gameId}`);
  }
  if (q2.color !== 'white' && q2.color !== 'black') {
    throw new Error(`expected color to be white or black, got ${q2.color}`);
  }
  if (q2.opponentId !== a1.userId) {
    throw new Error(`expected opponentId=${a1.userId}, got ${q2.opponentId}`);
  }
  log('pass', `P2 is MATCHED with P1 in game ${q2.gameId} (${q2.color} vs ${q2.opponentId.substring(0,8)})`);

  // Test 3: P3 queues, then leaves, then queues again (should be QUEUED the second time)
  log('test', '3a. P3 queues 180+2 @ 1500 ELO');
  const q3a = await queue(a3.token, 1500);
  if (q3a.status !== 'QUEUED') {
    throw new Error(`expected P3 first queue to be QUEUED, got ${q3a.status}`);
  }
  log('pass', `P3 is QUEUED`);

  log('test', '3b. P3 calls DELETE /api/matchmaking/dequeue?timeControl=10+0');
  const del = await jdelete(`${MM}/api/matchmaking/dequeue?timeControl=10+0`, a3.token);
  if (del.status !== 204) {
    throw new Error(`expected DELETE to return 204, got ${del.status} ${JSON.stringify(del.json)}`);
  }
  log('pass', `P3 removed from queue (204 No Content)`);

  // Give the system a moment
  await sleep(200);

  log('test', '3c. P3 queues again (should be QUEUED with no match)');
  const q3b = await queue(a3.token, 1500);
  if (q3b.status !== 'QUEUED') {
    throw new Error(`expected P3 second queue to be QUEUED after removal, got ${q3b.status}`);
  }
  if (q3b.gameId !== null) {
    throw new Error(`expected gameId=null when re-queuing solo, got ${q3b.gameId}`);
  }
  log('pass', `P3 re-queued and is QUEUED (no opponent)`);

  console.log('\n✅ PASS — matchmaking-service boundary:');
  console.log('   queue (solo) → queue (match) → queue (join) → delete (remove) → queue (solo again)');
  process.exit(0);
}

main().catch((e) => {
  console.error('\n❌ FAIL —', e.message);
  process.exit(1);
});
