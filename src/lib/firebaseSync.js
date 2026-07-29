// Real-time group session sync, backed by Firebase Realtime Database.
// The app has no server of its own — the user brings their own free Firebase
// project (config pasted in Settings, same pattern as the Anthropic API key)
// and this module talks to it directly from the browser. Player identity uses
// silent Anonymous Auth (no login UI) purely so database.rules.json can tell
// "you" apart from other players in the room via auth.uid.
//
// Only life totals, turn order/whose-turn, and timer state are synced here.
// Each player's own deck/hand/battlefield stays local (storage.js), untouched
// by this module.

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence,
  browserSessionPersistence, inMemoryPersistence, signInAnonymously,
} from 'firebase/auth';
import { getDatabase, ref, get, update, remove, onValue, off, onDisconnect, serverTimestamp } from 'firebase/database';
import { sGet, sSet, sDelete } from './storage.js';

const ROOM_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L — easy to read/type on a phone
const ABANDONED_MS = 12 * 60 * 60 * 1000; // a room this stale on collision is treated as dead and reclaimed
const SEAT_KEY = 'session-seat';
const STARTING_LIFE = 40;
const AUTH_TIMEOUT_MS = 10000;

let db = null;
let authReadyPromise = null;

export function isFirebaseConfigured(config) {
  return !!(config && typeof config === 'object' && config.apiKey && config.databaseURL && config.projectId);
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

// Idempotent: safe to call on every app load once a config exists in Settings.
// Some mobile browser contexts (Safari private mode, restrictive in-app
// browsers) don't support IndexedDB reliably, and Firebase Auth's sign-in can
// hang indefinitely instead of erroring when its persistence layer can't work
// — hence the explicit persistence fallback chain and the timeout below,
// rather than trusting getAuth()'s default to always settle.
export function initFirebase(config) {
  if (!db) {
    const app = getApps().length ? getApp() : initializeApp(config);
    db = getDatabase(app);
    const auth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence],
    });
    const signIn = auth.currentUser
      ? Promise.resolve(auth.currentUser)
      : withTimeout(signInAnonymously(auth), AUTH_TIMEOUT_MS, "Couldn't sign in to Firebase — check your connection and try again.").then((cred) => cred.user);
    authReadyPromise = signIn.catch((err) => {
      // Let a future call retry from scratch instead of replaying this same failure forever.
      db = null;
      authReadyPromise = null;
      throw err;
    });
  }
  return authReadyPromise;
}

async function requireAuth() {
  if (!authReadyPromise) throw new Error('Firebase sync is not set up yet — add a config in Settings first.');
  return authReadyPromise;
}

// Exposed for podSync.js, which reuses this module's Firebase app/auth
// instead of re-initializing its own — pods and sessions live in the same
// project.
export function getDb() {
  if (!db) throw new Error('Firebase sync is not set up yet — add a config in Settings first.');
  return db;
}

export { requireAuth };

function randomRoomCode() {
  let code = '';
  for (let i = 0; i < 4; i++) code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  return code;
}

async function pickRoomCode() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomRoomCode();
    const snap = await get(ref(db, `sessions/${code}`));
    if (!snap.exists()) return code;
    if (Date.now() - (snap.val().lastActiveAt || 0) > ABANDONED_MS) return code; // reclaim an abandoned room
  }
  throw new Error('Could not find a free room code — try again.');
}

function registerDisconnectHandlers(roomCode, playerId) {
  onDisconnect(ref(db, `sessions/${roomCode}/players/${playerId}/online`)).set(false);
}

function randomId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

// podId is optional — links this session to a persistent Pod so its result
// can feed the pod's ELO leaderboard. gameInstanceId is a fresh random id,
// independent of the reusable 4-char roomCode (which gets reclaimed after
// ABANDONED_MS and could otherwise collide with a stale result key from an
// unrelated earlier game under the same room code).
export async function createSession(hostName, podId = null) {
  const user = await requireAuth();
  const roomCode = await pickRoomCode();
  const playerId = user.uid;
  // A single set() at sessions/{roomCode} would only be checked against a
  // .write rule at that exact path or an ancestor — and database.rules.json
  // deliberately grants no such blanket rule (see its comments). update()
  // against the root, with one absolute-path key per field, makes each key
  // validate independently against its own field-level rule instead.
  const base = `sessions/${roomCode}`;
  await update(ref(db), {
    [`${base}/hostPlayerId`]: playerId,
    [`${base}/status`]: 'lobby',
    [`${base}/createdAt`]: serverTimestamp(),
    [`${base}/lastActiveAt`]: serverTimestamp(),
    [`${base}/turnOrder`]: [],
    [`${base}/activePlayerId`]: null,
    [`${base}/turnNumber`]: 0,
    [`${base}/timer`]: { running: false, startedAt: null, accumulatedMs: 0 },
    [`${base}/podId`]: podId,
    [`${base}/gameInstanceId`]: randomId(),
    [`${base}/players/${playerId}`]: { name: hostName.trim().slice(0, 24), life: STARTING_LIFE, seatOrder: 0, online: true },
  });
  registerDisconnectHandlers(roomCode, playerId);
  return { roomCode, playerId };
}

