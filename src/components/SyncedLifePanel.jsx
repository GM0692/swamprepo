import React from 'react';
import { Shield } from 'lucide-react';

export function SyncedLifePanel({ sessionState, myPlayerId }) {
  const players = sessionState?.players || {};
  const order = sessionState?.turnOrder?.length
    ? sessionState.turnOrder
    : Object.keys(players).sort((a, b) => (players[a]?.seatOrder ?? 0) - (players[b]?.seatOrder ?? 0));
  const others = order.filter((uid) => uid !== myPlayerId && players[uid]);

  if (others.length === 0) return null;

  return (
    <div>
      <div className="ct-zone-title"><Shield size={13} /> Opponents</div>
      {others.map((uid) => {
        const p = players[uid];
        const poison = p.counters?.poison || 0;
        return (
          <div className="ct-life-row" key={uid}>
            <div className="ct-life-name">
              <span className={`ct-online-dot ${p.online ? 'on' : 'off'}`} title={p.online ? 'Online' : 'Offline'} />
              {p.name}
              {poison > 0 && <span className={`ct-poison-badge ${poison >= 10 ? 'warn' : ''}`}>☠ {poison}</span>}
            </div>
            <div className="ct-life-num">{p.life}</div>
          </div>
        );
      })}
    </div>
  );
}
