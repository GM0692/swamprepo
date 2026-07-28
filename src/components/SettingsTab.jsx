import React, { useEffect, useState } from 'react';
import { Check, Loader2, KeyRound, Users } from 'lucide-react';
import { sGet, sSet } from '../lib/storage.js';
import { isFirebaseConfigured } from '../lib/firebaseSync.js';

// Accepts either strict JSON or the raw `const firebaseConfig = {...};` snippet
// the Firebase console shows by default (unquoted keys, trailing semicolon).
function parseFirebaseConfigInput(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch { /* fall through to the lenient parse below */ }
  try {
    const objText = trimmed.replace(/^\s*(const|let|var)\s+\w+\s*=\s*/, '').replace(/;\s*$/, '');
    const value = Function(`"use strict"; return (${objText});`)(); // eslint-disable-line no-new-func
    if (value && typeof value === 'object') return value;
  } catch { /* not parseable either way */ }
  return null;
}

export function SettingsTab() {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [firebaseConfigText, setFirebaseConfigText] = useState('');
  const [firebaseSaved, setFirebaseSaved] = useState(false);
  const [firebaseError, setFirebaseError] = useState('');

  useEffect(() => {
    (async () => {
      setApiKey((await sGet('settings:anthropicApiKey', '')) || '');
      setModel((await sGet('settings:model', '')) || '');
      const storedFirebaseConfig = await sGet('settings:firebaseConfig', null);
      if (storedFirebaseConfig) setFirebaseConfigText(JSON.stringify(storedFirebaseConfig, null, 2));
      setLoaded(true);
    })();
  }, []);

  async function handleSave() {
    await sSet('settings:anthropicApiKey', apiKey.trim());
    await sSet('settings:model', model.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleSaveFirebase() {
    setFirebaseError('');
    if (!firebaseConfigText.trim()) {
      await sSet('settings:firebaseConfig', null);
      setFirebaseSaved(true);
      setTimeout(() => setFirebaseSaved(false), 2000);
      return;
    }
    const parsed = parseFirebaseConfigInput(firebaseConfigText);
    if (!isFirebaseConfigured(parsed)) {
      setFirebaseError("Couldn't read that as a Firebase config — paste the whole object from your Firebase console's Web App settings.");
      return;
    }
    await sSet('settings:firebaseConfig', parsed);
    setFirebaseSaved(true);
    setTimeout(() => setFirebaseSaved(false), 2000);
  }

  if (!loaded) return <Loader2 size={20} className="ct-spin" />;

  return (
    <>
    <div className="ct-panel">
      <div className="ct-zone-title"><KeyRound size={13} /> Anthropic API key</div>
      <div className="ct-hint" style={{ marginBottom: 12 }}>
        Needed for AI play suggestions and post-game analysis. Get a key at{' '}
        <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-gold)' }}>console.anthropic.com</a>.
        It's stored only in this browser's local storage and sent directly to Anthropic — never to any server of ours.
      </div>
      <input className="ct-input" type="password" placeholder="sk-ant-..." value={apiKey} onChange={(e) => setApiKey(e.target.value)} />

      <div className="ct-zone-title" style={{ marginTop: 20 }}>Model (optional)</div>
      <div className="ct-hint" style={{ marginBottom: 12 }}>Leave blank to use the default. Override if you want a faster/cheaper or newer model.</div>
      <input className="ct-input" placeholder="claude-sonnet-5" value={model} onChange={(e) => setModel(e.target.value)} />

      <button className="ct-btn primary" style={{ marginTop: 16 }} onClick={handleSave}>
        {saved ? <Check size={14} /> : null} {saved ? 'Saved' : 'Save settings'}
      </button>

      <div className="ct-hint" style={{ marginTop: 20, lineHeight: 1.6 }}>
        Deck and game data live in this browser's local storage too, so they'll persist across visits on this device,
        but won't sync to other devices on their own — see Firebase sync below for that. Note that a shared/public
        deployment would still need AI calls routed through a small server-side proxy instead of calling Anthropic
        directly from the browser, as this app does today.
      </div>
    </div>

    <div className="ct-panel">
      <div className="ct-zone-title"><Users size={13} /> Firebase sync (optional)</div>
      <div className="ct-hint" style={{ marginBottom: 12, lineHeight: 1.6 }}>
        Powers the Group tab — live-shared life totals, turn order, and a turn timer across your group's phones.
        Create a free project at{' '}
        <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-gold)' }}>console.firebase.google.com</a>,
        enable Realtime Database (paste this repo's <code>database.rules.json</code> into its Rules tab) and enable
        Anonymous sign-in under Authentication, then paste the Web App config below — either the raw{' '}
        <code>const firebaseConfig = {'{...}'}</code> snippet or plain JSON both work. This config is meant to be
        public; access control comes from the database rules, not secrecy. Stored only in this browser.
      </div>
      <textarea
        className="ct-textarea"
        style={{ minHeight: 120 }}
        placeholder={'{\n  "apiKey": "...",\n  "authDomain": "...",\n  "databaseURL": "...",\n  "projectId": "..."\n}'}
        value={firebaseConfigText}
        onChange={(e) => setFirebaseConfigText(e.target.value)}
      />
      {firebaseError && <div className="ct-hint" style={{ color: 'var(--danger)', marginTop: 8 }}>{firebaseError}</div>}
      <button className="ct-btn primary" style={{ marginTop: 12 }} onClick={handleSaveFirebase}>
        {firebaseSaved ? <Check size={14} /> : null} {firebaseSaved ? 'Saved' : 'Save Firebase config'}
      </button>
    </div>
    </>
  );
}
