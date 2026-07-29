// Persistent "Pod" — separate from the ephemeral 4-char session room code —
// so a group's ELO/win-rate accumulates across many games over time. Reuses
// firebaseSync.js's already-initialized Firebase app/auth (getDb/requireAuth)
// rather than setting up its own.
import { ref, get, update, onValue, off, serverTimestamp, increment } from 'firebase/database';
import { getDb, requireAuth } from './firebaseSync.js';
import { computeEloUpdates } from './elo.js';
import { sGet, sSet, sDelete } from './storage.js';

const POD_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const STARTING_ELO = 1000;
const POD_LINK_KEY = 'pod-link';

async function pickPodCode() {
  const db = getDb();
  for (let attempt = 0; attempt < 5; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) code += POD_CODE_CHARS[Math.floor(Math.random() * POD_CODE_CHARS.length)];
    const snap = await get(ref(db, `pods/${code}`));
    if (!snap.exists()) return code;
  }
  throw new Error('Could not find a free pod code — try again.');
}

export async function createPod(podName, hostName) {
  const user = await requireAuth();
  const db = getDb();
  const podId = await pickPodCode();
  const playerId = user.uid;
  const base = `pods/${podId}`;
  await update(ref(db), {
    [`${base}/name`]: podName.trim().slice(0, 40),
    [`${base}/createdAt`]: serverTimestamp(),
    [`${base}/createdBy`]: playerId,
    [`${base}/members/${playerId}`]: {
      name: hostName.trim().slice(0, 24), elo: STARTING_ELO, gamesPlayed: 0, wins: 0, losses: 0, draws: 0, joinedAt: serverTimestamp(),
    },
  });
  return { podId, playerId };
}

export async function joinPod(podId, playerName) {
  const user = await requireAuth();
  const db = getDb();
  const code = podId.trim().toUpperCase();
  const snap = await get(ref(db, `pods/${code}`));
  if (!snap.exists()) throw new Error(`No pod found for code ${code}.`);
  const playerId = user.uid;
  const already = snap.val().members?.[playerId];
  await update(ref(db, `pods/${code}/members/${playerId}`), already ? {
    name: playerName.trim().slice(0, 24),
  } : {
    name: playerName.trim().slice(0, 24), elo: STARTING_ELO, gamesPlayed: 0, wins: 0, losses: 0, draws: 0, joinedAt: serverTimestamp(),
  });
  return { podId: code, playerId };
}

export function subscribeToPod(podId, onChange) {
  const db = getDb();
  const podRef = ref(db, `pods/${podId}`);
  const handler = (snap) => onChange(snap.exists() ? snap.val() : null);
  onValue(podRef, handler);
  return () => off(podRef, 'value', handler);
}

// Uses Firebase's atomic increment() transform (not a read-then-write) for
// elo/gamesPlayed/wins/losses/draws so this stays correct even if this
// device's `memberElos` snapshot is slightly stale — the append-only
// results/{gameInstanceId} rule (`!data.exists()`) is what actually
// guarantees a given game is only ever submitted once; this function may
// still be called redundantly by multiple fallback devices racing to
// submit, and only one of those calls' result-record write will succeed,
// but the increments themselves are safe regardless.
export async function submitPodResult(podId, gameInstanceId, memberElos, winnerId, turnsPlayed) {
  const db = getDb();
  const user = await requireAuth();
  const deltas = computeEloUpdates(memberElos, winnerId);
  const uids = Object.keys(memberElos);
  const resultBase = `pods/${podId}/results/${gameInstanceId}`;
  const updates = {
    [`${resultBase}/submittedBy`]: user.uid,
    [`${resultBase}/submittedAt`]: serverTimestamp(),
    [`${resultBase}/winnerId`]: winnerId,
    [`${resultBase}/turnsPlayed`]: turnsPlayed,
  };
  uids.forEach((uid) => {
    updates[`${resultBase}/players/${uid}`] = { eloBefore: memberElos[uid], eloDelta: deltas[uid] };
    updates[`pods/${podId}/members/${uid}/elo`] = increment(deltas[uid]);
    updates[`pods/${podId}/members/${uid}/gamesPlayed`] = increment(1);
    if (winnerId === uid) updates[`pods/${podId}/members/${uid}/wins`] = increment(1);
    else if (winnerId == null) updates[`pods/${podId}/members/${uid}/draws`] = increment(1);
    else updates[`pods/${podId}/members/${uid}/losses`] = increment(1);
  });
  await update(ref(db), updates);
}

// Called by every subscribed device once session.gameResult appears on a
// pod-linked session — the host attempts immediately, every other device
// after a grace delay (see GameBoard.jsx), so this needs to be safe to call
// redundantly. First checks whether a result record already exists for this
// gameInstanceId (fast local skip for the common case), but the real
// exactly-once guarantee is the results/{id} rule's `!data.exists()` write
// condition — even if two devices both pass this check near-simultaneously,
// only one of their submitPodResult() writes will actually land.
export async function trySubmitPodResult(podId, gameInstanceId, sessionPlayerUids, winnerId, turnsPlayed) {
  const db = getDb();
  const existing = await get(ref(db, `pods/${podId}/results/${gameInstanceId}`));
  if (existing.exists()) return false;
  const membersSnap = await get(ref(db, `pods/${podId}/members`));
  const members = membersSnap.val() || {};
  const memberElos = {};
  sessionPlayerUids.forEach((uid) => { if (members[uid]) memberElos[uid] = members[uid].elo ?? STARTING_ELO; });
  if (Object.keys(memberElos).length < 2) return false; // not enough pod members in this game to score
  await submitPodResult(podId, gameInstanceId, memberElos, winnerId, turnsPlayed);
  return true;
}

// A pod's roster/history is meant to persist regardless of whether a member
// is actively playing right now — "leaving" only clears this device's
// locally-remembered link, it never removes the member or their stats.
export async function loadLocalPod() {
  return sGet(POD_LINK_KEY, null);
}

export async function saveLocalPod(link) {
  return sSet(POD_LINK_KEY, link);
}

export async function clearLocalPod() {
  return sDelete(POD_LINK_KEY);
}
