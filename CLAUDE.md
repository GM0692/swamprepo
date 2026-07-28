# CLAUDE.md — Project context for Commander Ledger

This file is read automatically by Claude Code at the start of a session. It exists so a new
session has the same context as the conversation that built this project, without needing it
re-explained.

## What this is

A tabletop companion app for Magic: The Gathering Commander/EDH. The person playing uses real
physical cards at a table; this app is the digital scorepad/tracker running alongside the game,
not a simulator that plays the game for them. Every action in the app mirrors something that
already happened on the table — it never randomizes or decides anything on the player's behalf.

Core features, in the order they were built:

1. **Deck import** — paste a Moxfield/Archidekt exported decklist, or try fetching directly from
   a deck URL (best-effort; many sites block cross-origin browser requests, so paste is the
   reliable path — see `src/lib/deckImport.js`).
2. **Game tracking** — turn/phase ledger, life totals for up to 4 opponents, hand/battlefield/
   graveyard/exile/command zone tracking, commander cast-tax tracking.
3. **Manual, not randomized, card movement** — see "Key design decisions" below. This was a
   deliberate correction partway through the build.
4. **Full deck list with location lookup** — every card in the deck, searchable, tap to see
   exactly which zone(s) it's currently in and move it directly between zones.
5. **List/image view toggle** — card art via Scryfall, everywhere cards are browsed.
6. **AI play suggestions + post-game analysis** — calls the Anthropic API with the current board
   state (and a short summary of recent games with the same deck) for a concrete suggestion.
7. **Migrated from a Claude.ai artifact to this standalone Vite + React project** because the
   artifact sandbox's content-security-policy silently blocked Scryfall image loads, and because
   the artifact's `window.storage` and in-artifact Claude API bridge are sandbox-only stubs that
   don't exist in a real deployed app.

## Key design decisions (don't undo these without reason)

- **Cards are tracked by name + per-zone counts, not individual card instances.** Each entry in
  `game.cards` looks like `{ name, total, isCommander, zones: { library, hand, battlefield,
  graveyard, exile, commandZone } }`, where the zone counts always sum to `total`. This was a
  deliberate simplification over unique-instance tracking (each physical card doesn't need a
  distinct identity — a deck only cares "how many of X are in zone Y").
- **No randomization anywhere.** Opening hand is chosen by tapping cards out of the library list
  (`HandSetup.jsx`), and "Draw a card" opens a searchable picker so the player states which
  specific card they physically drew (`CardPicker.jsx`) — it does not pick one for them. This
  was a direct pivot from an earlier version that auto-shuffled and auto-dealt; the person using
  this app is playing a real physical game, so the app should only ever record what already
  happened, never generate outcomes.
- **Moving cards between zones in the deck list is one tap when unambiguous.** If a card exists
  in exactly one zone, tapping any other zone badge moves it there immediately. Only when a card
  is split across more than one zone (e.g. several basic lands, some in hand and some in library)
  does it require tap-source-then-tap-destination. See `handleBadgeClick` in
  `DeckListPanel.jsx`.
- **Card art comes from Scryfall's public "named card, format=image" endpoint**, used directly as
  an `<img src>` — see `src/lib/scryfall.js`. No API key needed, no JS fetch/CORS involved (it's
  just an image load), with a graceful text fallback on 404/mismatch (`CardThumb.jsx`).
- **AI calls use the person's own Anthropic API key**, entered in the Settings tab and stored in
  `localStorage`, sent directly from the browser to `api.anthropic.com` with the
  `anthropic-dangerous-direct-browser-access` header. This is explicitly flagged in both the
  Settings UI and the README as fine for personal/local use but unsafe to expose in any public
  deployment — a real deployment should proxy this through a server that holds the key instead.
- **All persistence currently goes through `src/lib/storage.js`**, a thin async wrapper around
  `localStorage`. It's written with a stable `sGet/sSet/sDelete/sList` interface specifically so
  it can be swapped for a real backend later without touching component code.

## Architecture map

```
src/
  main.jsx              — React root
  App.jsx                — top-level tab state (Decks / Play / History / Settings), owns
                            activeGame and orchestrates saving completed games + triggering
                            post-game AI analysis
  styles.css              — all design tokens/CSS (dark theme, gold accent, "Big Shoulders
                            Display" for numerals/headers, "Inter" for body text; the turn
                            ledger on the left of the game board is the signature visual —
                            phases of the current turn shown as a vertical stepper with log
                            entries nested under the phase they happened in)
  lib/
    storage.js           — persistence (localStorage-backed today)
    scryfall.js          — card image URL helper
    claudeApi.js          — Anthropic API call helper (needs a key from Settings)
    deckImport.js         — decklist text parsing + Moxfield/Archidekt URL fetch attempts
    constants.js          — PHASES, ZONE_KEYS/ZONE_LABEL, moveLabel() (auto-generated log text
                            per zone transition), makeActiveGame() (game state constructor)
  components/
    DeckImporter.jsx       — paste-or-URL import flow, commander marking
    DecksAndSetup.jsx      — DecksTab (saved deck list) + GameSetup (deck/opponent picker)
    HandSetup.jsx           — the post-"Load deck", pre-"Begin game" opening hand selection step
    CardPicker.jsx          — searchable card picker used by HandSetup and "Draw a card"
    CardThumb.jsx           — ViewToggle + CardThumb (art tile w/ fallback), shared everywhere
    DeckListPanel.jsx       — full deck list with search, "Full list" vs "Still in library"
                            toggle, list/image view, tap-to-move zone badges
    GameBoard.jsx           — the main active-game screen: turn ledger, life totals, library/
                            command zone, hand/battlefield/graveyard/exile, AI suggestion panel
    EndGameAndHistory.jsx   — EndGameModal (win/loss/draw) + HistoryTab (past games, AI analysis)
    SettingsTab.jsx          — Anthropic API key + model override, stored locally
```

## Known limitations / things not yet done

- No multi-device sync (localStorage is per-browser).
- No commander damage tracking (only generic life totals per opponent).
- Scryfall art isn't cached — repeat games re-fetch the same images (browser HTTP cache softens
  this, but there's no app-level cache).
- Moxfield/Archidekt direct URL import is best-effort; CORS blocks it more often than not from a
  `localhost` origin. It may behave better once deployed to a real domain, but that's untested.
- Not a PWA yet — no offline support, no "add to home screen" manifest, which would matter for
  actually using this at a physical table without reliable wifi.
- No automated tests.

## Ideas discussed for extending this (not started)

- IndexedDB or a real backend behind `storage.js` for multi-device sync.
- Per-opponent commander damage counters.
- PWA manifest + service worker for offline use at the table.
- Local cache of name→image-URL lookups.
- A small serverless proxy for the Anthropic API key if this is ever deployed publicly.

## Working conventions

- The build was verified with `npm install && npm run build` (Vite) before being handed off —
  keep doing that after nontrivial changes rather than assuming JSX is correct from a read-through.
- Component files are kept single-purpose and fairly small on purpose; prefer adding a new file
  in `src/components/` or `src/lib/` over growing an existing one significantly.
