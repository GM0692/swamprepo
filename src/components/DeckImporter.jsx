import React, { useState } from 'react';
import { ArrowRight, ClipboardPaste, Link as LinkIcon, Check, X, Loader2, Crown } from 'lucide-react';
import { parseDecklistText, tryFetchDeckFromUrl } from '../lib/deckImport.js';
import { sGet, sSet } from '../lib/storage.js';
import { uid } from '../lib/constants.js';

export function DeckImporter({ onSaved, onCancel }) {
  const [mode, setMode] = useState('paste');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [parsed, setParsed] = useState(null);
  const [deckName, setDeckName] = useState('');

  function handleParsePaste() {
    setError('');
    const result = parseDecklistText(text);
    if (result.cards.length === 0 && result.commanders.length === 0) {
      setError("Couldn't find any cards in that text — check the format and try again.");
      return;
    }
    setParsed(result);
    if (!deckName) setDeckName(result.commanders[0] || 'New Deck');
  }

  async function handleFetchUrl() {
    setError('');
    setBusy(true);
    try {
      const result = await tryFetchDeckFromUrl(url);
      setParsed(result);
      setDeckName(result.name || result.commanders[0] || 'New Deck');
    } catch (e) {
      setError(e.message + ' You can paste the exported list instead.');
      setMode('paste');
    } finally {
      setBusy(false);
    }
  }

  function toggleCommander(name) {
    setParsed((p) => {
      const isCmd = p.commanders.includes(name);
      if (isCmd) return { ...p, commanders: p.commanders.filter((c) => c !== name), cards: [...p.cards, { name, qty: 1 }] };
      return { ...p, commanders: [...p.commanders, name], cards: p.cards.filter((c) => c.name !== name) };
    });
  }

  async function handleSave() {
    if (!parsed) return;
    setBusy(true);
    const deck = {
      id: uid(),
      name: deckName || 'Untitled Deck',
      commander: parsed.commanders,
      mainboard: parsed.cards,
      importedAt: new Date().toISOString(),
    };
    await sSet(`deck:${deck.id}`, deck);
    const index = (await sGet('deck-index', [])) || [];
    index.push({ id: deck.id, name: deck.name, cardCount: parsed.cards.reduce((s, c) => s + c.qty, 0) + parsed.commanders.length });
    await sSet('deck-index', index);
    setBusy(false);
    onSaved(deck);
  }

  return (
    <div className="ct-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="ct-display" style={{ fontSize: 20, fontWeight: 700 }}>Import a deck</div>
        <button className="ct-btn ghost" onClick={onCancel}><X size={16} /></button>
      </div>

      {!parsed && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button className={`ct-btn sm ${mode === 'paste' ? 'primary' : ''}`} onClick={() => setMode('paste')}><ClipboardPaste size={14} /> Paste list</button>
            <button className={`ct-btn sm ${mode === 'url' ? 'primary' : ''}`} onClick={() => setMode('url')}><LinkIcon size={14} /> From URL</button>
          </div>

          {mode === 'paste' && (
            <>
              <textarea
                className="ct-textarea"
                placeholder={'Paste your exported list, e.g.\n\nCommander\n1 Atraxa, Praetors\' Voice\n\nDeck\n1 Sol Ring\n1 Arcane Signet\n10 Forest\n...'}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div style={{ marginTop: 12 }}>
                <button className="ct-btn primary" onClick={handleParsePaste} disabled={!text.trim()}>Parse list <ArrowRight size={14} /></button>
              </div>
            </>
          )}

          {mode === 'url' && (
            <>
              <input className="ct-input" placeholder="https://www.moxfield.com/decks/... or https://archidekt.com/decks/..." value={url} onChange={(e) => setUrl(e.target.value)} />
              <div style={{ marginTop: 12 }}>
                <button className="ct-btn primary" onClick={handleFetchUrl} disabled={!url.trim() || busy}>
                  {busy ? <Loader2 size={14} className="ct-spin" /> : <ArrowRight size={14} />} Fetch deck
                </button>
              </div>
              <div className="ct-hint" style={{ marginTop: 8 }}>Some sites still block direct browser requests depending on their CORS policy — if this fails, paste the exported list instead.</div>
            </>
          )}

          {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{error}</div>}
        </>
      )}

      {parsed && (
        <>
          <label className="ct-hint" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Deck name</label>
          <input className="ct-input" style={{ marginTop: 6, marginBottom: 16 }} value={deckName} onChange={(e) => setDeckName(e.target.value)} />

          <div className="ct-zone-title">Commander <span className="ct-zone-count">{parsed.commanders.length}</span></div>
          {parsed.commanders.length === 0 && <div className="ct-hint" style={{ marginBottom: 10 }}>No commander detected — click a card below to mark it as your commander.</div>}
          {parsed.commanders.map((name) => (
            <div key={name} className="ct-card-row" style={{ borderColor: 'var(--accent-gold-dim)' }}>
              <span className="name"><Crown size={13} style={{ marginRight: 6, color: 'var(--accent-gold)' }} />{name}</span>
              <button className="ct-btn ghost sm" onClick={() => toggleCommander(name)}>Remove</button>
            </div>
          ))}

          <div className="ct-zone-title" style={{ marginTop: 16 }}>Mainboard <span className="ct-zone-count">{parsed.cards.reduce((s, c) => s + c.qty, 0)} cards</span></div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {parsed.cards.map((c) => (
              <div key={c.name} className="ct-card-row">
                <span className="name">{c.qty > 1 ? `${c.qty}x ` : ''}{c.name}</span>
                <button className="ct-btn ghost sm" onClick={() => toggleCommander(c.name)}>Mark commander</button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button className="ct-btn primary" onClick={handleSave} disabled={busy}>
              {busy ? <Loader2 size={14} className="ct-spin" /> : <Check size={14} />} Save deck
            </button>
            <button className="ct-btn" onClick={() => setParsed(null)}>Back</button>
          </div>
        </>
      )}
    </div>
  );
}
