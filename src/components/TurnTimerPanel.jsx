import React, { useEffect, useState } from 'react';
import { Play, Square, ChevronRight, Clock } from 'lucide-react';
import { startTimer, stopTimer, endTurnAndAdvance } from '../lib/firebaseSync.js';
import { sGet, sSet } from '../lib/storage.js';

function formatElapsed(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function TurnTimerPanel({ roomCode, sessionState, myPlayerId }) {
  const [, forceTick] = useState(0);
  const [confirmEnabled, setConfirmEnabled] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const timer = sessionState?.timer || { running: false, startedAt: null, accumulatedMs: 0 };
  const activeId = sessionState?.activePlayerId;
  const activeName = sessionState?.players?.[activeId]?.name || 'Someone';
  const isMyTurn = activeId === myPlayerId;

  useEffect(() => {
    sGet('settings:confirmTurnEnd', false).then((v) => setConfirmEnabled(!!v));
  }, []);

  useEffect(() => {
    if (!timer.running) return;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [timer.running, timer.startedAt]);

  const elapsedMs = (timer.accumulatedMs || 0) + (timer.running && timer.startedAt ? Date.now() - timer.startedAt : 0);

  function toggleConfirm(e) {
    const next = e.target.checked;
    setConfirmEnabled(next);
    sSet('settings:confirmTurnEnd', next);
  }

  function handleEndTurnClick() {
    if (confirmEnabled) setShowConfirm(true);
    else endTurnAndAdvance(roomCode, sessionState);
  }

  function confirmEndTurn() {
    setShowConfirm(false);
    endTurnAndAdvance(roomCode, sessionState);
  }

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
          <button className="ct-btn ghost sm" onClick={handleEndTurnClick}>End turn &amp; pass <ChevronRight size={13} /></button>
        </div>
      ) : (
        <div className="ct-hint" style={{ marginTop: 8 }}>Waiting for {activeName} to pass the turn.</div>
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>
        <input type="checkbox" checked={confirmEnabled} onChange={toggleConfirm} style={{ accentColor: 'var(--accent-gold)' }} />
        Confirm turn end
      </label>

      {showConfirm && (
        <div className="ct-modal-overlay">
          <div className="ct-modal" style={{ maxWidth: 360 }}>
            <div className="ct-display" style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>End your turn?</div>
            <div className="ct-hint" style={{ marginBottom: 20 }}>Are you sure your turn is over? The timer starts automatically for the next player.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="ct-btn ghost sm" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="ct-btn primary sm" onClick={confirmEndTurn}>End turn</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
