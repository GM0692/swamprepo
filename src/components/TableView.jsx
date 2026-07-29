import React from 'react';
import { X } from 'lucide-react';

// Read-only big-screen display for a shared/central device — purely reads
// the sessionState already streamed by subscribeToSession, no new
// subscription or schema.
export function TableView({ sessionState, myPlayerId, onExit }) {
  const players = sessionState?.players || {};
  const order = sessionState?.turnOrder?.length
    ? sessionState.turnOrder
    : Object.keys(players).sort((a, b) => (players[a]?.seatOrder ?? 0) - (players[b]?.seatOrder ?? 0));
  const activeId = sessionState?.activePlayerId;

  return (
    <div className="ct-table-view">
      <button className="ct-btn ghost sm ct-table-exit" onClick={onExit}><X size={16} /> Exit table view</button>
      <div className="ct-table-grid">
        {order.filter((uid) => players[uid]).map((uid) => {
          const p = players[uid];
          const poison = p.counters?.poison || 0;
          return (
            <div key={uid} className={`ct-table-tile ${uid === activeId ? 'active' : ''}`}>
              <div className="ct-table-name">
                <span className={`ct-online-dot ${p.online ? 'on' : 'off'}`} />
                {p.name}{uid === myPlayerId ? ' (you)' : ''}
              </div>
              <div className="ct-table-life">{p.life}</div>
              {poison > 0 && <div className={`ct-poison-badge ${poison >= 10 ? 'warn' : ''}`} style={{ margin: '0 auto' }}>☠ {poison}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
