// A tiny async wrapper around localStorage so it's a drop-in swap for a
// future real backend (e.g. IndexedDB, or a sync API) without touching
// every component that reads/writes state.

const PREFIX = 'commander-ledger:';

export async function sGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error('storage get failed', key, e);
    return fallback;
  }
}

export async function sSet(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('storage set failed', key, e);
    return false;
  }
}

export async function sDelete(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch (e) {
    /* ignore */
  }
}

export async function sList(prefix = '') {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX + prefix)) keys.push(k.slice(PREFIX.length));
  }
  return keys;
}
