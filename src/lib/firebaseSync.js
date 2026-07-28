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
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getDatabase, ref, get, set, update, remove, onValue, off, onDisconnect, serverTimestamp } from 'firebase/database';
import { sGet, sSet, sDelete } from './storage.js';

const ROOM_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L — easy to read/type on a phone
const ABANDONED_MS = 12 * 60 * 60 * 1000; // a room this stale on collision is treated as dead and reclaimed
const SEAT_KEY = 'session-seat';
const STARTING_LIFE = 40;

let db = null;
let authReadyPromise = null;

export function isFirebaseConfigured(config) {
  return !!(config && typeof config === 'object' && config.apiKey && config.databaseURL && config.projectId);
}

// Idempotent: safe to call on every app load once a config exists in Settings.
export function initFirebase(config) {
  if (!db) {
    const app = getApps().length ? getApp() : initializeApp(config);
    db = getDatabase(app);
    const auth = getAuth(app);
    authReadyPromise = auth.currentUser
      ? Promise.resolve(auth.currentUser)
      : signInAnonymously(auth).then((cred) => cred.user);
  }
  return authReadyPromise;
}

async function requireAuth() {
  if (!authReadyPromise) throw new Error('Firebase sync is not set up yet — add a config in Settings first.');
  return authReadyPromise;
}

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

export async function createSession(hostName) {
  const user = await requireAuth();
  const roomCode = await pickRoomCode();
  const playerId = user.uid;
  await set(ref(db, `sessions/${roomCode}`), {
    hostPlayerId: playerId,
    status: 'lobby',
    createdAt: serverTimestamp(),
    lastActiveAt: serverTimestamp(),
    turnOrder: [],
    activePlayerId: null,
    turnNumber: 0,
    timer: { running: false, startedAt: null, accumulatedMs: 0 },
    players: {
      [playerId]: { name: hostName.trim().slice(0, 24), life: STARTING_LIFE, seatOrder: 0, online: true },
    },
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

export async function startSession(roomCode, orderedPlayerIds) {
  await update(ref(db, `sessions/${roomCode}`), {
    turnOrder: orderedPlayerIds,
    activePlayerId: orderedPlayerIds[0] || null,
    turnNumber: 1,
    status: 'playing',
    timer: { running: false, startedAt: null, accumulatedMs: 0 },
    lastActiveAt: serverTimestamp(),
  });
}

export async function leaveSession(roomCode, playerId) {
  const sessionRef = ref(db, `sessions/${roomCode}`);
  const snap = await get(sessionRef);
  if (!snap.exists()) return;
  const session = snap.val();
  const remainingIds = Object.keys(session.players || {}).filter((id) => id !== playerId);
  if (remainingIds.length === 0) {
    await remove(sessionRef);
    return;
  }
  await remove(ref(db, `sessions/${roomCode}/players/${playerId}`));
  const turnOrder = (session.turnOrder || []).filter((id) => id !== playerId);
  const updates = { turnOrder, lastActiveAt: serverTimestamp() };
  if (session.activePlayerId === playerId) updates.activePlayerId = turnOrder[0] || null;
  if (session.hostPlayerId === playerId) updates.hostPlayerId = remainingIds[0];
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

export async function endTurnAndAdvance(roomCode, currentSessionState) {
  const order = currentSessionState.turnOrder || [];
  if (order.length === 0) return;
  const currentIndex = order.indexOf(currentSessionState.activePlayerId);
  const nextIndex = (currentIndex + 1) % order.length;
  const wrapped = nextIndex === 0;
  await update(ref(db, `sessions/${roomCode}`), {
    activePlayerId: order[nextIndex],
    turnNumber: wrapped ? (currentSessionState.turnNumber || 1) + 1 : currentSessionState.turnNumber || 1,
    timer: { running: false, startedAt: null, accumulatedMs: 0 },
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
