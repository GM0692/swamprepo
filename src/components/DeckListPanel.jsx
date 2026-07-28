import React, { useState } from 'react';
import { Search, ListTree, ChevronRight, ChevronDown, Crown } from 'lucide-react';
import { ViewToggle, CardThumb } from './CardThumb.jsx';
import { ZONE_KEYS, ZONE_LABEL } from '../lib/constants.js';

export function DeckListPanel({ game, moveOne, viewMode, setViewMode }) {
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [selected, setSelected] = useState(null); // { name, zone }
  const [onlyInDeck, setOnlyInDeck] = useState(false);

  const sorted = [...game.cards].sort((a, b) => {
    if (a.isCommander !== b.isCommander) return a.isCommander ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const filtered = sorted
    .filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
    .filter((c) => !onlyInDeck || c.zones.library > 0);
  const expandedCard = expanded ? game.cards.find((c) => c.name === expanded) : null;

  function currentZoneSummary(card) {
    const nonzero = ZONE_KEYS.filter((z) => card.zones[z] > 0);
    if (nonzero.length === 1) return `Currently: ${ZONE_LABEL[nonzero[0]]}`;
    if (nonzero.length === 0) return 'Currently: nowhere?';
    return nonzero.map((z) => `${ZONE_LABEL[z]} ${card.zones[z]}`).join(' · ');
  }

  function handleBadgeClick(card, zone) {
    if (selected && selected.name === card.name) {
      if (selected.zone === zone) { setSelected(null); return; }
      if (card.zones[selected.zone] > 0) moveOne(card.name, selected.zone, zone);
      setSelected(null);
      return;
    }
    const occupied = ZONE_KEYS.filter((z) => card.zones[z] > 0);
    if (occupied.length <= 1) {
      const source = occupied[0];
      if (!source || source === zone) return;
      moveOne(card.name, source, zone);
      return;
    }
    if (card.zones[zone] > 0) setSelected({ name: card.name, zone });
  }

  function ZoneBadges({ card }) {
    return (
      <div className="ct-deck-row-badges">
        {ZONE_KEYS.map((z) => (
          <span
            key={z}
            className={`ct-zone-badge ${card.zones[z] > 0 ? 'has' : 'zero'} ${selected && selected.name === card.name && selected.zone === z ? 'selected' : ''}`}
            onClick={() => handleBadgeClick(card, z)}
          >
            {ZONE_LABEL[z]} {card.zones[z]}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="ct-panel">
      <div className="ct-row-between" style={{ marginBottom: 10 }}>
        <div className="ct-zone-title" style={{ margin: 0 }}><ListTree size={13} /> Full deck list <span className="ct-zone-count">{game.cards.length} unique</span></div>
        <ViewToggle mode={viewMode} setMode={setViewMode} />
      </div>
      <div className="ct-search-wrap" style={{ marginBottom: 10 }}>
        <Search size={14} />
        <input className="ct-input" placeholder="Search your decklist..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button className={`ct-btn sm ${!onlyInDeck ? 'primary' : ''}`} onClick={() => setOnlyInDeck(false)}>Full list</button>
        <button className={`ct-btn sm ${onlyInDeck ? 'primary' : ''}`} onClick={() => setOnlyInDeck(true)}>Still in library <span className="ct-zone-count">{game.cards.filter((c) => c.zones.library > 0).length}</span></button>
      </div>
      <div className="ct-hint" style={{ marginBottom: 10 }}>Tap any zone on a card to move it there. If a card is split across multiple zones, tap the stack you mean first, then the destination.</div>

      {viewMode === 'image' ? (
        <>
          <div className="ct-card-grid" style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 2 }}>
            {filtered.map((c) => (
              <CardThumb
                key={c.name}
                name={c.name}
                badge={c.total > 1 ? c.total : null}
                selected={expanded === c.name}
                onClick={() => { setExpanded(expanded === c.name ? null : c.name); setSelected(null); }}
              />
            ))}
            {filtered.length === 0 && <div className="ct-hint" style={{ padding: 10 }}>No cards match that search.</div>}
          </div>
          {expandedCard && (
            <div className="ct-thumb-detail">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {expandedCard.isCommander && <Crown size={13} style={{ color: 'var(--accent-gold)' }} />}
                <strong style={{ fontSize: 14 }}>{expandedCard.name}</strong>
                <span className="ct-hint">{currentZoneSummary(expandedCard)}</span>
              </div>
              <ZoneBadges card={expandedCard} />
            </div>
          )}
        </>
      ) : (
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {filtered.map((c) => {
            const isOpen = expanded === c.name;
            return (
              <div className="ct-deck-row" key={c.name}>
                <div className="ct-deck-row-head" onClick={() => setExpanded(isOpen ? null : c.name)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    {c.isCommander && <Crown size={13} style={{ color: 'var(--accent-gold)' }} />}
                    <span>{c.name}</span>
                    {c.total > 1 && <span className="ct-hint">x{c.total}</span>}
                  </div>
                  <span className="ct-hint">{currentZoneSummary(c)}</span>
                </div>
                {isOpen && (
                  <div className="ct-deck-row-body">
                    <div style={{ marginTop: 8 }}><ZoneBadges card={c} /></div>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && <div className="ct-hint" style={{ padding: 10 }}>No cards match that search.</div>}
        </div>
      )}
    </div>
  );
}
