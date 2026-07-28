import React, { useEffect, useState } from 'react';
import { Play, Square, ChevronRight, Clock } from 'lucide-react';
import { startTimer, stopTimer, endTurnAndAdvance } from '../lib/firebaseSync.js';

function formatElapsed(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function TurnTimerPanel({ roomCode, sessionState, myPlayerId }) {
  const [, forceTick] = useState(0);
  const timer = sessionState?.timer || { running: false, startedAt: null, accumulatedMs: 0 };
  const activeId = sessionState?.activePlayerId;
  const activeName = sessionState?.players?.[activeId]?.name || 'Someone';
  const isMyTurn = activeId === myPlayerId;

  useEffect(() => {
    if (!timer.running) return;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [timer.running, timer.startedAt]);

  const elapsedMs = (timer.accumulatedMs || 0) + (timer.running && timer.startedAt ? Date.now() - timer.startedAt : 0);

  return (
    <div className="ct-timer-box">
      <div className="ct-zone-title" style={{ marginBottom: 6 }}>
        <Clock size={13} /> Turn {sessionState?.turnNumber || 1} — {isMyTurn ? 'Your turn' : `${activeName}'s turn`}
      </div>
      <div className="ct-display" style={{ fontSize: 32, fontWeight: 800 }}>{formatElapsed(elapsedMs)}</div>
      {isMyTurn ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {!timer.running ? (
            <button className="ct-btn primary sm" onClick={() => startTimer(roomCode)}><Play size={13} /> Start timer</button>
          ) : (
            <button className="ct-btn sm" onClick={() => stopTimer(roomCode, timer)}><Square size={13} /> Stop timer</button>
          )}
          <button className="ct-btn ghost sm" onClick={() => endTurnAndAdvance(roomCode, sessionState)}>End turn &amp; pass <ChevronRight size={13} /></button>
        </div>
      ) : (
        <div className="ct-hint" style={{ marginTop: 8 }}>Waiting for {activeName} to pass the turn.</div>
      )}
    </div>
  );
}
