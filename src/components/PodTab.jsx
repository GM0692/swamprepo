import React, { useEffect, useRef, useState } from 'react';
import { Trophy, LogOut } from 'lucide-react';
import { bootstrapSession } from '../lib/firebaseSync.js';
import { createPod, joinPod, subscribeToPod, loadLocalPod, saveLocalPod, clearLocalPod } from '../lib/podSync.js';

export function PodTab({ onGoToSettings }) {
  const [config, setConfig] = useState(undefined); // undefined = loading, null = not configured
  const [link, setLink] = useState(undefined); // undefined = loading, null = no pod linked
  const [podState, setPodState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [podName, setPodName] = useState('');
  const [hostName, setHostName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { configured } = await bootstrapSession();
      setConfig(configured ? true : null);
      const saved = await loadLocalPod();
      setLink(saved || null);
    })();
  }, []);

  useEffect(() => {
    if (!link) return undefined;
    unsubscribeRef.current = subscribeToPod(link.podId, setPodState);
    return () => { unsubscribeRef.current?.(); unsubscribeRef.current = null; };
  }, [link?.podId]);

  async function handleCreate() {
    if (!podName.trim() || !hostName.trim()) return;
    setBusy(true); setError('');
    try {
      const { podId, playerId } = await createPod(podName.trim(), hostName.trim());
      const newLink = { podId, playerId, playerName: hostName.trim() };
      await saveLocalPod(newLink);
      setLink(newLink);
    } catch (e) {
      setError(e.message || 'Could not create a pod.');
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!joinCode.trim() || !joinName.trim()) return;
    setBusy(true); setError('');
    try {
      const { podId, playerId } = await joinPod(joinCode.trim(), joinName.trim());
      const newLink = { podId, playerId, playerName: joinName.trim() };
      await saveLocalPod(newLink);
      setLink(newLink);
    } catch (e) {
      setError(e.message || 'Could not join that pod.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    await clearLocalPod();
    setLink(null);
    setPodState(null);
  }

  if (config === undefined || link === undefined) {
    return <div className="ct-panel"><div className="ct-hint">Loading…</div></div>;
  }

  if (config === null) {
    return (
      <div className="ct-panel">
        <div className="ct-zone-title"><Trophy size={13} /> Pod leaderboard</div>
        <div className="ct-hint" style={{ marginBottom: 12 }}>
          Track ELO and win rate across every game your group plays together over time — separate from
          one-off Group sessions, which don't persist. Needs the same free Firebase project as Group
          sessions — add its config in Settings to turn this on.
        </div>
        <button className="ct-btn primary sm" onClick={onGoToSettings}>Go to Settings</button>
      </div>
    );
  }

  if (!link) {
    return (
      <div className="ct-panel">
        <div className="ct-zone-title"><Trophy size={13} /> Create a pod</div>
        <input className="ct-input" placeholder="Pod name (e.g. Friday Night EDH)" value={podName} onChange={(e) => setPodName(e.target.value)} style={{ marginBottom: 8 }} />
        <input className="ct-input" placeholder="Your name" value={hostName} onChange={(e) => setHostName(e.target.value)} style={{ marginBottom: 8 }} />
        <button className="ct-btn primary sm" onClick={handleCreate} disabled={busy || !podName.trim() || !hostName.trim()}>Create pod</button>

        <div className="ct-zone-title" style={{ marginTop: 24 }}>Join a pod</div>
        <input className="ct-input" placeholder="Pod code" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} style={{ marginBottom: 8 }} maxLength={6} />
        <input className="ct-input" placeholder="Your name" value={joinName} onChange={(e) => setJoinName(e.target.value)} style={{ marginBottom: 8 }} />
        <button className="ct-btn sm" onClick={handleJoin} disabled={busy || !joinCode.trim() || !joinName.trim()}>Join pod</button>

        {error && <div className="ct-hint" style={{ color: 'var(--danger)', marginTop: 10 }}>{error}</div>}
      </div>
    );
  }

  if (!podState) {
    return <div className="ct-panel"><div className="ct-hint">Loading pod…</div></div>;
  }

  const members = Object.entries(podState.members || {})
    .map(([uid, m]) => ({ uid, ...m }))
    .sort((a, b) => (b.elo || 0) - (a.elo || 0));

  return (
    <div className="ct-panel">
      <div className="ct-row-between">
        <div className="ct-zone-title" style={{ margin: 0 }}><Trophy size={13} /> {podState.name} <span className="ct-roomcode">{link.podId}</span></div>
        <button className="ct-btn ghost sm" onClick={handleLeave}><LogOut size={13} /> Leave</button>
      </div>
      <div className="ct-hint" style={{ margin: '10px 0' }}>
        Share code <strong style={{ color: 'var(--accent-gold)' }}>{link.podId}</strong> so others can join. When
        hosting a Group session, link it to this pod (in the Group tab) to feed results into the leaderboard below.
      </div>
      {members.map((m, i) => (
        <div className="ct-life-row" key={m.uid}>
          <div className="ct-life-name">#{i + 1} {m.name}{m.uid === link.playerId ? ' (you)' : ''}</div>
          <div className="ct-hint" style={{ minWidth: 170, textAlign: 'right' }}>
            {m.elo ?? 1000} elo · {m.gamesPlayed || 0} games · {m.wins || 0}W {m.losses || 0}L {m.draws || 0}D
          </div>
        </div>
      ))}
    </div>
  );
}
