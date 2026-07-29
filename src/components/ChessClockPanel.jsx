import React, { useEffect, useState } from 'react';
import { Play, ChevronRight, Clock } from 'lucide-react';
import { startTimer, endTurnAndAdvanceChessClock, initMyClock } from '../lib/firebaseSync.js';
import { sGet, sSet } from '../lib/storage.js';

function formatRemaining(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// No manual pause, unlike the stopwatch's TurnTimerPanel — a real chess
// clock only ever runs while it's your turn (auto-started by
// endTurnAndAdvanceChessClock on handoff) or sits stopped otherwise;
// allowing a mid-turn pause would need accounting this component doesn't
// do (clockRemainingMs is only ever decremented at a turn transition).
export function ChessClockPanel({ roomCode, sessionState, myPlayerId }) {
  const [, forceTick] = useState(0);
  const [confirmEnabled, setConfirmEnabled] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = sessionState?.timer || { running: false, startedAt: null };
  const activeId = sessionState?.activePlayerId;
  const activeName = sessionState?.players?.[activeId]?.name || 'Someone';
  const isMyTurn = activeId === myPlayerId;
  const me = sessionState?.players?.[myPlayerId];
  const budgetMs = sessionState?.clockBudgetMs || 0;

  useEffect(() => {
    sGet('settings:confirmTurnEnd', false).then((v) => setConfirmEnabled(!!v));
  }, []);

  useEffect(() => {
    if (me && me.clockRemainingMs == null && budgetMs > 0) {
      initMyClock(roomCode, myPlayerId, budgetMs);
    }
  }, [me, budgetMs, roomCode, myPlayerId]);

  useEffect(() => {
    if (!timer.running) return;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [timer.running, timer.startedAt]);

  const myRemaining = me?.clockRemainingMs ?? budgetMs;
  const displayRemaining = isMyTurn && timer.running && timer.startedAt
    ? myRemaining - (Date.now() - timer.startedAt)
    : myRemaining;
  const expired = displayRemaining <= 0;

  function toggleConfirm(e) {
    const next = e.target.checked;
    setConfirmEnabled(next);
    sSet('settings:confirmTurnEnd', next);
  }

  async function doEndTurn() {
    if (busy) return;
    setBusy(true);
    try {
      await endTurnAndAdvanceChessClock(roomCode, sessionState);
    } finally {
      setBusy(false);
    }
  }

  function handleEndTurnClick() {
    if (confirmEnabled) setShowConfirm(true);
    else doEndTurn();
  }

  function confirmEndTurn() {
    setShowConfirm(false);
    doEndTurn();
  }

  return (
    <div className="ct-timer-box">
      <div className="ct-zone-title" style={{ marginBottom: 6 }}>
        <Clock size={13} /> Turn {sessionState?.turnNumber || 1} — {isMyTurn ? 'Your turn' : `${activeName}'s turn`}
      </div>
      <div className={`ct-display ${expired ? 'ct-clock-expired' : ''}`} style={{ fontSize: 32, fontWeight: 800 }}>
        {formatRemaining(displayRemaining)}
      </div>
      {isMyTurn ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {!timer.running && (
            <button className="ct-btn primary sm" onClick={() => startTimer(roomCode)}><Play size={13} /> Start clock</button>
          )}
          <button className="ct-btn ghost sm" onClick={handleEndTurnClick} disabled={busy}>End turn &amp; pass <ChevronRight size={13} /></button>
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
            <div className="ct-hint" style={{ marginBottom: 20 }}>Are you sure your turn is over? Your remaining time stops counting down once you pass.</div>
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
