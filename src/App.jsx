import React, { useEffect, useState } from 'react';
import { Swords, BookOpen, History as HistoryIcon, Loader2, Settings as SettingsIcon, Users } from 'lucide-react';
import { sGet, sSet, sDelete } from './lib/storage.js';
import { PHASES, uid, timeNow, makeActiveGame, ensureTrackers } from './lib/constants.js';
import { askClaude } from './lib/claudeApi.js';
import { DecksTab, GameSetup } from './components/DecksAndSetup.jsx';
import { HandSetup } from './components/HandSetup.jsx';
import { GameBoard } from './components/GameBoard.jsx';
import { EndGameModal, HistoryTab } from './components/EndGameAndHistory.jsx';
import { SettingsTab } from './components/SettingsTab.jsx';
import { GroupSession } from './components/GroupSession.jsx';

export default function App() {
  const [tab, setTab] = useState('play');
  const [loaded, setLoaded] = useState(false);
  const [deckIndex, setDeckIndex] = useState([]);
  const [gameIndex, setGameIndex] = useState([]);
  const [activeGame, setActiveGame] = useState(null);
  const [deckHistoryForActive, setDeckHistoryForActive] = useState([]);
  const [showEndModal, setShowEndModal] = useState(false);
  const [cardViewMode, setCardViewMode] = useState('list');

  useEffect(() => {
    (async () => {
      const di = await sGet('deck-index', []);
      const gi = await sGet('game-index', []);
      let ag = await sGet('active-game', null);
      if (ag && !Array.isArray(ag.cards)) {
        await sDelete('active-game');
        ag = null;
      }
      if (ag) ag = ensureTrackers(ag);
      setDeckIndex(di || []);
      setGameIndex(gi || []);
      setActiveGame(ag);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (activeGame) sSet('active-game', activeGame);
  }, [activeGame, loaded]);

  useEffect(() => {
    (async () => {
      if (activeGame) {
        const pastGames = [];
        for (const g of gameIndex.filter((x) => x.deckId === activeGame.deckId).slice(-3)) {
          const full = await sGet(`game:${g.id}`);
          if (full) pastGames.push(full);
        }
        setDeckHistoryForActive(pastGames);
      }
    })();
  }, [activeGame?.deckId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleStartGame(deck, opponentCount, sessionSeat) {
    const g = makeActiveGame(deck, opponentCount, sessionSeat);
    setActiveGame(g);
    await sSet('active-game', g);
  }

  function handleBeginAfterSetup() {
    setActiveGame((prev) => ({ ...prev, handConfirmed: true, log: [...prev.log, { id: uid(), turn: 1, phase: PHASES[0], text: '— Game begins, Turn 1 —', ts: timeNow() }] }));
  }

  async function handleConfirmEnd(result) {
    const id = uid();
    const record = {
      id,
      deckId: activeGame.deckId,
      deckName: activeGame.deckName,
      date: new Date().toISOString(),
      result,
      turnsPlayed: activeGame.turn,
      log: activeGame.log,
      finalLife: activeGame.life,
      finalTrackers: activeGame.trackers,
      analysis: null,
    };
    await sSet(`game:${id}`, record);
    const nextIndex = [...gameIndex, { id, deckId: record.deckId, deckName: record.deckName, date: record.date, result, turnsPlayed: record.turnsPlayed }];
    setGameIndex(nextIndex);
    await sSet('game-index', nextIndex);

    setShowEndModal(false);
    setActiveGame(null);
    await sDelete('active-game');
    setTab('history');

    (async () => {
      try {
        const logText = record.log.map((l) => `T${l.turn} ${l.phase}: ${l.text}`).join('\n');
        const prompt = `Analyze this Magic: The Gathering Commander game.

Deck: ${record.deckName}
Result: ${result}
Turns played: ${record.turnsPlayed}
Final life totals: ${JSON.stringify(record.finalLife)}

Full action log:
${logText || '(no actions logged)'}

Write a short analysis (4-6 sentences): what went well, what could improve, and one concrete tip for next time with this deck. No markdown headers.`;
        const analysis = await askClaude(prompt, 'You are a thoughtful Magic: The Gathering Commander coach reviewing a completed game.');
        const updated = { ...record, analysis };
        await sSet(`game:${id}`, updated);
        setGameIndex((prev) => [...prev]);
      } catch (e) {
        /* analysis is a bonus feature — fail silently if no API key is set, etc. */
      }
    })();
  }

  function handleDeckSaved(deck) {
    setDeckIndex((prev) => [...prev, { id: deck.id, name: deck.name, cardCount: deck.mainboard.reduce((s, c) => s + c.qty, 0) + deck.commander.length }]);
  }

  if (!loaded) {
    return (
      <div className="ct-root">
        <div className="ct-shell" style={{ display: 'flex', justifyContent: 'center', paddingTop: 100 }}><Loader2 size={24} className="ct-spin" /></div>
      </div>
    );
  }

  const inGame = tab === 'play' && !!activeGame?.handConfirmed;

  return (
    <div className="ct-root">
      <div className="ct-shell">
        <div className={`ct-header ${inGame ? 'ct-header-compact' : ''}`}>
          <div>
            <div className="ct-title ct-display"><Swords size={26} style={{ color: 'var(--accent-gold)' }} /> SwampTap</div>
            <div className="ct-sub">Deck tracking &amp; play-by-play for EDH</div>
          </div>
          <div className="ct-tabs">
            <button className={`ct-tab ${tab === 'decks' ? 'active' : ''}`} onClick={() => setTab('decks')}><BookOpen size={15} /><span className="ct-tab-label">Decks</span></button>
            <button className={`ct-tab ${tab === 'play' ? 'active' : ''}`} onClick={() => setTab('play')}><Swords size={15} /><span className="ct-tab-label">Play</span></button>
            <button className={`ct-tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}><HistoryIcon size={15} /><span className="ct-tab-label">History</span></button>
            <button className={`ct-tab ${tab === 'group' ? 'active' : ''}`} onClick={() => setTab('group')}><Users size={15} /><span className="ct-tab-label">Group</span></button>
            <button className={`ct-tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}><SettingsIcon size={15} /><span className="ct-tab-label">Settings</span></button>
          </div>
        </div>

        {tab === 'decks' && <DecksTab deckIndex={deckIndex} setDeckIndex={setDeckIndex} onDeckSaved={handleDeckSaved} />}

        {tab === 'play' && (
          activeGame ? (
            activeGame.handConfirmed ? (
              <GameBoard game={activeGame} setGame={setActiveGame} deckHistory={deckHistoryForActive} onEndGame={() => setShowEndModal(true)} viewMode={cardViewMode} setViewMode={setCardViewMode} />
            ) : (
              <HandSetup game={activeGame} setGame={setActiveGame} onBegin={handleBeginAfterSetup} viewMode={cardViewMode} setViewMode={setCardViewMode} />
            )
          ) : (
            <GameSetup deckIndex={deckIndex} onStart={handleStartGame} />
          )
        )}

        {tab === 'history' && <HistoryTab gameIndex={gameIndex} />}
        {tab === 'group' && <GroupSession onGoToSettings={() => setTab('settings')} />}
        {tab === 'settings' && <SettingsTab />}

        {showEndModal && activeGame && <EndGameModal onConfirm={handleConfirmEnd} onCancel={() => setShowEndModal(false)} />}
      </div>
    </div>
  );
}