export async function joinSession(roomCode, playerName) {
  const user = await requireAuth();
  const playerId = user.uid;
  const code = roomCode.trim().toUpperCase();
  const snap = await get(ref(db, `sessions/${code}`));
  if (!snap.exists()) throw new Error(`No session found for code ${code}.`);
  const session = snap.val();
  const seatOrder = Object.keys(session.players || {}).length;
  await update(ref(db, `sessions/${code}/players/${playerId}`), {
    name: playerName.trim().slice(0, 24),
    life: STARTING_LIFE,
    seatOrder,
    online: true,
  });
  await update(ref(db, `sessions/${code}`), { lastActiveAt: serverTimestamp() });
  registerDisconnectHandlers(code, playerId);
  return { roomCode: code, playerId };
}

export async function startSession(roomCode, orderedPlayerIds, timerMode = 'stopwatch', clockBudgetMs = null) {
  await update(ref(db, `sessions/${roomCode}`), {
    turnOrder: orderedPlayerIds,
    activePlayerId: orderedPlayerIds[0] || null,
    turnNumber: 1,
    status: 'playing',
    timer: { running: false, startedAt: null, accumulatedMs: 0 },
    timerMode,
    clockBudgetMs,
    lastActiveAt: serverTimestamp(),
  });
}

export async function leaveSession(roomCode, playerId) {
  const sessionRef = ref(db, `sessions/${roomCode}`);
  const snap = await get(sessionRef);
  if (!snap.exists()) return;
  const session = snap.val();
  const remainingIds = Object.keys(session.players || {}).filter((id) => id !== playerId);
  // No .write rule is granted on sessions/{roomCode} itself (see createSession's
  // comment), so a whole-node remove() here isn't permitted even for the last
  // player leaving — instead just empty it out; pickRoomCode()'s abandoned-room
  // reclaim (>12h stale) cleans it up whenever the code gets reused.
  await remove(ref(db, `sessions/${roomCode}/players/${playerId}`));
  const turnOrder = (session.turnOrder || []).filter((id) => id !== playerId);
  const updates = { turnOrder, lastActiveAt: serverTimestamp() };
  if (session.activePlayerId === playerId) updates.activePlayerId = turnOrder[0] || null;
  if (session.hostPlayerId === playerId) updates.hostPlayerId = remainingIds[0] || null;
  await update(sessionRef, updates);
}

// Live listener, not a one-shot fetch — deliberately not named like storage.js's sGet.
export function subscribeToSession(roomCode, onChange) {
  const sessionRef = ref(db, `sessions/${roomCode}`);
  const handler = (snap) => onChange(snap.exists() ? snap.val() : null);
  onValue(sessionRef, handler);
  return () => off(sessionRef, 'value', handler);
}

export async function updateMyLife(roomCode, playerId, delta, currentLife) {
  await update(ref(db, `sessions/${roomCode}/players/${playerId}`), { life: (currentLife || 0) + delta });
  await update(ref(db, `sessions/${roomCode}`), { lastActiveAt: serverTimestamp() });
}

// Both scoped to the caller's own players/{playerId} subtree — a plain
// update() is sufficient here (unlike createSession/leaveSession), since
// only one already-owned path is touched per call.
export async function updateMyCommanderDamage(roomCode, playerId, fromPlayerId, slots) {
  await update(ref(db, `sessions/${roomCode}/players/${playerId}/commanderDamage`), { [fromPlayerId]: slots });
}

export async function updateMyCounters(roomCode, playerId, counters) {
  await update(ref(db, `sessions/${roomCode}/players/${playerId}/counters`), counters);
}

export async function startTimer(roomCode) {
  await update(ref(db, `sessions/${roomCode}/timer`), { running: true, startedAt: serverTimestamp() });
  await update(ref(db, `sessions/${roomCode}`), { lastActiveAt: serverTimestamp() });
}

export async function stopTimer(roomCode, currentTimerState) {
  const elapsedSinceStart = currentTimerState.startedAt ? Date.now() - currentTimerState.startedAt : 0;
  await update(ref(db, `sessions/${roomCode}/timer`), {
    running: false,
    startedAt: null,
    accumulatedMs: (currentTimerState.accumulatedMs || 0) + Math.max(0, elapsedSinceStart),
  });
}

