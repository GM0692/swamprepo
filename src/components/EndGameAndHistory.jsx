import React, { useState } from 'react';
import { ChevronRight, ChevronDown, ScrollText, Target } from 'lucide-react';
import { sGet } from '../lib/storage.js';
import { CommanderDamageRow, PlayerCounters } from './Trackers.jsx';
import { StatsTab } from './StatsPanel.jsx';

export function EndGameModal({ onConfirm, onCancel }) {
  const [result, setResult] = useState('win');
  return (
    <div className="ct-modal-overlay">
      <div className="ct-modal">
        <div className="ct-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>How did it go?</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {['win', 'loss', 'draw'].map((r) => (
            <button key={r} className={`ct-btn ${result === r ? 'primary' : ''}`} onClick={() => setResult(r)} style={{ textTransform: 'capitalize' }}>{r}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="ct-btn primary" onClick={() => onConfirm(result)}>Save game</button>
          <button className="ct-btn" onClick={onCancel}>Keep playing</button>
        </div>
      </div>
    </div>
  );
}

export function HistoryTab({ gameIndex }) {
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState({});
  const [view, setView] = useState('games');

  async function toggle(id) {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (!detail[id]) {
      const g = await sGet(`game:${id}`);
      setDetail((d) => ({ ...d, [id]: g }));
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--bg-panel)', padding: 4, borderRadius: 10, border: '1px solid var(--border-hair)', width: 'fit-content' }}>
        <button className={`ct-btn sm ${view === 'games' ? 'primary' : ''}`} onClick={() => setView('games')}>Games</button>
        <button className={`ct-btn sm ${view === 'stats' ? 'primary' : ''}`} onClick={() => setView('stats')}>Stats</button>
      </div>

      {view === 'stats' ? (
        <StatsTab gameIndex={gameIndex} />
      ) : gameIndex.length === 0 ? (
        <div className="ct-empty">No games recorded yet — finish a game from the Play tab to see it here.</div>
      ) : (
      gameIndex.slice().reverse().map((g) => (
        <div key={g.id}>
          <div className="ct-history-row" onClick={() => toggle(g.id)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {openId === g.id ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{g.deckName}</div>
                <div className="ct-hint">{new Date(g.date).toLocaleDateString()} · {g.turnsPlayed} turns</div>
              </div>
            </div>
            <span className={`ct-result-badge ct-result-${g.result}`}>{g.result}</span>
          </div>
          {openId === g.id && detail[g.id] && (
            <div className="ct-panel" style={{ marginTop: -4, marginBottom: 10 }}>
              {detail[g.id].analysis ? (
                <div className="ct-suggestion-box" style={{ marginBottom: 16 }}>{detail[g.id].analysis}</div>
              ) : (
                <div className="ct-hint" style={{ marginBottom: 16 }}>Analysis still processing or unavailable for this game.</div>
              )}
              {detail[g.id].finalTrackers && (
                <div style={{ marginBottom: 16 }}>
                  <div className="ct-zone-title"><Target size={13} /> Final trackers</div>
                  {Object.entries(detail[g.id].finalTrackers.commanderDamage || {})
                    .filter(([, slots]) => slots.some((s) => s.value > 0))
                    .map(([oppKey, slots], i) => (
                      <CommanderDamageRow key={oppKey} opponentLabel={`Opponent ${i + 1}`} slots={slots} readOnly onChangeSlot={() => {}} />
                    ))}
                  {Object.entries(detail[g.id].finalTrackers.counters || {})
                    .filter(([, c]) => c.poison || c.energy || (c.custom && c.custom.length))
                    .map(([playerKey, counters]) => (
                      <div key={playerKey} style={{ marginTop: 6 }}>
                        <div className="ct-tracker-section-label">{playerKey === 'you' ? 'You' : `Opponent ${playerKey.replace('opp', '')}`}</div>
                        <PlayerCounters counters={counters} readOnly onChangePoison={() => {}} onChangeEnergy={() => {}} />
                      </div>
                    ))}
                </div>
              )}
              <div className="ct-zone-title"><ScrollText size={13} /> Full log</div>
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {detail[g.id].log.map((l) => (
                  <div key={l.id} className="ct-ledger-entry" style={{ padding: '3px 0' }}>T{l.turn} · {l.phase}: {l.text}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )))}
    </div>
  );
}
