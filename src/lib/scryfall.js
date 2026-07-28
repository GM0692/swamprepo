// Scryfall's public API serves card art directly and allows normal
// browser <img> loading (no API key, no auth). This only failed inside
// the Claude.ai artifact sandbox because of its content-security-policy —
// it works normally in a real page.
//
// Card lookups are batched through the bulk /cards/collection endpoint
// (up to 75 identifiers per request) instead of one request per card via
// /cards/named — firing dozens of individual named-lookup requests at once
// (e.g. toggling the deck list to image view) trips Scryfall's rate limit
// and a chunk of them come back failed. Results are cached in memory so a
// given card is only ever looked up once per session.

const CHUNK_SIZE = 75;
const FLUSH_DELAY_MS = 20;

const cache = new Map(); // lowercase name -> image URL or null (not found)
const pendingResolvers = new Map(); // lowercase name -> resolve fns waiting on it
let queue = []; // [{ name, key }] waiting to be sent
let flushTimer = null;

function extractImageUrl(card, size) {
  if (card.image_uris) return card.image_uris[size] || card.image_uris.normal || null;
  if (card.card_faces?.[0]?.image_uris) {
    return card.card_faces[0].image_uris[size] || card.card_faces[0].image_uris.normal || null;
  }
  return null;
}

function settle(key, url) {
  cache.set(key, url);
  const resolvers = pendingResolvers.get(key);
  if (resolvers) {
    resolvers.forEach((resolve) => resolve(url));
    pendingResolvers.delete(key);
  }
}

async function resolveChunk(chunk, size) {
  try {
    const res = await fetch('https://api.scryfall.com/cards/collection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers: chunk.map(({ name }) => ({ name })) }),
    });
    const data = await res.json();
    const foundKeys = new Set();
    (data.data || []).forEach((card) => {
      const key = card.name.toLowerCase();
      foundKeys.add(key);
      settle(key, extractImageUrl(card, size));
    });
    chunk.forEach(({ key }) => {
      if (!foundKeys.has(key)) settle(key, null);
    });
  } catch (e) {
    chunk.forEach(({ key }) => settle(key, null));
  }
}

async function flushQueue(size) {
  const names = queue;
  queue = [];
  flushTimer = null;
  for (let i = 0; i < names.length; i += CHUNK_SIZE) {
    await resolveChunk(names.slice(i, i + CHUNK_SIZE), size);
  }
}

// Resolves to an image URL for the named card, or null if Scryfall has no
// match. Batches concurrent calls into as few bulk requests as possible.
export function getCardImageUrl(name, size = 'small') {
  const key = name.toLowerCase();
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  return new Promise((resolve) => {
    if (!pendingResolvers.has(key)) {
      pendingResolvers.set(key, []);
      queue.push({ name, key });
    }
    pendingResolvers.get(key).push(resolve);
    if (!flushTimer) flushTimer = setTimeout(() => flushQueue(size), FLUSH_DELAY_MS);
  });
}
