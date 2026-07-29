# SwampTap

A tabletop companion for Magic: The Gathering Commander/EDH — import a decklist, set your real
opening hand, track hand/battlefield/graveyard/exile/command zone as you play, and get AI play
suggestions and post-game analysis.

This is a standalone Vite + React app (not a Claude.ai artifact), which means:
- Card art loads normally from Scryfall — no sandbox content-security-policy blocking it.
- Your decks and game history persist in this browser's local storage.
- AI suggestions call the Anthropic API directly using your own API key (set in the Settings tab).

## Run it locally

```bash
npm install
npm run dev
```

Then open the URL it prints (usually http://localhost:5173).

## Add your Anthropic API key

Go to the **Settings** tab in the app and paste in an API key from
[console.anthropic.com](https://console.anthropic.com). It's stored only in this browser's
local storage and sent directly to `api.anthropic.com` — it never passes through any server of
ours. That's fine for running this on your own machine, but:

- Don't deploy a public build of this app with a key embedded in it.
- Anyone with access to this browser profile can read the key out of local storage.

If you want to share this app with other people or host it publicly, replace the direct
`fetch()` in `src/lib/claudeApi.js` with a call to a small server-side proxy (a single
serverless function is enough) that holds the key instead.

## Build for production / deploy

```bash
npm run build
```

This outputs static files to `dist/`. You can host those anywhere that serves static files —
Vercel, Netlify, Cloudflare Pages, GitHub Pages, or your own server. No backend is required for
the core app; only the AI features need the API key described above.

## Where things live

- `src/App.jsx` — top-level tabs and state wiring
- `src/components/` — one file per feature area (deck import, game board, deck list, etc.)
- `src/lib/storage.js` — persistence layer (currently localStorage; swap this for a real backend
  if you want multi-device sync)
- `src/lib/deckImport.js` — decklist text parsing + Moxfield/Archidekt URL import
- `src/lib/scryfall.js` — card art URLs
- `src/lib/claudeApi.js` — AI suggestion/analysis calls
- `src/lib/constants.js` — shared game-state helpers (phases, zone labels, move logging)

## Ideas for extending it

- Swap `storage.js` for IndexedDB or a real backend (Postgres + a small API) for multi-device
  sync and to support more than one player's collection.
- Add commander damage tracking per opponent, not just generic life totals.
- Cache Scryfall lookups (name → image URL) locally so repeat games don't re-fetch art every time.
- Turn this into a PWA (add a manifest + service worker) so it installs on a phone and works
  offline at the table, syncing once you're back on wifi.
