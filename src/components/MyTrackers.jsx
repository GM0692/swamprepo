import React from 'react';
import { Target } from 'lucide-react';
import { updateMyCommanderDamage, updateMyCounters } from '../lib/firebaseSync.js';
import { CommanderDamageRow, PlayerCounters } from './Trackers.jsx';

const EMPTY_SLOTS = [{ id: 'a', label: '', value: 0 }, { id: 'b', label: '', value: 0 }];

export function MyCommanderDamageControl({ roomCode, sessionState, myPlayerId }) {
  const players = sessionState?.players || {};
  const me = players[myPlayerId];
  if (!me) return null;
  const order = sessionState?.turnOrder?.length
    ? sessionState.turnOrder
    : Object.keys(players).sort((a, b) => (players[a]?.seatOrder ?? 0) - (players[b]?.seatOrder ?? 0));
  const others = order.filter((id) => id !== myPlayerId && players[id]);
  if (others.length === 0) return null;

  const myDamage = me.commanderDamage || {};

  async function changeSlot(fromUid, slotIndex, nextSlot) {
    const slots = (myDamage[fromUid] || EMPTY_SLOTS).slice();
    slots[slotIndex] = { label: nextSlot.label, value: nextSlot.value };
    await updateMyCommanderDamage(roomCode, myPlayerId, fromUid, slots);
  }

  return (
    <div>
      <div className="ct-zone-title"><Target size={13} /> Commander damage taken</div>
      {others.map((fromUid) => (
        <CommanderDamageRow
          key={fromUid}
          opponentLabel={`From ${players[fromUid].name}`}
          slots={myDamage[fromUid] || EMPTY_SLOTS}
          onChangeSlot={(slotIndex, nextSlot) => changeSlot(fromUid, slotIndex, nextSlot)}
        />
      ))}
    </div>
  );
}

export function MyCounterControl({ roomCode, sessionState, myPlayerId }) {
  const me = sessionState?.players?.[myPlayerId];
  if (!me) return null;
  const counters = me.counters || { poison: 0, energy: 0, custom: {} };
  const customMap = counters.custom || {};
  const customList = Object.entries(customMap).map(([id, c]) => ({ id, label: c.label, value: c.value }));

  async function push(next) {
    await updateMyCounters(roomCode, myPlayerId, next);
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div className="ct-zone-title">Your counters</div>
      <PlayerCounters
        counters={{ poison: counters.poison || 0, energy: counters.energy || 0, custom: customList }}
        onChangePoison={(v) => push({ ...counters, poison: v })}
        onChangeEnergy={(v) => push({ ...counters, energy: v })}
        onAddCustom={(label) => push({ ...counters, custom: { ...customMap, [Date.now().toString(36)]: { label, value: 0 } } })}
        onChangeCustom={(id, v) => push({ ...counters, custom: { ...customMap, [id]: { ...customMap[id], value: v } } })}
        onRemoveCustom={(id) => {
          const nextCustom = { ...customMap };
          delete nextCustom[id];
          push({ ...counters, custom: nextCustom });
        }}
      />
    </div>
  );
}
