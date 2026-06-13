#!/usr/bin/env node
/**
 * End-to-end test for auth-service boundary.
 *
 * Tests:
 *   1. Register two different users → both return 201 with tokens
 *   2. Validate tokens → both return { valid: true, userId, username }
 *   3. Login with correct credentials → 200, fresh tokens
 *   4. Test invalid JWT validation → returns { valid: false, userId: null, username: null }
 *
 * Requires: auth-service running on localhost:8081
 *   node scripts/test-auth.mjs
 */

const AUTH = 'http://localhost:8081';

const ts = Date.now();
const P1 = { username: `auth_p1_${ts}`, email: `auth_p1_${ts}@chess.test`, password: 'password123' };
const P2 = { username: `auth_p2_${ts}`, email: `auth_p2_${ts}@chess.test`, password: 'password456' };

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

async function jget(url, token) {
  const res = await fetch(url, {
    method: 'GET',
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

async function main() {
  log('setup', `players: ${P1.username} / ${P2.username}`);

  // Test 1: Register two users
  log('test', '1. POST /api/auth/register (user 1)');
  const reg1 = await jpost(`${AUTH}/api/auth/register`, P1);
  if (reg1.status !== 201) {
    throw new Error(`expected 201, got ${reg1.status} ${JSON.stringify(reg1.json)}`);
  }
  const { token: token1, userId: userId1, username: username1 } = reg1.json;
  if (!token1 || !userId1 || !username1) {
    throw new Error(`register response missing fields: ${JSON.stringify(reg1.json)}`);
  }
  log('pass', `P1 registered (${username1})`);

  log('test', '1b. POST /api/auth/register (user 2)');
  const reg2 = await jpost(`${AUTH}/api/auth/register`, P2);
  if (reg2.status !== 201) {
    throw new Error(`expected 201, got ${reg2.status} ${JSON.stringify(reg2.json)}`);
  }
  const { token: token2, userId: userId2, username: username2 } = reg2.json;
  if (!token2 || !userId2 || !username2) {
    throw new Error(`register response missing fields: ${JSON.stringify(reg2.json)}`);
  }
  log('pass', `P2 registered (${username2})`);

  // Test 2: Validate both tokens
  log('test', '2. GET /api/auth/validate (with token 1)');
  const val1 = await jget(`${AUTH}/api/auth/validate`, token1);
  if (val1.status !== 200) {
    throw new Error(`expected 200, got ${val1.status}`);
  }
  if (!val1.json.valid || val1.json.userId !== userId1) {
    throw new Error(`validate response incorrect: ${JSON.stringify(val1.json)}`);
  }
  log('pass', `P1 token valid`);

  log('test', '2b. GET /api/auth/validate (with token 2)');
  const val2 = await jget(`${AUTH}/api/auth/validate`, token2);
  if (val2.status !== 200) {
    throw new Error(`expected 200, got ${val2.status}`);
  }
  if (!val2.json.valid || val2.json.userId !== userId2) {
    throw new Error(`validate response incorrect: ${JSON.stringify(val2.json)}`);
  }
  log('pass', `P2 token valid`);

  // Test 3: Login with correct credentials
  log('test', '3. POST /api/auth/login (P1 correct creds)');
  const login1 = await jpost(`${AUTH}/api/auth/login`, { username: P1.username, password: P1.password });
  if (login1.status !== 200) {
    throw new Error(`expected 200, got ${login1.status} ${JSON.stringify(login1.json)}`);
  }
  if (login1.json.userId !== userId1) {
    throw new Error(`login returned different userId`);
  }
  log('pass', `P1 login successful`);

  log('test', '3b. POST /api/auth/login (P2 correct creds)');
  const login2 = await jpost(`${AUTH}/api/auth/login`, { username: P2.username, password: P2.password });
  if (login2.status !== 200) {
    throw new Error(`expected 200, got ${login2.status} ${JSON.stringify(login2.json)}`);
  }
  if (login2.json.userId !== userId2) {
    throw new Error(`login returned different userId`);
  }
  log('pass', `P2 login successful`);

  // Test 4: Validate with invalid/expired token
  log('test', '4. GET /api/auth/validate (with invalid token)');
  const valBad = await jget(`${AUTH}/api/auth/validate`, 'invalid.token.here');
  if (valBad.status !== 200) {
    throw new Error(`expected 200, got ${valBad.status}`);
  }
  if (valBad.json.valid !== false || valBad.json.userId !== null) {
    throw new Error(`expected valid=false for invalid token: ${JSON.stringify(valBad.json)}`);
  }
  log('pass', `invalid token correctly rejected`);

  console.log('\n✅ PASS — auth-service boundary:');
  console.log('   register (2 users) → validate (both tokens) → login (correct creds) → invalid token');
  process.exit(0);
}

main().catch((e) => {
  console.error('\n❌ FAIL —', e.message);
  process.exit(1);
});
