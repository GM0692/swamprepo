import React, { useState } from 'react';
import { ChevronRight, ChevronDown, ScrollText } from 'lucide-react';
import { sGet } from '../lib/storage.js';

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

  async function toggle(id) {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (!detail[id]) {
      const g = await sGet(`game:${id}`);
      setDetail((d) => ({ ...d, [id]: g }));
    }
  }

  if (gameIndex.length === 0) return <div className="ct-empty">No games recorded yet — finish a game from the Play tab to see it here.</div>;

  return (
    <div>
      {gameIndex.slice().reverse().map((g) => (
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
              <div className="ct-zone-title"><ScrollText size={13} /> Full log</div>
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {detail[g.id].log.map((l) => (
                  <div key={l.id} className="ct-ledger-entry" style={{ padding: '3px 0' }}>T{l.turn} · {l.phase}: {l.text}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
