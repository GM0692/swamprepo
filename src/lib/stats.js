// Pure aggregation helpers over gameIndex ({ id, deckId, deckName, date,
// result, turnsPlayed }) — cheap enough to run on every render without
// fetching full game:{id} records, which are only needed for JSON export.
import { sGet } from './storage.js';

export function overallStats(gameIndex) {
  const gamesPlayed = gameIndex.length;
  const wins = gameIndex.filter((g) => g.result === 'win').length;
  const losses = gameIndex.filter((g) => g.result === 'loss').length;
  const draws = gameIndex.filter((g) => g.result === 'draw').length;
  const winRate = gamesPlayed ? wins / gamesPlayed : 0;
  const avgTurns = gamesPlayed ? gameIndex.reduce((s, g) => s + (g.turnsPlayed || 0), 0) / gamesPlayed : 0;
  return { gamesPlayed, wins, losses, draws, winRate, avgTurns };
}

export function perDeckStats(gameIndex) {
  const byDeck = new Map();
  gameIndex.forEach((g) => {
    if (!byDeck.has(g.deckId)) byDeck.set(g.deckId, { deckId: g.deckId, deckName: g.deckName, games: [] });
    byDeck.get(g.deckId).games.push(g);
  });
  return Array.from(byDeck.values())
    .map(({ deckId, deckName, games }) => {
      const gamesPlayed = games.length;
      const wins = games.filter((g) => g.result === 'win').length;
      const winRate = gamesPlayed ? wins / gamesPlayed : 0;
      const avgTurns = gamesPlayed ? games.reduce((s, g) => s + (g.turnsPlayed || 0), 0) / gamesPlayed : 0;
      return { deckId, deckName, gamesPlayed, wins, winRate, avgTurns };
    })
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed);
}

// Chronological (oldest-first) slice of the most recent `windowSize` games,
// for the UI to render as a simple win/loss/draw bar strip.
export function recentTrend(gameIndex, windowSize = 10) {
  return gameIndex
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-windowSize);
}

function csvField(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toSummaryCSV(gameIndex) {
  const header = ['id', 'date', 'deck', 'result', 'turnsPlayed'];
  const rows = gameIndex.map((g) => [g.id, g.date, g.deckName, g.result, g.turnsPlayed].map(csvField).join(','));
  return [header.join(','), ...rows].join('\n');
}

export async function fetchAllFullGames(gameIndex) {
  const games = await Promise.all(gameIndex.map((g) => sGet(`game:${g.id}`)));
  return games.filter(Boolean);
}

export function toFullJSON(fullGames) {
  return JSON.stringify(fullGames, null, 2);
}

export function downloadTextFile(filename, mimeType, content) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
