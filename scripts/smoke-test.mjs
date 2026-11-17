#!/usr/bin/env node
/**
 * End-to-end smoke test against the real Supabase backend:
 * two players → series room (2 games) → tickets → prize amounts = pot → start →
 * numbers called by the server clock over private realtime → both players "strike" and
 * claim like the app does → payouts → next game opens automatically → standings.
 *
 *   node scripts/smoke-test.mjs            (reads app/.env)
 *
 * Creates two throwaway accounts (random mobile numbers) and deletes them at the end.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(path.join(root, 'app', 'package.json'));
const { createClient } = require('@supabase/supabase-js');

const env = Object.fromEntries(
  readFileSync(path.join(root, 'app', '.env'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const URL = env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!URL || !KEY) throw new Error('Set EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY in app/.env');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (cond, label) => {
  console.log(`${cond ? '✔' : '✘'} ${label}`);
  if (!cond) failures++;
};

// ── Minimal mirror of the ticket rules (app/src/game/engine/ticket.ts) ──
const FAST = { fast_3: 3, fast_5: 5, fast_7: 7 };
function prizeNumbers(cells, prize) {
  const keep = {
    line_1: (r) => r === 0, line_2: (r) => r === 1, line_3: (r) => r === 2,
    col_left: (_, c) => c <= 2, col_center: (_, c) => c >= 3 && c <= 5, col_right: (_, c) => c >= 6,
  }[prize] ?? (() => true);
  return cells.map((n, i) => [n, Math.floor(i / 9), i % 9]).filter(([n, r, c]) => n > 0 && keep(r, c)).map(([n]) => n);
}
function complete(cells, called, prize) {
  const set = new Set(called);
  const nums = prizeNumbers(cells, prize);
  return FAST[prize] ? nums.filter((n) => set.has(n)).length >= FAST[prize] : nums.every((n) => set.has(n));
}

async function guest(name) {
  const client = createClient(URL, KEY, { auth: { persistSession: false } });
  // Same path as the app: mobile number + name → phone_login → sign in (no OTP yet).
  const mobile = '6' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
  const creds = await client.rpc('phone_login', { p_phone: mobile, p_name: name });
  if (creds.error) throw new Error(`phone_login failed: ${creds.error.message}`);
  const { error } = await client.auth.signInWithPassword(creds.data);
  if (error) throw new Error(`sign-in failed: ${error.message}`);
  const rpc = async (fn, args) => {
    const { data, error: e } = await client.rpc(fn, args);
    if (e) throw new Error(`${name}.${fn}: ${e.message}`);
    return data;
  };
  return { client, rpc, name };
}

const expectError = async (p, code) => {
  try {
    await p;
    return false;
  } catch (e) {
    return e.message.includes(code);
  }
};

const host = await guest('Smoke Host');
const friend = await guest('Manikanta Yerraguntla');
try {
  const me = await friend.rpc('get_me');
  check(me.displayName === 'Manikanta Yerraguntla', `name from signup kept (${me.displayName})`);

  const prizes = { fast_5: 10, line_1: 10, line_2: 10, line_3: 10, col_left: 10, col_center: 10, col_right: 10, full_house: 30 };
  const room = await host.rpc('create_room', {
    p_title: 'Smoke Series', p_kind: 'series', p_visibility: 'public', p_max_players: 5,
    p_ticket_price: 10, p_call_interval_seconds: 3, p_series_length: 2, p_prizes: prizes,
  });
  check(/^[A-Z2-9]{6}$/.test(room.code), `series room created (${room.code})`);

  const pub = await friend.rpc('list_public_rooms');
  check(pub.some((r) => r.id === room.roomId), 'room listed as public');
  const jr = await friend.rpc('join_room_by_code', { p_code: room.code.toLowerCase() });
  check(jr.status === 'pending', 'friend asked to join (waits for host)');
  await host.rpc('respond_join_request', { p_room: room.roomId, p_user: (await friend.rpc('get_me')).id, p_accept: true });
  check((await friend.rpc('my_join_status', { p_room: room.roomId })).status === 'member', 'host accepted the friend');

  let state = await host.rpc('get_room_state', { p_room: room.roomId });
  const game1 = state.game.id;
  check(state.game.status === 'lobby' && state.game.gameNo === 1, 'game 1 lobby open');

  await host.rpc('set_my_tickets', { p_game: game1, p_count: 2 });
  check(await expectError(host.rpc('start_game', { p_game: game1 }), 'NEED_TWO_PLAYERS'), 'cannot start with one player');
  check(await expectError(host.rpc('set_my_tickets', { p_game: game1, p_count: 3 }), 'TICKETS_ALREADY_CHOSEN'), 'tickets fixed once chosen');
  check(await expectError(friend.rpc('set_my_tickets', { p_game: game1, p_count: 5 }), 'INVALID_TICKET_COUNT'), 'max 4 tickets');
  await friend.rpc('set_my_tickets', { p_game: game1, p_count: 3 });

  state = await host.rpc('get_room_state', { p_room: room.roomId });
  check(Number(state.game.pot) === 50, `pot = 5 tickets × ₹10 = ${state.game.pot}`);
  const autoTotal = state.prizes.reduce((s, p) => s + Number(p.amount), 0);
  check(Math.abs(autoTotal - 50) < 0.001, `auto-split totals the pot (${autoTotal})`);

  check(
    await expectError(host.rpc('set_game_prizes', { p_game: game1, p_amounts: Object.fromEntries(Object.keys(prizes).map((k) => [k, 1])) }), 'PRIZES_MUST_EQUAL_POT'),
    'custom amounts must equal the pot',
  );
  await host.rpc('set_game_prizes', {
    p_game: game1,
    p_amounts: { fast_5: 5, line_1: 5, line_2: 5, line_3: 5, col_left: 5, col_center: 5, col_right: 5, full_house: 15 },
  });
  check(await expectError(friend.rpc('start_game', { p_game: game1 }), 'NOT_HOST'), 'only host can start');

  const { data: secrets } = await friend.client.from('game_secrets').select('*');
  check((secrets ?? []).length === 0, 'draw order is secret');

  const calls = [];
  await friend.client.realtime.setAuth();
  const channel = friend.client.channel(`room:${room.roomId}`, { config: { private: true } });
  channel.on('broadcast', { event: 'call' }, ({ payload }) => calls.push(payload.n));
  channel.on('broadcast', { event: 'prize' }, ({ payload }) => console.log(`  🏆 ${payload.prize}: ${payload.winners.map((w) => `${w.name} [${w.numbers.join(',')}]`).join(' & ')}`));
  await new Promise((resolve) => channel.subscribe((s) => s === 'SUBSCRIBED' && resolve()));

  await host.rpc('start_game', { p_game: game1 });
  console.log('… game 1 started; players strike & claim as numbers arrive');

  const players = [host, friend];
  const tickets = {};
  for (const p of players) tickets[p.name] = (await p.rpc('get_room_state', { p_room: room.roomId })).myTickets;
  const claimed = new Set();
  const started = Date.now();
  for (;;) {
    await sleep(1500);
    state = await friend.rpc('get_room_state', { p_room: room.roomId });
    const g = state.game;
    if (g.id !== game1 || g.status !== 'running' || Date.now() - started > 8 * 60_000) break;
    process.stdout.write(`\r  called ${g.calledNumbers.length}/90   `);
    for (const p of players) {
      for (const t of tickets[p.name]) {
        for (const pr of state.prizes) {
          const key = `${t.id}:${pr.prize}`;
          if (claimed.has(key) || pr.status === 'settled' || !complete(t.cells, g.calledNumbers, pr.prize)) continue;
          claimed.add(key);
          await p.rpc('claim_prize', { p_ticket: t.id, p_prize: pr.prize }).catch(() => undefined);
        }
      }
    }
    if (g.nextCallAt && Date.parse(g.nextCallAt) < Date.parse(state.serverTime) - 2500) await friend.rpc('nudge_game', { p_game: g.id });
  }
  console.log('');

  const results = await friend.rpc('get_game_results', { p_game: game1 });
  check(results.status === 'finished', 'game 1 finished');
  check(calls.length > 0, `realtime calls received (${calls.length})`);
  const fh = results.prizes.find((p) => p.prize === 'full_house');
  check(fh.status === 'settled' && fh.winners.length > 0, `Full Housie won by ${fh.winners.map((w) => w.name).join(' & ')}`);
  const paid = results.prizes.flatMap((p) => p.winners).reduce((s, w) => s + Number(w.amount), 0);
  check(paid <= 50 && paid > 0, `payouts ₹${paid} ≤ pot ₹50`);
  check(results.prizes.every((p) => p.winners.every((w) => w.numbers.length > 0)), 'winning numbers recorded for the announcement');

  state = await host.rpc('get_room_state', { p_room: room.roomId });
  check(state.game.gameNo === 2 && state.game.status === 'lobby', 'series: game 2 lobby opened automatically');
  check(state.previousGameId === game1, 'game 1 results linked from game 2 lobby');

  const standings = await friend.rpc('get_room_standings', { p_room: room.roomId });
  check(standings.length === 2 && standings.every((s) => s.games === 1), 'standings list both players');
  const won = standings.reduce((s, r) => s + Number(r.won), 0);
  check(Math.abs(won - paid) < 0.01, `standings total won = payouts (₹${won})`);
  for (const s of standings) console.log(`  ${s.name}: won ₹${s.won}, tickets ₹${s.spent}, net ₹${s.net}, ${s.wins} wins`);

  await host.rpc('end_room', { p_room: room.roomId });
  state = await host.rpc('get_room_state', { p_room: room.roomId });
  check(state.room.status === 'ended', 'host can end the series');

  await channel.unsubscribe();
} finally {
  await host.rpc('delete_my_account').catch(() => undefined);
  await friend.rpc('delete_my_account').catch(() => undefined);
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