// Only a player can initialize their own clock — the host can't set another
// player's clockRemainingMs (blocked by the same auth.uid === $playerId rule
// that already protects `life`), so each device self-initializes on first
// seeing chess-clock mode. Idempotent: safe to call more than once.
export async function initMyClock(roomCode, playerId, budgetMs) {
  await update(ref(db, `sessions/${roomCode}/players/${playerId}`), { clockRemainingMs: budgetMs });
}

// Chess-clock counterpart to endTurnAndAdvance: time is only ever decremented
// at a turn transition (never per-second) to avoid a write-per-second budget
// problem, mirroring how the stopwatch computes its own display client-side
// from accumulatedMs + elapsed-since-startedAt. Spans both a player-owned
// path and shared session-root fields, so — like createSession — this must
// use update()'s fully-qualified multi-path form against the root.
export async function endTurnAndAdvanceChessClock(roomCode, currentSessionState) {
  const order = currentSessionState.turnOrder || [];
  if (order.length === 0) return;
  const outgoingId = currentSessionState.activePlayerId;
  const currentIndex = order.indexOf(outgoingId);
  const nextIndex = (currentIndex + 1) % order.length;
  const wrapped = nextIndex === 0;
  const timer = currentSessionState.timer || {};
  const elapsed = timer.running && timer.startedAt ? Date.now() - timer.startedAt : 0;
  const outgoingRemaining = Math.max(0, (currentSessionState.players?.[outgoingId]?.clockRemainingMs ?? 0) - Math.max(0, elapsed));
  await update(ref(db), {
    [`sessions/${roomCode}/players/${outgoingId}/clockRemainingMs`]: outgoingRemaining,
    [`sessions/${roomCode}/activePlayerId`]: order[nextIndex],
    [`sessions/${roomCode}/turnNumber`]: wrapped ? (currentSessionState.turnNumber || 1) + 1 : currentSessionState.turnNumber || 1,
    [`sessions/${roomCode}/timer`]: { running: true, startedAt: serverTimestamp(), accumulatedMs: 0 },
    [`sessions/${roomCode}/lastActiveAt`]: serverTimestamp(),
  });
}

// Shared "the game is over, X won" event for pod-linked sessions — today
// each device otherwise only records its own result locally, with no
// cross-device notion of a single outcome. Harmless to call even when no
// pod is linked (nothing reads gameResult unless sessionState.podId is also
// present), so callers don't need to pre-check pod-linkage themselves.
export async function broadcastGameResult(roomCode, winnerId) {
  const user = await requireAuth();
  await update(ref(db, `sessions/${roomCode}`), {
    gameResult: { endedBy: user.uid, endedAt: serverTimestamp(), winnerId },
  });
}

export async function endTurnAndAdvance(roomCode, currentSessionState) {
  const order = currentSessionState.turnOrder || [];
  if (order.length === 0) return;
  const currentIndex = order.indexOf(currentSessionState.activePlayerId);
  const nextIndex = (currentIndex + 1) % order.length;
  const wrapped = nextIndex === 0;
  await update(ref(db, `sessions/${roomCode}`), {
    activePlayerId: order[nextIndex],
    turnNumber: wrapped ? (currentSessionState.turnNumber || 1) + 1 : currentSessionState.turnNumber || 1,
    // Starts already running for the next player, instead of leaving them to
    // press Start themselves — the next player's own device still owns
    // stopping it and passing the turn again.
    timer: { running: true, startedAt: serverTimestamp(), accumulatedMs: 0 },
    lastActiveAt: serverTimestamp(),
  });
}

// Reads the saved Firebase config, initializes (idempotent), and reports the
// locally-remembered seat, if any. Called independently by every component
// that needs to know "is there a live session?" (GroupSession, GameSetup) —
// safe to call from more than one place since initFirebase() no-ops if
// already set up.
export async function bootstrapSession() {
  const config = await sGet('settings:firebaseConfig', null);
  if (!isFirebaseConfigured(config)) return { configured: false, seat: null };
  await initFirebase(config);
  const seat = await sGet(SEAT_KEY, null);
  return { configured: true, seat };
}

// "Which seat am I" persistence, local to this device — so a page refresh
// resumes the same room/player instead of dropping back to create/join.
export async function loadLocalSeat() {
  return sGet(SEAT_KEY, null);
}

export async function saveLocalSeat(seat) {
  return sSet(SEAT_KEY, seat);
}

export async function clearLocalSeat() {
  return sDelete(SEAT_KEY);
}
