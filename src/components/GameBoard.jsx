import React, { useState } from 'react';
import {
  Clock, Sparkles, Plus, Minus, ChevronRight, Library as LibraryIcon,
  Skull, Ban, Hand as HandIcon, Layers, Crown, Shield, Loader2, ListTree,
} from 'lucide-react';
import { CardPicker } from './CardPicker.jsx';
import { DeckListPanel } from './DeckListPanel.jsx';
import { askClaude } from '../lib/claudeApi.js';
import { PHASES, totalIn, uid, timeNow, moveLabel } from '../lib/constants.js';

function CardRow({ label, actions }) {
  return (
    <div className="ct-card-row">
      <span className="name">{label}</span>
      <div className="ct-card-actions">{actions}</div>
    </div>
  );
}

export function GameBoard({ game, setGame, deckHistory, onEndGame, viewMode, setViewMode }) {
  const [customAction, setCustomAction] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState('');
  const [drawing, setDrawing] = useState(false);
  const [showDeckList, setShowDeckList] = useState(false);

  function moveOne(name, from, to, { silent } = {}) {
    setGame((prev) => {
      const cards = prev.cards.map((c) => {
        if (c.name !== name || c.zones[from] <= 0) return c;
        return { ...c, zones: { ...c.zones, [from]: c.zones[from] - 1, [to]: c.zones[to] + 1 } };
      });
      let log = prev.log;
      if (!silent) {
        log = [...log, { id: uid(), turn: prev.turn, phase: PHASES[prev.phaseIndex], text: moveLabel(from, to, name), ts: timeNow() }];
      }
      return { ...prev, cards, log };
    });
  }

  function castCommander(name) {
    setGame((prev) => {
      const cards = prev.cards.map((c) => {
        if (c.name !== name || c.zones.commandZone <= 0) return c;
        return { ...c, zones: { ...c.zones, commandZone: c.zones.commandZone - 1, battlefield: c.zones.battlefield + 1 } };
      });
      const prevCasts = prev.commanderCastCounts[name] || 0;
      const nextCasts = prevCasts + 1;
      const tax = prevCasts * 2;
      const text = `Cast commander ${name}${tax ? ` (tax +${tax})` : ''}`;
      return {
        ...prev,
        cards,
        commanderCastCounts: { ...prev.commanderCastCounts, [name]: nextCasts },
        log: [...prev.log, { id: uid(), turn: prev.turn, phase: PHASES[prev.phaseIndex], text, ts: timeNow() }],
      };
    });
  }

  function nextPhase() {
    setGame((prev) => {
      if (prev.phaseIndex >= PHASES.length - 1) {
        const turn = prev.turn + 1;
        return { ...prev, phaseIndex: 0, turn, log: [...prev.log, { id: uid(), turn, phase: PHASES[0], text: `— Turn ${turn} begins —`, ts: timeNow() }] };
      }
      return { ...prev, phaseIndex: prev.phaseIndex + 1 };
    });
  }

  function adjustLife(key, delta) {
    setGame((prev) => ({ ...prev, life: { ...prev.life, [key]: prev.life[key] + delta } }));
  }

  function addCustomLog() {
    if (!customAction.trim()) return;
    setGame((prev) => ({ ...prev, log: [...prev.log, { id: uid(), turn: prev.turn, phase: PHASES[prev.phaseIndex], text: customAction.trim(), ts: timeNow() }] }));
    setCustomAction('');
  }

  async function handleSuggest() {
    setSuggestLoading(true);
    setSuggestError('');
    setSuggestion('');
    try {
      const hand = game.cards.filter((c) => c.zones.hand > 0).map((c) => (c.zones.hand > 1 ? `${c.name} x${c.zones.hand}` : c.name)).join(', ') || '(empty)';
      const battlefield = game.cards.filter((c) => c.zones.battlefield > 0).map((c) => (c.zones.battlefield > 1 ? `${c.name} x${c.zones.battlefield}` : c.name)).join(', ') || '(empty)';
      const commandZone = game.cards.filter((c) => c.zones.commandZone > 0).map((c) => c.name).join(', ') || '(empty)';
      const graveyard = game.cards.filter((c) => c.zones.graveyard > 0).map((c) => c.name).join(', ') || '(empty)';
      const recentLog = game.log.slice(-15).map((l) => `T${l.turn} ${l.phase}: ${l.text}`).join('\n');
      const historyNote = deckHistory.length
        ? deckHistory.slice(-3).map((h) => `- ${h.result} in ${h.turnsPlayed} turns${h.analysis ? `: ${h.analysis.slice(0, 200)}` : ''}`).join('\n')
        : 'No prior games recorded yet.';

      const prompt = `You are helping a Magic: The Gathering Commander player decide their next move.

Commander(s): ${game.commanderNames.join(', ') || 'Unknown'}
Current turn: ${game.turn}, Phase: ${PHASES[game.phaseIndex]}
Life totals: ${Object.entries(game.life).map(([k, v]) => `${k}: ${v}`).join(', ')}
Hand: ${hand}
Battlefield: ${battlefield}
Command zone: ${commandZone}
Graveyard: ${graveyard}

Recent turn log:
${recentLog || '(no actions logged yet)'}

Brief history with this deck:
${historyNote}

Give a short, concrete suggestion (3-5 sentences) for the best play available right now, and one risk to watch for. Be specific about card names when relevant. Do not use markdown headers.`;

      const result = await askClaude(prompt, 'You are a sharp, concise Magic: The Gathering Commander strategy assistant. Keep answers short, specific, and actionable.');
      setSuggestion(result);
    } catch (e) {
      setSuggestError(e.message || 'Something went wrong asking for a suggestion.');
    } finally {
      setSuggestLoading(false);
    }
  }

  const opponentKeys = Object.keys(game.life).filter((k) => k !== 'you');
  const libraryCount = totalIn(game.cards, 'library');

  return (
    <div>
      <div className="ct-grid-3">
        <div className="ct-panel">
          <div className="ct-zone-title"><Clock size={13} /> Turn {game.turn}</div>
          <div className="ct-ledger">
            {PHASES.map((p, i) => {
              const isCurrent = i === game.phaseIndex;
              const entries = game.log.filter((l) => l.turn === game.turn && l.phase === p);
              return (
                <div key={p} className={`ct-ledger-phase ${isCurrent ? 'current' : ''}`}>
                  <div className="ct-ledger-label">{p}</div>
                  {entries.map((e) => <div key={e.id} className="ct-ledger-entry">{e.text}</div>)}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="ct-btn primary sm" onClick={nextPhase}>Next phase <ChevronRight size={14} /></button>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
            <input className="ct-input" placeholder="Log a custom action..." value={customAction} onChange={(e) => setCustomAction(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCustomLog()} />
            <button className="ct-btn sm" onClick={addCustomLog}>Log</button>
          </div>
        </div>

        <div className="ct-panel">
          <div className="ct-zone-title"><Shield size={13} /> Life totals</div>
          <div className="ct-life-row">
            <div className="ct-life-name">You</div>
            <button className="ct-btn ghost sm" onClick={() => adjustLife('you', -1)}><Minus size={13} /></button>
            <div className="ct-life-num">{game.life.you}</div>
            <button className="ct-btn ghost sm" onClick={() => adjustLife('you', 1)}><Plus size={13} /></button>
          </div>
          {opponentKeys.map((k, i) => (
            <div className="ct-life-row" key={k}>
              <div className="ct-life-name">Opponent {i + 1}</div>
              <button className="ct-btn ghost sm" onClick={() => adjustLife(k, -1)}><Minus size={13} /></button>
              <div className="ct-life-num">{game.life[k]}</div>
              <button className="ct-btn ghost sm" onClick={() => adjustLife(k, 1)}><Plus size={13} /></button>
            </div>
          ))}

          <div className="ct-zone-title" style={{ marginTop: 18 }}><LibraryIcon size={13} /> Library <span className="ct-zone-count">{libraryCount}</span></div>
          {!drawing && <button className="ct-btn sm" onClick={() => setDrawing(true)} disabled={libraryCount === 0}>Draw a card</button>}
          {drawing && (
            <div>
              <CardPicker cards={game.cards} sourceZone="library" placeholder="Which card did you draw?" onPick={(name) => { moveOne(name, 'library', 'hand'); setDrawing(false); }} viewMode={viewMode} setViewMode={setViewMode} />
              <button className="ct-btn ghost sm" style={{ marginTop: 6 }} onClick={() => setDrawing(false)}>Cancel</button>
            </div>
          )}

          <div className="ct-zone-title" style={{ marginTop: 18 }}><Crown size={13} /> Command zone <span className="ct-zone-count">{totalIn(game.cards, 'commandZone')}</span></div>
          {game.cards.filter((c) => c.zones.commandZone > 0).length === 0 && <div className="ct-hint">Empty</div>}
          {game.cards.filter((c) => c.zones.commandZone > 0).map((c) => (
            <CardRow key={c.name} label={`${c.name}${game.commanderCastCounts[c.name] ? ` (cast x${game.commanderCastCounts[c.name]})` : ''}`} actions={
              <button className="ct-btn ghost sm" onClick={() => castCommander(c.name)}>Cast</button>
            } />
          ))}

          <button className="ct-btn danger sm" style={{ marginTop: 16 }} onClick={onEndGame}>End game</button>
        </div>

        <div className="ct-panel">
          <div className="ct-zone-title"><HandIcon size={13} /> Hand <span className="ct-zone-count">{totalIn(game.cards, 'hand')}</span></div>
          {game.cards.filter((c) => c.zones.hand > 0).length === 0 && <div className="ct-hint" style={{ marginBottom: 10 }}>Empty</div>}
          {game.cards.filter((c) => c.zones.hand > 0).map((c) => (
            <CardRow key={c.name} label={c.zones.hand > 1 ? `${c.name} x${c.zones.hand}` : c.name} actions={<>
              <button className="ct-btn ghost sm" onClick={() => moveOne(c.name, 'hand', 'battlefield')}>Play</button>
              <button className="ct-btn ghost sm" onClick={() => moveOne(c.name, 'hand', 'graveyard')}>Discard</button>
            </>} />
          ))}

          <div className="ct-zone-title" style={{ marginTop: 16 }}><Layers size={13} /> Battlefield <span className="ct-zone-count">{totalIn(game.cards, 'battlefield')}</span></div>
          {game.cards.filter((c) => c.zones.battlefield > 0).length === 0 && <div className="ct-hint" style={{ marginBottom: 10 }}>Empty</div>}
          {game.cards.filter((c) => c.zones.battlefield > 0).map((c) => (
            <CardRow key={c.name} label={c.zones.battlefield > 1 ? `${c.name} x${c.zones.battlefield}` : c.name} actions={<>
              <button className="ct-btn ghost sm" onClick={() => moveOne(c.name, 'battlefield', 'graveyard')}>Destroy</button>
              <button className="ct-btn ghost sm" onClick={() => moveOne(c.name, 'battlefield', 'hand')}>Bounce</button>
              {c.isCommander && <button className="ct-btn ghost sm" onClick={() => moveOne(c.name, 'battlefield', 'commandZone')}>To CZ</button>}
            </>} />
          ))}

          <div className="ct-zone-title" style={{ marginTop: 16 }}><Skull size={13} /> Graveyard <span className="ct-zone-count">{totalIn(game.cards, 'graveyard')}</span></div>
          {game.cards.filter((c) => c.zones.graveyard > 0).map((c) => (
            <CardRow key={c.name} label={c.zones.graveyard > 1 ? `${c.name} x${c.zones.graveyard}` : c.name} actions={<>
              <button className="ct-btn ghost sm" onClick={() => moveOne(c.name, 'graveyard', 'hand')}>Return</button>
              {c.isCommander && <button className="ct-btn ghost sm" onClick={() => moveOne(c.name, 'graveyard', 'commandZone')}>To CZ</button>}
            </>} />
          ))}

          <div className="ct-zone-title" style={{ marginTop: 16 }}><Ban size={13} /> Exile <span className="ct-zone-count">{totalIn(game.cards, 'exile')}</span></div>
          {game.cards.filter((c) => c.zones.exile > 0).map((c) => (
            <CardRow key={c.name} label={c.zones.exile > 1 ? `${c.name} x${c.zones.exile}` : c.name} actions={
              <button className="ct-btn ghost sm" onClick={() => moveOne(c.name, 'exile', 'hand')}>Return</button>
            } />
          ))}
        </div>
      </div>

      <div className="ct-panel" style={{ marginTop: 16 }}>
        <div className="ct-row-between" style={{ marginBottom: showDeckList ? 12 : 0 }}>
          <div className="ct-zone-title" style={{ margin: 0 }}><ListTree size={13} /> Full deck list</div>
          <button className="ct-btn sm" onClick={() => setShowDeckList((v) => !v)}>{showDeckList ? 'Hide' : 'Show'}</button>
        </div>
        {showDeckList && <div style={{ marginTop: 12 }}><DeckListPanel game={game} moveOne={moveOne} viewMode={viewMode} setViewMode={setViewMode} /></div>}
      </div>

      <div className="ct-panel" style={{ marginTop: 16 }}>
        <div className="ct-row-between" style={{ marginBottom: 12 }}>
          <div className="ct-zone-title" style={{ margin: 0 }}><Sparkles size={13} /> AI play suggestion</div>
          <button className="ct-btn sm primary" onClick={handleSuggest} disabled={suggestLoading}>
            {suggestLoading ? <Loader2 size={14} className="ct-spin" /> : <Sparkles size={14} />} Suggest a play
          </button>
        </div>
        {suggestError && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{suggestError}</div>}
        {suggestion && <div className="ct-suggestion-box">{suggestion}</div>}
        {!suggestion && !suggestError && !suggestLoading && (
          <div className="ct-hint">Ask for a suggestion any time during your turn — it factors in your hand, board, and past games with this deck.</div>
        )}
      </div>
    </div>
  );
}
