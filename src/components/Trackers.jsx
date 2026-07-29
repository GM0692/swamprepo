import React, { useState } from 'react';
import { Plus, Minus, X } from 'lucide-react';

export function TrackerChip({ label, value, onInc, onDec, onLabelChange, placeholder = 'Label', warnAt, readOnly }) {
  const warn = warnAt != null && value >= warnAt;
  return (
    <div className={`ct-tracker-chip ${warn ? 'warn' : ''}`}>
      {onLabelChange ? (
        <input
          className="ct-tracker-label-input"
          value={label}
          placeholder={placeholder}
          onChange={(e) => onLabelChange(e.target.value)}
        />
      ) : (
        <span className="ct-tracker-label">{label || placeholder}</span>
      )}
      <div className="ct-tracker-controls">
        {!readOnly && <button className="ct-btn ghost sm" onClick={onDec} aria-label={`Decrease ${label || placeholder}`}><Minus size={12} /></button>}
        <span className="ct-tracker-value">{value}</span>
        {!readOnly && <button className="ct-btn ghost sm" onClick={onInc} aria-label={`Increase ${label || placeholder}`}><Plus size={12} /></button>}
      </div>
    </div>
  );
}

export function CommanderDamageRow({ opponentLabel, slots, onChangeSlot, readOnly }) {
  return (
    <div className="ct-tracker-group">
      <div className="ct-tracker-group-label">{opponentLabel}</div>
      <div className="ct-tracker-row">
        {slots.map((slot, i) => (
          <TrackerChip
            key={slot.id || i}
            label={slot.label}
            value={slot.value}
            warnAt={21}
            readOnly={readOnly}
            placeholder={`Commander ${i + 1}`}
            onInc={() => onChangeSlot(i, { ...slot, value: Math.max(0, slot.value + 1) })}
            onDec={() => onChangeSlot(i, { ...slot, value: Math.max(0, slot.value - 1) })}
            onLabelChange={readOnly ? undefined : (label) => onChangeSlot(i, { ...slot, label })}
          />
        ))}
      </div>
    </div>
  );
}

export function PlayerCounters({ counters, onChangePoison, onChangeEnergy, onAddCustom, onChangeCustom, onRemoveCustom, readOnly }) {
  const [newLabel, setNewLabel] = useState('');

  function submitNew() {
    if (!newLabel.trim() || !onAddCustom) return;
    onAddCustom(newLabel.trim());
    setNewLabel('');
  }

  return (
    <div className="ct-tracker-row">
      <TrackerChip
        label="Poison" value={counters.poison} warnAt={10} readOnly={readOnly}
        onInc={() => onChangePoison(Math.max(0, counters.poison + 1))}
        onDec={() => onChangePoison(Math.max(0, counters.poison - 1))}
      />
      <TrackerChip
        label="Energy" value={counters.energy} readOnly={readOnly}
        onInc={() => onChangeEnergy(Math.max(0, counters.energy + 1))}
        onDec={() => onChangeEnergy(Math.max(0, counters.energy - 1))}
      />
      {(counters.custom || []).map((c) => (
        <div key={c.id} className="ct-tracker-chip-wrap">
          <TrackerChip
            label={c.label} value={c.value} readOnly={readOnly}
            onInc={() => onChangeCustom(c.id, Math.max(0, c.value + 1))}
            onDec={() => onChangeCustom(c.id, Math.max(0, c.value - 1))}
          />
          {!readOnly && onRemoveCustom && (
            <button className="ct-btn ghost sm" onClick={() => onRemoveCustom(c.id)} aria-label={`Remove ${c.label} counter`}><X size={12} /></button>
          )}
        </div>
      ))}
      {!readOnly && onAddCustom && (
        <div className="ct-tracker-add">
          <input
            className="ct-input" placeholder="New counter..." value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitNew()}
          />
          <button className="ct-btn sm" onClick={submitNew}>Add</button>
        </div>
      )}
    </div>
  );
}
