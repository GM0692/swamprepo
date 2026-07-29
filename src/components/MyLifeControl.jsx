import React from 'react';
import { Heart } from 'lucide-react';
import { updateMyLife } from '../lib/firebaseSync.js';

export function MyLifeControl({ roomCode, sessionState, myPlayerId }) {
  const me = sessionState?.players?.[myPlayerId];
  if (!me) return null;

  async function adjust(delta) {
    await updateMyLife(roomCode, myPlayerId, delta, me.life ?? 0);
  }

  return (
    <div>
      <div className="ct-zone-title"><Heart size={13} /> Your life</div>
      <div className="ct-my-life">
        <button className="ct-my-life-zone" onClick={() => adjust(-1)} aria-label="Lose 1 life">−</button>
        <div className="ct-my-life-num">{me.life}</div>
        <button className="ct-my-life-zone" onClick={() => adjust(1)} aria-label="Gain 1 life">+</button>
      </div>
    </div>
  );
}
