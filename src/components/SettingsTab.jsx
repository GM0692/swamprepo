import React, { useEffect, useState } from 'react';
import { Check, Loader2, KeyRound } from 'lucide-react';
import { sGet, sSet } from '../lib/storage.js';

export function SettingsTab() {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      setApiKey((await sGet('settings:anthropicApiKey', '')) || '');
      setModel((await sGet('settings:model', '')) || '');
      setLoaded(true);
    })();
  }, []);

  async function handleSave() {
    await sSet('settings:anthropicApiKey', apiKey.trim());
    await sSet('settings:model', model.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!loaded) return <Loader2 size={20} className="ct-spin" />;

  return (
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
        but won't sync to other devices. For multi-device sync or a shared/public deployment, swap the storage layer
        in <code>src/lib/storage.js</code> for a real backend, and route AI calls through a small server-side proxy
        instead of calling Anthropic directly from the browser.
      </div>
    </div>
  );
}
