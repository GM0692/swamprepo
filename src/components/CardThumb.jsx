import React, { useState } from 'react';
import { List as ListIcon, LayoutGrid } from 'lucide-react';
import { scryfallImageUrl } from '../lib/scryfall.js';

export function ViewToggle({ mode, setMode }) {
  return (
    <div className="ct-view-toggle">
      <button className={`ct-btn sm ${mode === 'list' ? 'primary' : ''}`} onClick={() => setMode('list')} title="List view"><ListIcon size={13} /></button>
      <button className={`ct-btn sm ${mode === 'image' ? 'primary' : ''}`} onClick={() => setMode('image')} title="Image view"><LayoutGrid size={13} /></button>
    </div>
  );
}

export function CardThumb({ name, badge, selected, onClick }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`ct-thumb ${selected ? 'selected' : ''}`} onClick={onClick}>
      {badge != null && <span className="ct-thumb-badge">{badge}</span>}
      {!broken ? (
        <img src={scryfallImageUrl(name, 'small')} alt={name} loading="lazy" onError={() => setBroken(true)} />
      ) : (
        <div className="ct-thumb-fallback">{name}</div>
      )}
      <div className="ct-thumb-cap">{name}</div>
    </div>
  );
}
