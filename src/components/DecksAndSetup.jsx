import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Swords, Loader2, Users } from 'lucide-react';
import { DeckImporter } from './DeckImporter.jsx';
import { sGet, sSet, sDelete } from '../lib/storage.js';
import { bootstrapSession, subscribeToSession } from '../lib/firebaseSync.js';

export function DecksTab({ deckIndex, setDeckIndex, onDeckSaved }) {
  const [importing, setImporting] = useState(false);

  async function handleDelete(id) {
    await sDelete(`deck:${id}`);
    const next = deckIndex.filter((d) => d.id !== id);
    setDeckIndex(next);
    await sSet('deck-index', next);
  }

  return (
    <div>
      {!importing && (
        <div style={{ marginBottom: 16 }}>
          <button className="ct-btn primary" onClick={() => setImporting(true)}><Plus size={15} /> Import new deck</button>
        </div>
      )}
      {importing && <DeckImporter onCancel={() => setImporting(false)} onSaved={(deck) => { setImporting(false); onDeckSaved(deck); }} />}
      {!importing && (
        deckIndex.length === 0 ? (
          <div className="ct-empty">No decks yet — import one to get started.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {deckIndex.map((d) => (
              <div className="ct-deck-card" key={d.id}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{d.name}</div>
                  <div className="ct-hint">{d.cardCount} cards</div>
                </div>
                <button className="ct-btn ghost sm" onClick={() => handleDelete(d.id)}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

export function GameSetup({ deckIndex, onStart }) {
  const [deckId, setDeckId] = useState(deckIndex[0]?.id || '');
  const [opponentCount, setOpponentCount] = useState(3);
  const [busy, setBusy] = useState(false);
  const [seat, setSeat] = useState(null);
  const [sessionState, setSessionState] = useState(null);

  useEffect(() => {
    let unsubscribe;
    (async () => {
      try {
        const { seat: savedSeat } = await bootstrapSession();
        if (!savedSeat) return;
        setSeat(savedSeat);
        unsubscribe = subscribeToSession(savedSeat.roomCode, setSessionState);
      } catch (e) {
        /* no linked session available — fall back to the manual opponent-count picker below */
      }
    })();
    return () => unsubscribe?.();
  }, []);

  const sessionStarted = !!(seat && sessionState?.turnOrder?.length);
  const effectiveOpponentCount = sessionStarted ? Math.max(1, sessionState.turnOrder.length - 1) : opponentCount;

  async function handleStart() {
    if (!deckId) return;
    setBusy(true);
    const deck = await sGet(`deck:${deckId}`);
    setBusy(false);
    if (!deck) return;
    onStart(deck, effectiveOpponentCount, seat);
  }

  if (deckIndex.length === 0) return <div className="ct-empty">Import a deck first, then come back here to start a game.</div>;

  return (
    <div className="ct-panel">
      <div className="ct-display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Start a game</div>
      <label className="ct-hint" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Deck</label>
      <select className="ct-select" style={{ marginTop: 6, marginBottom: 16 }} value={deckId} onChange={(e) => setDeckId(e.target.value)}>
        {deckIndex.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>

      {sessionStarted ? (
        <div className="ct-hint" style={{ marginBottom: 20 }}>
          <Users size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Linked to group session <strong style={{ color: 'var(--accent-gold)' }}>{seat.roomCode}</strong> as {seat.playerName} —
          life totals and turn order sync from there ({effectiveOpponentCount} opponent{effectiveOpponentCount === 1 ? '' : 's'}).
        </div>
      ) : (
        <>
          {seat && (
            <div className="ct-hint" style={{ marginBottom: 10 }}>
              <Users size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              In group session <strong style={{ color: 'var(--accent-gold)' }}>{seat.roomCode}</strong> — waiting for the host to start it. Pick opponents manually for now.
            </div>
          )}
          <label className="ct-hint" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Opponents</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, marginBottom: 20 }}>
            {[1, 2, 3, 4].map((n) => (
              <button key={n} className={`ct-btn sm ${opponentCount === n ? 'primary' : ''}`} onClick={() => setOpponentCount(n)}>{n}</button>
            ))}
          </div>
        </>
      )}

      <button className="ct-btn primary" onClick={handleStart} disabled={busy}>
        {busy ? <Loader2 size={14} className="ct-spin" /> : <Swords size={15} />} Load deck
      </button>
    </div>
  );
}
