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

const PIN = '4821';

async function guest(name) {
  const client = createClient(URL, KEY, { auth: { persistSession: false } });
  // Same path as the app: name + mobile + PIN → phone_register → sign in.
  const mobile = '6' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
  const creds = await client.rpc('phone_register', { p_phone: mobile, p_name: name, p_pin: PIN });
  if (creds.error) throw new Error(`phone_register failed: ${creds.error.message}`);
  const { error } = await client.auth.signInWithPassword(creds.data);
  if (error) throw new Error(`sign-in failed: ${error.message}`);
  const rpc = async (fn, args) => {
    const { data, error: e } = await client.rpc(fn, args);
    if (e) throw new Error(`${name}.${fn}: ${e.message}`);
    return data;
  };
  return { client, rpc, name, mobile };
}

/** PIN login rules, from a signed-out client (like a fresh phone). */
async function checkPinLogin(player) {
  const anon = createClient(URL, KEY, { auth: { persistSession: false } });
  const login = async (pin) => (await anon.rpc('pin_login', { p_phone: player.mobile, p_pin: pin })).data;
  const ok = await login(PIN);
  check(!!ok?.email && !!ok?.password, 'login with mobile + correct PIN');
  const wrong = await login('0000');
  check(wrong?.error === 'WRONG_PIN' && wrong.attemptsLeft === 4, `wrong PIN refused (${wrong?.attemptsLeft} tries left)`);
  check((await login(PIN))?.email !== undefined, 'correct PIN resets the wrong-try count');
  for (let i = 0; i < 4; i++) await login('1111');
  const locked = await login('1111');
  check(locked?.error === 'PIN_LOCKED', '5 wrong PINs lock the account');
  check((await login(PIN))?.error === 'PIN_LOCKED', 'even the right PIN waits while locked');
  const again = await anon.rpc('phone_register', { p_phone: player.mobile, p_name: 'Someone Else', p_pin: '9999' });
  check(again.error?.message === 'PHONE_TAKEN', 'a registered number cannot be registered again');
  const none = await anon.rpc('pin_login', { p_phone: '6000000001', p_pin: PIN });
  check(none.data?.error === 'ACCOUNT_NOT_FOUND', 'unknown number → ACCOUNT_NOT_FOUND');
  const old = await anon.rpc('phone_login', { p_phone: player.mobile, p_name: 'x' });
  check(!!old.error, 'old number-only login is gone');
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
  // Uses a third throwaway account so the lock doesn't affect the game below.
  const pinTester = await guest('Pin Tester');
  try {
    await checkPinLogin(pinTester);
  } finally {
    await pinTester.rpc('delete_my_account').catch(() => undefined);
  }

  const me = await friend.rpc('get_me');
  check(me.displayName === 'Manikanta Yerraguntla', `name from signup kept (${me.displayName})`);

  const prizes = { fast_5: 10, line_1: 10, line_2: 10, line_3: 10, col_left: 10, col_center: 10, col_right: 10, full_house: 30 };
  const room = await host.rpc('create_room', {
    p_title: 'Smoke Series', p_kind: 'series', p_visibility: 'public', p_max_players: 5,
    p_ticket_price: 10, p_call_interval_seconds: 3, p_series_length: 2, p_prizes: prizes,
  });
  check(/^[A-Z2-9]{6}$/.test(room.code), `series room created (${room.code})`);
  // Play coins for the whole game: tickets cost coins and prizes pay coins.
  await host.rpc('set_stake_mode', { p_room: room.roomId, p_mode: 'coins' });

  const pub = await friend.rpc('list_public_rooms');
  check(pub.some((r) => r.id === room.roomId), 'room listed as public');
  const jr = await friend.rpc('join_room_by_code', { p_code: room.code.toLowerCase() });
  check(jr.status === 'pending', 'friend asked to join (waits for host)');
  const friendId = (await friend.rpc('get_me')).id;
  await host.rpc('respond_join_request', { p_room: room.roomId, p_user: friendId, p_accept: true });
  check((await friend.rpc('my_join_status', { p_room: room.roomId })).status === 'member', 'host accepted the friend');

  let state = await host.rpc('get_room_state', { p_room: room.roomId });
  const game1 = state.game.id;
  check(state.game.status === 'lobby' && state.game.gameNo === 1, 'game 1 lobby open');
  check(state.game.phase === 'joining' && state.room.checkClaims === true, 'lobby starts at "joining"; check-before-announcing on by default');

  // Late claim (Normal rule): off by default; host-only; 0–90 numbers.
  check(state.room.lateClaimCalls === 0, 'late claim off by default');
  check(await expectError(friend.rpc('set_late_claim', { p_room: room.roomId, p_calls: 2 }), 'NOT_HOST'), 'only host sets late claim');
  check(await expectError(host.rpc('set_late_claim', { p_room: room.roomId, p_calls: 91 }), 'INVALID_LATE_CLAIM'), 'late claim max 90');
  await host.rpc('set_late_claim', { p_room: room.roomId, p_calls: 2 });
  check((await friend.rpc('get_room_state', { p_room: room.roomId })).room.lateClaimCalls === 2, 'late claim set to 2 (seen by players)');

  check(await expectError(host.rpc('set_my_tickets', { p_game: game1, p_count: 2 }), 'TICKETS_NOT_OPEN'), 'no tickets before the host opens them');
  check(await expectError(friend.rpc('open_tickets', { p_game: game1 }), 'NOT_HOST'), 'only host opens tickets');
  await host.rpc('open_tickets', { p_game: game1 });
  check((await friend.rpc('get_room_state', { p_room: room.roomId })).game.phase === 'tickets', 'host moved everyone to the ticket step');

  await host.rpc('set_my_tickets', { p_game: game1, p_count: 2 });
  check(await expectError(host.rpc('start_game', { p_game: game1 }), 'NOT_ALL_READY'), 'cannot start before everyone is ready');
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
  const claimChecks = [];
  channel.on('broadcast', { event: 'claim_check' }, ({ payload }) => claimChecks.push(payload.prize));
  channel.on('broadcast', { event: 'prize_settled' }, ({ payload }) =>
    console.log(`  🏆 ${payload.prize} @${payload.callIndex}: ${payload.winnerList.map((w) => `${w.name} ₹${w.amount}`).join(' & ')}`),
  );
  channel.on('broadcast', { event: 'prize' }, ({ payload }) => console.log(`  🏆 ${payload.prize}: ${payload.winners.map((w) => `${w.name} [${w.numbers.join(',')}]`).join(' & ')}`));
  const chats = [];
  channel.on('broadcast', { event: 'chat' }, ({ payload }) => chats.push(payload.body));
  await new Promise((resolve) => channel.subscribe((s) => s === 'SUBSCRIBED' && resolve()));

  check(state.room.chatEnabled === true, 'room chat on by default');
  await host.rpc('send_chat', { p_room: room.roomId, p_body: 'All the best!' });
  await sleep(1500);
  check(chats.includes('All the best!'), 'chat message reached the other player live');
  check((await friend.rpc('get_chat', { p_room: room.roomId })).some((m) => m.body === 'All the best!'), 'chat history saved');
  check((await host.rpc('get_chat', { p_room: room.roomId })).some((m) => m.kind === 'join' && m.userId === friendId), 'chat shows "friend joined" line');

  // A late joiner sees chat only from when they joined; leaving writes a "left" line.
  const late = await guest('Late Joiner');
  try {
    await late.rpc('join_room_by_code', { p_code: room.code });
    await host.rpc('respond_join_request', { p_room: room.roomId, p_user: (await late.rpc('get_me')).id, p_accept: true });
    const lateChat = await late.rpc('get_chat', { p_room: room.roomId });
    check(!lateChat.some((m) => m.body === 'All the best!'), 'late joiner does not see the older chat');
    check(lateChat.some((m) => m.kind === 'join'), 'late joiner sees their own "joined" line');
    await late.rpc('send_chat', { p_room: room.roomId, p_body: 'Hi all, joined mid-game' });
    check((await host.rpc('get_chat', { p_room: room.roomId })).some((m) => m.body === 'Hi all, joined mid-game'), 'a player let in mid-game can chat');
    await late.rpc('leave_room', { p_room: room.roomId });
    check((await host.rpc('get_chat', { p_room: room.roomId })).some((m) => m.kind === 'leave'), 'chat shows "left" line');
  } finally {
    await late.rpc('delete_my_account').catch(() => undefined);
  }

  // Series games can be changed from the lobby (then back to 2 for this test).
  await host.rpc('set_series_length', { p_room: room.roomId, p_len: 3 });
  check((await friend.rpc('get_room_state', { p_room: room.roomId })).room.totalGames === 3, 'host changed the series to 3 games');
  await host.rpc('set_series_length', { p_room: room.roomId, p_len: 2 });
  check(await expectError(friend.rpc('set_series_length', { p_room: room.roomId, p_len: 4 }), 'NOT_HOST'), 'only host changes the series length');

  // Step 3: host sets prizes → everyone ready → the game starts by itself.
  await host.rpc('open_ready', { p_game: game1 });
  check((await friend.rpc('get_room_state', { p_room: room.roomId })).game.phase === 'ready', 'ready step open after the host sets prizes');
  await friend.rpc('set_ready', { p_game: game1 });
  check((await host.rpc('get_room_state', { p_room: room.roomId })).game.status === 'lobby', 'everyone ready — waiting for the host to start');
  await host.rpc('start_game', { p_game: game1 });
  check((await host.rpc('get_room_state', { p_room: room.roomId })).game.status === 'running', 'host started the game');
  // A player can ask the host to pause (once per 30 s).
  await friend.rpc('request_pause', { p_game: game1 });
  check(await expectError(friend.rpc('request_pause', { p_game: game1 }), 'PAUSE_ASKED_RECENTLY'), 'pause request sent; a second one right away is refused');
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
  check(claimChecks.length > 0, `claims went through "check your tickets" first (${claimChecks.length})`);
  const fh = results.prizes.find((p) => p.prize === 'full_house');
  check(fh.status === 'settled' && fh.winners.length > 0, `Full Housie won by ${fh.winners.map((w) => w.name).join(' & ')}`);
  const paid = results.prizes.flatMap((p) => p.winners).reduce((s, w) => s + Number(w.amount), 0);
  check(paid <= 50 && paid > 0, `payouts ₹${paid} ≤ pot ₹50`);
  check(results.prizes.every((p) => p.winners.every((w) => w.numbers.length > 0)), 'winning numbers recorded for the announcement');

  state = await host.rpc('get_room_state', { p_room: room.roomId });
  check(state.game.gameNo === 2 && state.game.status === 'lobby' && state.game.phase === 'joining', 'series: game 2 lobby opened automatically (back to step 1)');
  check(state.previousGameId === game1, 'game 1 results linked from game 2 lobby');

  const standings = await friend.rpc('get_room_standings', { p_room: room.roomId });
  check(standings.length === 2 && standings.every((s) => s.games === 1 && s.isMember), 'standings list both players');
  const ledger = await host.rpc('get_room_ledger', { p_room: room.roomId });
  check(ledger.length === 1 && ledger[0].rows.length === 2, 'game-by-game ledger has game 1 for both players');
  const won = standings.reduce((s, r) => s + Number(r.won), 0);
  check(Math.abs(won - paid) < 0.01, `standings total won = payouts (₹${won})`);
  // Coins: every player's balance = 1000 − tickets + prizes (game 1 only so far).
  for (const [p, label] of [[host, 'host'], [friend, 'friend']]) {
    const me2 = await p.rpc('get_me');
    const row = standings.find((r) => r.userId === me2.id);
    const expected = 1000 - Number(row.spent) + Number(row.won);
    check(Math.abs(Number(me2.coins) - expected) < 0.01, `${label} coins = 1000 − ${row.spent} + ${row.won} = ${expected} (has ${me2.coins})`);
  }
  for (const s of standings) console.log(`  ${s.name}: won ₹${s.won}, tickets ₹${s.spent}, net ₹${s.net}, ${s.wins} wins`);

  await host.rpc('end_room', { p_room: room.roomId });
  state = await host.rpc('get_room_state', { p_room: room.roomId });
  check(state.room.status === 'ended', 'host can end the series');

  // A player who leaves keeps the room's history; ended rooms show their delete date.
  await friend.rpc('leave_room', { p_room: room.roomId });
  let mine = await friend.rpc('get_my_rooms', {});
  const left = mine.find((r) => r.id === room.roomId);
  check(left && left.isMember === false, 'left room still listed in My rooms (as left)');
  check(left && !!left.deleteAt, `ended room shows its delete date (${left?.deleteAt?.slice(0, 10)})`);
  check((await friend.rpc('get_room_standings', { p_room: room.roomId })).length >= 2, 'left player can still read the standings');
  await friend.rpc('hide_room', { p_room: room.roomId });
  mine = await friend.rpc('get_my_rooms', {});
  check(!mine.some((r) => r.id === room.roomId), 'Remove from My rooms works');

  await channel.unsubscribe();

  // ── Coins room (play coins only): pay for tickets, refunds, limit, few repeats ──
  const coinsOf = async (p) => Number((await p.rpc('get_me')).coins);
  const croom = await host.rpc('create_room', {
    p_title: 'Smoke Coins', p_kind: 'normal', p_visibility: 'private', p_max_players: 5,
    p_ticket_price: 25, p_call_interval_seconds: 3, p_series_length: 1, p_prizes: prizes,
  });
  await host.rpc('set_stake_mode', { p_room: croom.roomId, p_mode: 'coins' });
  await host.rpc('set_max_tickets', { p_room: croom.roomId, p_max: 6 });
  await friend.rpc('join_room_by_code', { p_code: croom.code });
  await host.rpc('respond_join_request', { p_room: croom.roomId, p_user: friendId, p_accept: true });
  let cstate = await friend.rpc('get_room_state', { p_room: croom.roomId });
  check(cstate.room.stakeMode === 'coins' && cstate.room.maxTickets === 6, 'coins room with a 6-ticket limit');
  const cgame = cstate.game.id;
  await host.rpc('open_tickets', { p_game: cgame });
  const before = await coinsOf(friend);
  check(await expectError(friend.rpc('set_my_tickets', { p_game: cgame, p_count: 7 }), 'INVALID_TICKET_COUNT'), 'more than the room limit is refused');
  const bought = await friend.rpc('set_my_tickets', { p_game: cgame, p_count: 6 });
  check((await coinsOf(friend)) === before - 150, `6 tickets × 25 coins taken (${before} → ${await coinsOf(friend)})`);
  // Few repeats: pairs of a player's tickets share on average far fewer numbers than random (~2.5).
  let shared = 0, pairs = 0;
  for (let i = 0; i < bought.length; i++) for (let j = i + 1; j < bought.length; j++) {
    const a = new Set(bought[i].cells.filter((n) => n > 0));
    shared += bought[j].cells.filter((n) => n > 0 && a.has(n)).length; pairs++;
  }
  check(shared / pairs < 1.8, `tickets share few numbers (avg ${(shared / pairs).toFixed(2)} per pair)`);
  await friend.rpc('leave_room', { p_room: croom.roomId });
  check((await coinsOf(friend)) === before, 'leaving the lobby refunds the coins');
  await host.rpc('set_my_tickets', { p_game: cgame, p_count: 2 });
  const hostAfterBuy = await coinsOf(host);
  await host.rpc('end_room', { p_room: croom.roomId });
  check((await coinsOf(host)) === hostAfterBuy + 50, 'dismissed room refunds its coins');
  check((await host.rpc('get_my_coin_ledger', {})).some((l) => l.reason === 'refund'), 'coin history records the refund');

  // ── ₹ Amount rooms: anyone can make one (scores only; settled outside the app) ──
  {
    const ar = await host.rpc('create_room', {
      p_title: 'Smoke Amount', p_kind: 'normal', p_visibility: 'private', p_max_players: 5,
      p_ticket_price: 10, p_call_interval_seconds: 3, p_series_length: 1, p_prizes: prizes,
    });
    check((await host.rpc('get_room_state', { p_room: ar.roomId })).room.stakeMode === 'free', 'new rooms start Free');
    await host.rpc('set_stake_mode', { p_room: ar.roomId, p_mode: 'amount' });
    check((await host.rpc('get_room_state', { p_room: ar.roomId })).room.stakeMode === 'amount', 'any player can make a ₹ Amount room');
    await host.rpc('end_room', { p_room: ar.roomId });
  }

  // ── Party games: Find Seeta and Show (3 players, points only) ──
  console.log('\n— Party games —');
  const third = await guest('Party Third');
  try {
    const crew = [host, friend, third];
    const stateOf = (p, id) => p.rpc('get_party_state', { p_game: id });

    // Find Seeta
    const seeta = await host.rpc('create_party', { p_kind: 'seeta', p_rounds: 3 });
    await friend.rpc('join_party_by_code', { p_code: seeta.code });
    check(await expectError(host.rpc('start_party', { p_game: seeta.id }), 'NEED_MORE_PLAYERS'), 'Find Seeta needs 3 players');
    await third.rpc('join_party_by_code', { p_code: seeta.code });
    await host.rpc('start_party', { p_game: seeta.id });
    let states = await Promise.all(crew.map((p) => stateOf(p, seeta.id)));
    const roles = states.map((s) => s.me.role);
    check(roles.includes('ram') && roles.includes('seeta') && roles.includes('lakshmana'), `roles dealt (${roles.join(', ')})`);
    check(states.every((s) => !JSON.stringify(s.game.state).includes('seeta"')), 'nobody can see Seeta before the guess');
    const ramIdx = roles.indexOf('ram');
    const seetaIdx = roles.indexOf('seeta');
    const notRam = crew[(ramIdx + 1) % 3];
    check(await expectError(notRam.rpc('seeta_guess', { p_game: seeta.id, p_target: states[seetaIdx].me.userId }), 'NOT_RAM'), 'only Ram can guess');
    await crew[ramIdx].rpc('seeta_guess', { p_game: seeta.id, p_target: states[seetaIdx].me.userId });
    states = await Promise.all(crew.map((p) => stateOf(p, seeta.id)));
    const score = (s, i) => s.players.find((p) => p.userId === states[i].me.userId).score;
    check(states[0].game.phase === 'reveal' && states[0].game.state.correct === true, 'right guess revealed');
    check(score(states[0], ramIdx) === 1000 && score(states[0], seetaIdx) === 0, 'Ram keeps 1000, Seeta 0');
    check(score(states[0], 3 - ramIdx - seetaIdx) === 800, 'Lakshmana gets 800');

    // Show
    const show = await host.rpc('create_party', { p_kind: 'show', p_rounds: 3 });
    await friend.rpc('join_party_by_code', { p_code: show.code });
    await third.rpc('join_party_by_code', { p_code: show.code });
    await host.rpc('start_party', { p_game: show.id });
    states = await Promise.all(crew.map((p) => stateOf(p, show.id)));
    const cards = states.flatMap((s) => s.me.hand);
    const counts = [0, 1, 2].map((c) => cards.filter((x) => x === c).length);
    check(states.every((s) => s.me.hand.length === 4) && counts.every((n) => n === 4), 'Show deals 4 cards each, 4 of each colour');
    check(await expectError(host.rpc('show_call', { p_game: show.id }), 'NOT_A_SHOW'), 'SHOW needs four of a colour');
    const before3 = states.map((s) => s.me.hand.slice());
    await Promise.all(crew.map((p) => p.rpc('show_pick', { p_game: show.id, p_index: 0 })));
    states = await Promise.all(crew.map((p) => stateOf(p, show.id)));
    // Seat order host(0) → friend(1) → third(2) → host: each first card moves to the next seat.
    const seatOf = (i) => states[i].players.find((p) => p.userId === states[i].me.userId).seat;
    const bySeat = [0, 1, 2].map((seat) => [0, 1, 2].find((i) => seatOf(i) === seat));
    const passedOk = bySeat.every((i, seat) => {
      const fromIdx = bySeat[(seat + 2) % 3];
      return states[i].me.hand[0] === before3[fromIdx][0];
    });
    check(states[0].game.turnNo === 2 && passedOk, 'all picks pass to the next seat at once');
    // Play turns until someone holds four of a kind (picking a card that breaks no pair).
    let shower = -1;
    for (let turn = 0; turn < 200 && shower < 0; turn++) {
      states = await Promise.all(crew.map((p) => stateOf(p, show.id)));
      shower = states.findIndex((s) => s.me.hand.every((c) => c === s.me.hand[0]));
      if (shower >= 0) break;
      await Promise.all(crew.map((p, i) => {
        const h = states[i].me.hand;
        const tally = (c) => h.filter((x) => x === c).length;
        // Pass one of the least useful cards, chosen at random (a fixed choice can loop for ever).
        const least = Math.min(...h.map(tally));
        const options = [0, 1, 2, 3].filter((k) => tally(h[k]) === least);
        const pick = options[Math.floor(Math.random() * options.length)];
        return p.rpc('show_pick', { p_game: show.id, p_index: pick });
      }));
    }
    check(shower >= 0, 'someone collects four of a kind');
    if (shower >= 0) {
      await crew[shower].rpc('show_call', { p_game: show.id });
      const order = [shower, (shower + 1) % 3, (shower + 2) % 3];
      await crew[order[1]].rpc('show_call', { p_game: show.id });
      await crew[order[2]].rpc('show_call', { p_game: show.id });
      const fin = await stateOf(host, show.id);
      const pts = (i) => fin.players.find((p) => p.userId === states[i].me.userId).score;
      check(fin.game.phase === 'reveal' && pts(order[0]) === 200 && pts(order[1]) === 100 && pts(order[2]) === 0,
        'SHOW race scored 200 / 100 / 0 (last one gets nothing)');
    }
    // Leaving mid-game below 3 players ends it.
    await third.rpc('leave_party', { p_game: show.id });
    check((await stateOf(host, show.id)).game.status === 'finished', 'fewer than 3 players ends the game');
    await host.rpc('play_party_again', { p_game: show.id });
    check((await stateOf(host, show.id)).game.status === 'lobby', 'host can play again');
    await host.rpc('end_party', { p_game: show.id });
    await host.rpc('end_party', { p_game: seeta.id });
    check(await expectError(third.rpc('join_party_by_code', { p_code: seeta.code }), 'PARTY_NOT_FOUND'), 'an ended game cannot be joined');

    // Show categories: built-in or the host's own items (at least one per player).
    const cat = await host.rpc('create_party', { p_kind: 'show', p_rounds: 3 });
    check((await stateOf(host, cat.id)).game.options.category === 'colors', 'Show starts with the Colours category');
    check(await expectError(host.rpc('set_party_options', { p_game: cat.id, p_category: 'custom', p_items: [{ n: 'A' }, { n: 'B' }], p_title: 'Mine' }), 'INVALID_CATEGORY'),
      'a category needs at least 3 items');
    await host.rpc('set_party_options', { p_game: cat.id, p_category: 'custom', p_items: [{ e: '🍕', n: 'Pizza' }, { e: '🍔', n: 'Burger' }, { e: '🌮', n: 'Taco' }], p_title: 'Food' });
    const catState = await stateOf(host, cat.id);
    check(catState.game.options.title === 'Food' && catState.game.options.items.length === 3, 'custom category saved for everyone');
    check(await expectError(friend.rpc('set_party_options', { p_game: cat.id, p_category: 'fruits', p_items: null, p_title: null }), 'NOT_HOST'), 'only the host picks the category');
    await host.rpc('end_party', { p_game: cat.id });

    // Snakes & Ladders: 2 players, roll until someone reaches 100.
    const coinsBefore = { host: await coinsOf(host), friend: await coinsOf(friend) };
    const snl = await host.rpc('create_party', { p_kind: 'snakes', p_rounds: 5, p_entry: 50, p_options: { board: 2 } });
    await friend.rpc('join_party_by_code', { p_code: snl.code });
    await host.rpc('start_party', { p_game: snl.id });
    let snlState = await stateOf(host, snl.id);
    check(snlState.game.status === 'playing' && snlState.game.state.turn === snlState.me.userId, 'Snakes & Ladders starts with 2 players, host first');
    check(await expectError(friend.rpc('snakes_roll', { p_game: snl.id }), 'NOT_YOUR_TURN'), 'only the player whose turn it is can roll');
    const board = snlState.game.state.board;
    const nL = Object.keys(board?.ladders ?? {}).length, nS = Object.keys(board?.snakes ?? {}).length;
    const ends = [...Object.entries(board.ladders), ...Object.entries(board.snakes)].flat().map(Number);
    check(nL >= 6 && nS >= 6 && !Object.values(board.ladders).includes(100) && new Set(ends).size === ends.length,
      `the chosen board (${nL} ladders, ${nS} snakes, none to 100, no shared ends)`);
    check(board.ladders['4'] === 44 && board.snakes['78'] === 2, 'board 3 of 5 is the one the host picked');
    check(Object.entries(board.snakes).some(([h, t]) => h - t >= 50), 'the board has a big snake');
    const jump = (p) => board.ladders[p] ?? board.snakes[p] ?? p;
    const duo = { [snlState.me.userId]: host, [(await stateOf(friend, snl.id)).me.userId]: friend };
    let movesOk = true;
    for (let i = 0; i < 600 && snlState.game.status === 'playing'; i++) {
      const who = duo[snlState.game.state.turn];
      await who.rpc('snakes_roll', { p_game: snl.id });
      snlState = await stateOf(host, snl.id);
      const l = snlState.game.state.last;
      const entered = l.from > 0 || (l.roll === 1 ? l.mid === 1 : l.mid === 0);
      if (!(l.roll >= 1 && l.roll <= 6 && entered && l.to === jump(l.mid) && (l.from === 0 || l.mid === l.from + l.roll || (l.mid === l.from && l.from + l.roll > 100)))) movesOk = false;
    }
    check(movesOk, 'every roll is 1–6, a 1 brings a token onto the board, and moves follow the ladders and snakes');
    await friend.rpc('send_party_chat', { p_game: snl.id, p_body: 'Good luck!' });
    check((await host.rpc('get_party_chat', { p_game: snl.id })).some((m) => m.body === 'Good luck!'), 'party games have chat');
    const winner = snlState.players.find((p) => p.userId === snlState.game.state.winnerId);
    check(snlState.game.status === 'finished' && winner?.score === 100, 'first to 100 wins');
    const hostWon = snlState.game.state.winnerId === snlState.me.userId;
    const hostNow = await coinsOf(host), friendNow = await coinsOf(friend);
    check(hostNow === coinsBefore.host + (hostWon ? 50 : -50) && friendNow === coinsBefore.friend + (hostWon ? -50 : 50),
      `entry 50 coins each, winner takes the 100 pot (host ${coinsBefore.host}→${hostNow}, friend ${coinsBefore.friend}→${friendNow})`);
    check(snlState.game.state.payout?.pot === 100, 'payout recorded on the game');
    await host.rpc('end_party', { p_game: snl.id });

    // Ashta Chamma: 2 players (opposite sides), seeds, entering on 4 / 8, cuts.
    const ach = await host.rpc('create_party', { p_kind: 'chamma', p_rounds: 5 });
    await friend.rpc('join_party_by_code', { p_code: ach.code });
    await third.rpc('join_party_by_code', { p_code: ach.code });
    await host.rpc('start_party', { p_game: ach.id });
    let ac = await stateOf(host, ach.id);
    const sides = Object.values(ac.game.state.sides).sort();
    check(sides.join(',') === '0,1,2', `3 players sit on sides ${sides.join(', ')}`);
    const trio = { [ac.me.userId]: host };
    trio[(await stateOf(friend, ach.id)).me.userId] = friend;
    trio[(await stateOf(third, ach.id)).me.userId] = third;
    const target = (idx, th, cut) => (idx === 24 ? null : idx === -1 ? ([4, 8].includes(th) ? 0 : null) : !cut ? (idx + th) % 16 : idx + th > 24 ? null : idx + th);
    let throwsOk = true, enterOk = true, ringOk = true, cuts = 0;
    for (let i = 0; i < 300 && ac.game.status === 'playing'; i++) {
      const turn = ac.game.state.turn;
      const p = trio[turn];
      if (ac.game.phase === 'throw') {
        const beforePawns = ac.game.state.pawns[turn].slice();
        await p.rpc('chamma_throw', { p_game: ach.id });
        ac = await stateOf(host, ach.id);
        const seedsUp = (ac.game.state.seeds ?? []).filter(Boolean).length;
        const th = ac.game.state.throw;
        if (th !== null && th !== (seedsUp === 0 ? 8 : seedsUp)) throwsOk = false;
        if (beforePawns.every((x) => x === -1) && ![4, 8].includes(seedsUp === 0 ? 8 : seedsUp) && ac.game.phase === 'move') enterOk = false;
      } else {
        const pawns = ac.game.state.pawns[turn];
        const cut = ac.game.state.cut[turn];
        const th = ac.game.state.throw;
        const k = pawns.findIndex((x) => target(x, th, cut) !== null);
        await p.rpc('chamma_move', { p_game: ach.id, p_pawn: k });
        ac = await stateOf(host, ach.id);
        cuts += ac.game.state.last?.captured?.length ?? 0;
      }
      for (const [uid, pw] of Object.entries(ac.game.state.pawns)) {
        if (!ac.game.state.cut[uid] && pw.some((x) => x > 15)) ringOk = false;
      }
    }
    check(throwsOk, 'seed throws: n seeds up = n, none up = 8');
    check(enterOk, 'a pawn comes in only on a 4 or 8');
    check(ringOk, 'no pawn enters the inner ring before its player has cut');
    check(true, `${cuts} cut(s) in 300 moves; game ${ac.game.status}`);
    await host.rpc('end_party', { p_game: ach.id });

    // Ashta Chamma options: start on the board, straight-in safe squares, teams need 4.
    const ach2 = await host.rpc('create_party', { p_kind: 'chamma', p_rounds: 1, p_entry: 0, p_options: { start: 'board', safe: 'straight', teams: true, needCut: false } });
    await friend.rpc('join_party_by_code', { p_code: ach2.code });
    await third.rpc('join_party_by_code', { p_code: ach2.code });
    check(await expectError(host.rpc('start_party', { p_game: ach2.id }), 'TEAMS_NEED_4'), 'teams need exactly 4 players');
    await host.rpc('end_party', { p_game: ach2.id });
    const ach3 = await host.rpc('create_party', { p_kind: 'chamma', p_rounds: 1, p_entry: 0, p_options: { start: 'board', safe: 'straight', needCut: false } });
    await friend.rpc('join_party_by_code', { p_code: ach3.code });
    await host.rpc('start_party', { p_game: ach3.id });
    const a3 = await stateOf(host, ach3.id);
    check(Object.values(a3.game.state.pawns).every((p) => p.every((x) => x === 0)) && a3.game.state.safe === 'straight' && a3.game.state.needCut === false,
      'options: all pawns start on the board, straight safe squares, no cut needed');

    // 3 chances: nobody plays → after 3 missed turns the host is out and the friend wins.
    console.log('  (waiting for 5 missed turns, ~110 s)');
    let a3s = a3;
    for (let i = 0; i < 70 && a3s.game.status === 'playing'; i++) {
      await sleep(2000);
      await friend.rpc('party_nudge', { p_game: ach3.id }).catch(() => undefined);
      a3s = await stateOf(friend, ach3.id);
    }
    const misses = a3s.game.state.misses ?? {};
    const outId = Object.keys(misses).find((u) => misses[u] >= 3);
    check(a3s.game.status === 'finished' && !!outId && a3s.game.state.winnerId !== outId && (misses[a3s.game.state.winnerId] ?? 0) < 3,
      `3 missed turns put a player out; the other wins (misses ${JSON.stringify(Object.values(misses))})`);
  } finally {
    await third.rpc('delete_my_account').catch(() => undefined);
  }
} finally {
  await host.rpc('delete_my_account').catch(() => undefined);
  await friend.rpc('delete_my_account').catch(() => undefined);
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
