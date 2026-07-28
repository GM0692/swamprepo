import React, { useEffect, useRef, useState } from 'react';
import { Users, LogOut, Play, ArrowUp, ArrowDown } from 'lucide-react';
import {
  bootstrapSession, createSession, joinSession, startSession,
  leaveSession, subscribeToSession, saveLocalSeat, clearLocalSeat,
} from '../lib/firebaseSync.js';
import { SyncedLifePanel } from './SyncedLifePanel.jsx';
import { TurnTimerPanel } from './TurnTimerPanel.jsx';

export function GroupSession({ onGoToSettings }) {
  const [config, setConfig] = useState(undefined); // undefined = loading, null = not configured
  const [seat, setSeat] = useState(undefined); // undefined = loading, null = no seat yet
  const [bootError, setBootError] = useState('');
  const [bootAttempt, setBootAttempt] = useState(0);
  const [sessionState, setSessionState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hostName, setHostName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [draftOrder, setDraftOrder] = useState(null); // host's local reorder before starting
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setConfig(undefined);
    setSeat(undefined);
    setBootError('');
    (async () => {
      try {
        const { configured, seat: savedSeat } = await bootstrapSession();
        if (cancelled) return;
        setConfig(configured ? true : null);
        setSeat(savedSeat || null);
      } catch (e) {
        if (cancelled) return;
        setConfig(true); // we do have a config — the failure was signing in, not "unconfigured"
        setSeat(null);
        setBootError(e.message || "Couldn't connect to Firebase.");
      }
    })();
    return () => { cancelled = true; };
  }, [bootAttempt]);

  useEffect(() => {
    if (!seat) return undefined;
    unsubscribeRef.current = subscribeToSession(seat.roomCode, (data) => {
      if (!data || !data.players || !data.players[seat.playerId]) {
        clearLocalSeat();
        setSeat(null);
        setSessionState(null);
        return;
      }
      setSessionState(data);
    });
    return () => { unsubscribeRef.current?.(); unsubscribeRef.current = null; };
  }, [seat?.roomCode, seat?.playerId]);

  useEffect(() => {
    if (sessionState?.status === 'lobby' && !draftOrder) {
      const order = Object.entries(sessionState.players || {})
        .sort((a, b) => (a[1].seatOrder ?? 0) - (b[1].seatOrder ?? 0))
        .map(([uid]) => uid);
      setDraftOrder(order);
    }
    if (sessionState?.status !== 'lobby' && draftOrder) setDraftOrder(null);
  }, [sessionState, draftOrder]);

  async function handleHost() {
    if (!hostName.trim()) return;
    setBusy(true); setError('');
    try {
      const { roomCode, playerId } = await createSession(hostName.trim());
      const newSeat = { roomCode, playerId, playerName: hostName.trim(), isHost: true };
      await saveLocalSeat(newSeat);
      setSeat(newSeat);
    } catch (e) {
      setError(e.message || 'Could not create a session.');
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!joinCode.trim() || !joinName.trim()) return;
    setBusy(true); setError('');
    try {
      const { roomCode, playerId } = await joinSession(joinCode.trim(), joinName.trim());
      const newSeat = { roomCode, playerId, playerName: joinName.trim(), isHost: false };
      await saveLocalSeat(newSeat);
      setSeat(newSeat);
    } catch (e) {
      setError(e.message || 'Could not join that session.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    if (!seat) return;
    await leaveSession(seat.roomCode, seat.playerId);
    await clearLocalSeat();
    setSeat(null);
    setSessionState(null);
  }

  function moveDraft(index, dir) {
    setDraftOrder((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleStart() {
    if (!draftOrder || draftOrder.length === 0) return;
    setBusy(true);
    try {
      await startSession(seat.roomCode, draftOrder);
    } finally {
      setBusy(false);
    }
  }

  if (config === undefined || seat === undefined) {
    return <div className="ct-panel"><div className="ct-hint">Loading…</div></div>;
  }

  if (config === null) {
    return (
      <div className="ct-panel">
        <div className="ct-zone-title"><Users size={13} /> Group session</div>
        <div className="ct-hint" style={{ marginBottom: 12 }}>
          Sync life totals, turn order, and a turn timer live across your group's phones. This needs a free Firebase
          project set up once — add its config in Settings to turn this on.
        </div>
        <button className="ct-btn primary sm" onClick={onGoToSettings}>Go to Settings</button>
      </div>
    );
  }

  if (!seat) {
    return (
      <div className="ct-panel">
        {bootError && (
          <div className="ct-hint" style={{ color: 'var(--danger)', marginBottom: 16, lineHeight: 1.6 }}>
            {bootError}
            <div style={{ marginTop: 8 }}>
              <button className="ct-btn sm" onClick={() => setBootAttempt((n) => n + 1)}>Retry connecting</button>
            </div>
          </div>
        )}
        <div className="ct-zone-title"><Users size={13} /> Host a session</div>
        <input className="ct-input" placeholder="Your name" value={hostName} onChange={(e) => setHostName(e.target.value)} style={{ marginBottom: 8 }} />
        <button className="ct-btn primary sm" onClick={handleHost} disabled={busy || !hostName.trim()}>Host a session</button>

        <div className="ct-zone-title" style={{ marginTop: 24 }}>Join a session</div>
        <input className="ct-input" placeholder="Room code" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} style={{ marginBottom: 8 }} maxLength={4} />
        <input className="ct-input" placeholder="Your name" value={joinName} onChange={(e) => setJoinName(e.target.value)} style={{ marginBottom: 8 }} />
        <button className="ct-btn sm" onClick={handleJoin} disabled={busy || !joinCode.trim() || !joinName.trim()}>Join a session</button>

        {error && <div className="ct-hint" style={{ color: 'var(--danger)', marginTop: 10 }}>{error}</div>}
      </div>
    );
  }

  if (!sessionState) {
    return <div className="ct-panel"><div className="ct-hint">Connecting…</div></div>;
  }

  const players = sessionState.players || {};

  return (
    <div className="ct-panel">
      <div className="ct-row-between">
        <div className="ct-zone-title" style={{ margin: 0 }}><Users size={13} /> Session <span className="ct-roomcode">{seat.roomCode}</span></div>
        <button className="ct-btn ghost sm" onClick={handleLeave}><LogOut size={13} /> Leave</button>
      </div>

      {sessionState.status === 'lobby' ? (
        <div style={{ marginTop: 14 }}>
          <div className="ct-hint" style={{ marginBottom: 10 }}>
            Share code <strong style={{ color: 'var(--accent-gold)' }}>{seat.roomCode}</strong> with your group.{' '}
            {seat.isHost ? 'Reorder below, then start when everyone has joined.' : 'Waiting for the host to start the game.'}
          </div>
          {(draftOrder || []).map((uid, i) => (
            <div className="ct-card-row" key={uid}>
              <span className="name">{i + 1}. {players[uid]?.name}{uid === seat.playerId ? ' (you)' : ''}</span>
              {seat.isHost && (
                <div className="ct-card-actions">
                  <button className="ct-btn ghost sm" onClick={() => moveDraft(i, -1)} disabled={i === 0}><ArrowUp size={13} /></button>
                  <button className="ct-btn ghost sm" onClick={() => moveDraft(i, 1)} disabled={i === draftOrder.length - 1}><ArrowDown size={13} /></button>
                </div>
              )}
            </div>
          ))}
          {seat.isHost && (
            <button className="ct-btn primary sm" style={{ marginTop: 10 }} onClick={handleStart} disabled={busy || (draftOrder || []).length === 0}>
              <Play size={13} /> Start session
            </button>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          <SyncedLifePanel roomCode={seat.roomCode} sessionState={sessionState} myPlayerId={seat.playerId} />
          <div style={{ marginTop: 16 }}>
            <TurnTimerPanel roomCode={seat.roomCode} sessionState={sessionState} myPlayerId={seat.playerId} />
          </div>
        </div>
      )}
    </div>
  );
}
