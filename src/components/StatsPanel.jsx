import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { overallStats, perDeckStats, recentTrend, toSummaryCSV, fetchAllFullGames, toFullJSON, downloadTextFile } from '../lib/stats.js';

function pct(x) {
  return `${Math.round(x * 100)}%`;
}

function TrendStrip({ games }) {
  if (games.length === 0) return null;
  return (
    <div className="ct-trend-strip">
      {games.map((g) => (
        <div key={g.id} className={`ct-trend-bar ct-trend-${g.result}`} title={`${g.deckName} — ${g.result}, ${g.turnsPlayed} turns`} />
      ))}
    </div>
  );
}

export function StatsTab({ gameIndex }) {
  const [exporting, setExporting] = useState(false);

  if (gameIndex.length === 0) {
    return <div className="ct-empty">No games recorded yet — finish a game from the Play tab to see stats here.</div>;
  }

  const overall = overallStats(gameIndex);
  const perDeck = perDeckStats(gameIndex);
  const trend = recentTrend(gameIndex, 20);

  async function exportJSON() {
    setExporting(true);
    try {
      const full = await fetchAllFullGames(gameIndex);
      downloadTextFile('swamptap-games.json', 'application/json', toFullJSON(full));
    } finally {
      setExporting(false);
    }
  }

  function exportCSV() {
    downloadTextFile('swamptap-games.csv', 'text/csv', toSummaryCSV(gameIndex));
  }

  return (
    <div>
      <div className="ct-stat-cards">
        <div className="ct-stat-card">
          <div className="ct-stat-value">{overall.gamesPlayed}</div>
          <div className="ct-stat-label">Games played</div>
        </div>
        <div className="ct-stat-card">
          <div className="ct-stat-value">{pct(overall.winRate)}</div>
          <div className="ct-stat-label">Win rate ({overall.wins}W {overall.losses}L {overall.draws}D)</div>
        </div>
        <div className="ct-stat-card">
          <div className="ct-stat-value">{overall.avgTurns.toFixed(1)}</div>
          <div className="ct-stat-label">Avg turns / game</div>
        </div>
      </div>

      <div className="ct-zone-title" style={{ marginTop: 20 }}>Last {trend.length} games</div>
      <TrendStrip games={trend} />

      <div className="ct-zone-title" style={{ marginTop: 20 }}>By deck</div>
      {perDeck.map((d) => (
        <div className="ct-life-row" key={d.deckId}>
          <div className="ct-life-name">{d.deckName}</div>
          <div className="ct-hint" style={{ minWidth: 170, textAlign: 'right' }}>
            {d.gamesPlayed} games · {pct(d.winRate)} win · {d.avgTurns.toFixed(1)} avg turns
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <button className="ct-btn sm" onClick={exportCSV}><Download size={13} /> Export CSV</button>
        <button className="ct-btn sm" onClick={exportJSON} disabled={exporting}>
          {exporting ? <Loader2 size={13} className="ct-spin" /> : <Download size={13} />} Export JSON
        </button>
      </div>
    </div>
  );
}
