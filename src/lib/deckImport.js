function cleanCardName(raw) {
  let s = raw.trim();
  s = s.replace(/\s*\([A-Za-z0-9]{2,6}\)\s*[\w-]*\s*$/, '');
  s = s.replace(/\s*\[.*?\]\s*$/, '');
  s = s.replace(/\s*\*F\*\s*$/i, '');
  return s.trim();
}

export function parseDecklistText(text) {
  const lines = text.split('\n').map((l) => l.trim());
  const main = new Map();
  const commanders = [];
  let section = 'main';

  for (let line of lines) {
    if (!line) continue;
    const headerMatch = line.match(/^(commander|command zone|companion|deck|mainboard|maybeboard|sideboard)s?:?\s*$/i);
    if (headerMatch) {
      const h = headerMatch[1].toLowerCase();
      if (h === 'commander' || h === 'command zone') section = 'commander';
      else if (h === 'sideboard' || h === 'maybeboard' || h === 'companion') section = 'skip';
      else section = 'main';
      continue;
    }
    const m = line.match(/^(\d+)\s*x?\s+(.+)$/i);
    let qty = 1;
    let namePart = line;
    if (m) {
      qty = parseInt(m[1], 10) || 1;
      namePart = m[2];
    }
    const name = cleanCardName(namePart);
    if (!name) continue;

    if (section === 'commander') commanders.push(name);
    else if (section === 'main') main.set(name, (main.get(name) || 0) + qty);
  }

  return {
    commanders,
    cards: Array.from(main.entries()).map(([name, qty]) => ({ name, qty })),
  };
}

export async function tryFetchDeckFromUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    throw new Error("That doesn't look like a valid URL.");
  }
  const host = parsed.hostname.replace('www.', '');

  if (host.includes('moxfield.com')) {
    const parts = parsed.pathname.split('/').filter(Boolean);
    const id = parts[parts.length - 1];
    if (!id) throw new Error('Could not find a deck ID in that Moxfield URL.');
    const res = await fetch(`https://api.moxfield.com/v2/decks/all/${id}`);
    if (!res.ok) throw new Error('Moxfield blocked the direct request (CORS). This may work better once this app is deployed to its own domain — otherwise paste the exported list instead.');
    const data = await res.json();
    const cards = [];
    const commanders = [];
    const mb = data.mainboard || data.boards?.mainboard?.cards || {};
    Object.values(mb).forEach((entry) => {
      const name = entry?.card?.name;
      const qty = entry?.quantity || 1;
      if (name) cards.push({ name, qty });
    });
    const cmd = data.commanders || data.boards?.commanders?.cards || {};
    Object.values(cmd).forEach((entry) => {
      const name = entry?.card?.name;
      if (name) commanders.push(name);
    });
    if (cards.length === 0) throw new Error('Fetched the page but found no recognizable cards.');
    return { commanders, cards, name: data.name || 'Imported Moxfield Deck' };
  }

  if (host.includes('archidekt.com')) {
    const match = parsed.pathname.match(/(\d+)/);
    const id = match ? match[1] : null;
    if (!id) throw new Error('Could not find a deck ID in that Archidekt URL.');
    const res = await fetch(`https://archidekt.com/api/decks/${id}/`);
    if (!res.ok) throw new Error('Archidekt blocked the direct request (CORS). Paste the exported list instead.');
    const data = await res.json();
    const cards = [];
    const commanders = [];
    (data.cards || []).forEach((c) => {
      const name = c?.card?.oracleCard?.name || c?.card?.name;
      const qty = c?.quantity || 1;
      const cats = c?.categories || [];
      if (!name) return;
      if (cats.includes('Commander')) commanders.push(name);
      else cards.push({ name, qty });
    });
    if (cards.length === 0 && commanders.length === 0) throw new Error('Fetched the page but found no recognizable cards.');
    return { commanders, cards, name: data.name || 'Imported Archidekt Deck' };
  }

  throw new Error("Direct import only knows Moxfield and Archidekt URLs right now — try pasting the list instead.");
}
