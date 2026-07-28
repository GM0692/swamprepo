import React from 'react';
import { Minus, Plus, Shield } from 'lucide-react';
import { updateMyLife } from '../lib/firebaseSync.js';

export function SyncedLifePanel({ roomCode, sessionState, myPlayerId }) {
  const players = sessionState?.players || {};
  const order = sessionState?.turnOrder?.length
    ? sessionState.turnOrder
    : Object.keys(players).sort((a, b) => (players[a]?.seatOrder ?? 0) - (players[b]?.seatOrder ?? 0));
  const me = players[myPlayerId];

  async function adjust(delta) {
    if (!me) return;
    await updateMyLife(roomCode, myPlayerId, delta, me.life ?? 0);
  }

  return (
    <div>
      <div className="ct-zone-title"><Shield size={13} /> Life totals</div>
      {order.filter((uid) => players[uid]).map((uid) => {
        const p = players[uid];
        const isMe = uid === myPlayerId;
        return (
          <div className="ct-life-row" key={uid}>
            <div className="ct-life-name">
              <span className={`ct-online-dot ${p.online ? 'on' : 'off'}`} title={p.online ? 'Online' : 'Offline'} />
              {p.name}{isMe ? ' (you)' : ''}
            </div>
            {isMe ? (
              <>
                <button className="ct-btn ghost sm" onClick={() => adjust(-1)}><Minus size={13} /></button>
                <div className="ct-life-num">{p.life}</div>
                <button className="ct-btn ghost sm" onClick={() => adjust(1)}><Plus size={13} /></button>
              </>
            ) : (
              <div className="ct-life-num">{p.life}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
