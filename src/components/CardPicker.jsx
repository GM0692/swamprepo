import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { ZONE_LABEL } from '../lib/constants.js';
import { ViewToggle, CardThumb } from './CardThumb.jsx';

export function CardPicker({ cards, sourceZone, onPick, placeholder, viewMode, setViewMode }) {
  const [q, setQ] = useState('');
  const available = cards.filter((c) => c.zones[sourceZone] > 0 && c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div className="ct-search-wrap" style={{ flex: 1 }}>
          <Search size={14} />
          <input className="ct-input" placeholder={placeholder || 'Search cards...'} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <ViewToggle mode={viewMode} setMode={setViewMode} />
      </div>

      {viewMode === 'image' ? (
        <div className="ct-card-grid" style={{ marginTop: 10 }}>
          {available.length === 0 && <div className="ct-hint" style={{ padding: '8px 10px' }}>No matching cards in {ZONE_LABEL[sourceZone].toLowerCase()}.</div>}
          {available.slice(0, 60).map((c) => (
            <CardThumb key={c.name} name={c.name} badge={c.zones[sourceZone] > 1 ? c.zones[sourceZone] : null} onClick={() => onPick(c.name)} />
          ))}
        </div>
      ) : (
        <div className="ct-picker-list">
          {available.length === 0 && <div className="ct-hint" style={{ padding: '8px 10px' }}>No matching cards in {ZONE_LABEL[sourceZone].toLowerCase()}.</div>}
          {available.slice(0, 30).map((c) => (
            <div key={c.name} className="ct-picker-item" onClick={() => onPick(c.name)}>
              <span>{c.name}</span>
              <span className="ct-hint">{c.zones[sourceZone]} left</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
