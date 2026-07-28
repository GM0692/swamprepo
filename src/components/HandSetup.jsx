import React from 'react';
import { ArrowRight, Library as LibraryIcon, Hand as HandIcon } from 'lucide-react';
import { CardPicker } from './CardPicker.jsx';
import { ViewToggle, CardThumb } from './CardThumb.jsx';
import { totalIn } from '../lib/constants.js';

export function HandSetup({ game, setGame, onBegin, viewMode, setViewMode }) {
  function moveOne(name, from, to) {
    setGame((prev) => {
      const cards = prev.cards.map((c) => {
        if (c.name !== name || c.zones[from] <= 0) return c;
        return { ...c, zones: { ...c.zones, [from]: c.zones[from] - 1, [to]: c.zones[to] + 1 } };
      });
      return { ...prev, cards };
    });
  }

  const handCount = totalIn(game.cards, 'hand');

  return (
    <div className="ct-grid-2">
      <div className="ct-panel">
        <div className="ct-zone-title"><LibraryIcon size={13} /> Library <span className="ct-zone-count">{totalIn(game.cards, 'library')}</span></div>
        <div className="ct-hint" style={{ marginBottom: 8 }}>Tap the cards that are actually in your physical opening hand.</div>
        <CardPicker cards={game.cards} sourceZone="library" placeholder="Search your deck..." onPick={(name) => moveOne(name, 'library', 'hand')} viewMode={viewMode} setViewMode={setViewMode} />
      </div>
      <div className="ct-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="ct-zone-title" style={{ margin: 0 }}><HandIcon size={13} /> Opening hand <span className="ct-zone-count">{handCount}</span></div>
          <ViewToggle mode={viewMode} setMode={setViewMode} />
        </div>
        {handCount === 0 && <div className="ct-hint" style={{ marginTop: 8 }}>Nothing selected yet — typically 7 cards.</div>}
        {viewMode === 'image' ? (
          <div className="ct-card-grid" style={{ marginTop: 10 }}>
            {game.cards.filter((c) => c.zones.hand > 0).map((c) => (
              <CardThumb
                key={c.name}
                name={c.name}
                badge={c.zones.hand > 1 ? c.zones.hand : null}
                onClick={() => moveOne(c.name, 'hand', 'library')}
              />
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 8 }}>
            {game.cards.filter((c) => c.zones.hand > 0).map((c) => (
              <div key={c.name} className="ct-card-row">
                <span className="name">{c.name}{c.zones.hand > 1 ? ` x${c.zones.hand}` : ''}</span>
                <button className="ct-btn ghost sm" onClick={() => moveOne(c.name, 'hand', 'library')}>Remove</button>
              </div>
            ))}
          </div>
        )}
        <button className="ct-btn primary" style={{ marginTop: 14 }} onClick={onBegin}>Begin game <ArrowRight size={14} /></button>
      </div>
    </div>
  );
}
