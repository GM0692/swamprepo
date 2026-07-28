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
8. **Multiplayer group sessions** — a "Group" tab where each player, on their own phone, can host
   or join a shared session by a 4-character room code and get live-synced life totals, turn
   order, and a turn timer across every device in the group, with a screen flash + vibrate when
   the turn passes to you. Backed by Firebase Realtime Database (the user's own free project,
   config pasted in Settings) since the app has no server of its own — see `src/lib/firebaseSync.js`
   and `database.rules.json`. Deliberately narrow in scope: only life/turn/timer state is synced;
   each player's own deck/hand/battlefield tracking stays local exactly as it always has.

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
- **Card art comes from Scryfall's public `/cards/collection` bulk endpoint**, batched (up to 75
  names per request) and cached in memory by `getCardImageUrl()` in `src/lib/scryfall.js`, then
  consumed by `CardThumb.jsx` as a resolved `<img src>`, with a text fallback while resolving or
  on no-match/error. No API key needed. This replaced firing one `/cards/named` request per card
  — doing that for a full deck view (dozens of cards mounting into image view at once) reliably
  tripped Scryfall's rate limit and left a chunk of thumbnails permanently broken.
- **AI calls use the person's own Anthropic API key**, entered in the Settings tab and stored in
  `localStorage`, sent directly from the browser to `api.anthropic.com` with the
  `anthropic-dangerous-direct-browser-access` header. This is explicitly flagged in both the
  Settings UI and the README as fine for personal/local use but unsafe to expose in any public
  deployment — a real deployment should proxy this through a server that holds the key instead.
- **All persistence currently goes through `src/lib/storage.js`**, a thin async wrapper around
  `localStorage`. It's written with a stable `sGet/sSet/sDelete/sList` interface specifically so
  it can be swapped for a real backend later without touching component code.
- **Firebase Realtime Database security rules grant write access per-field, not at the room root**
  (`database.rules.json`) — this is load-bearing, not a style choice. `set()`/`remove()` are only
  validated at their own exact target path (walking up ancestors for a cascading grant); they
  cannot "borrow" permission from a more specific rule on one of their children. A blanket
  `.write` rule at `sessions/{roomCode}` would silently defeat the per-player isolation (anyone in
  the room could overwrite anyone else's life/name), so shared fields are each their own rule and
  written via `update()` with fully-qualified paths instead of a single nested `set()` — see the
  comments in `createSession`/`leaveSession` in `src/lib/firebaseSync.js` for the specific
  PERMISSION_DENIED failure mode this avoids.
- **Player identity for sync uses silent Firebase Anonymous Auth**, not a real login — there's no
  account system, no visible sign-in UI. It exists purely so security rules can tell "you" apart
  from other players in the room via `auth.uid`.

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
    firebaseSync.js        — all Firebase Realtime Database logic: init (silent Anonymous Auth),
                            session create/join/start/leave, live subscription, life/timer/turn
                            actions, onDisconnect handling, local "which seat am I" persistence
  components/
    DeckImporter.jsx       — paste-or-URL import flow, commander marking
    DecksAndSetup.jsx      — DecksTab (saved deck list) + GameSetup (deck/opponent picker; detects
                            an active group session and derives opponent count from its roster)
    HandSetup.jsx           — the post-"Load deck", pre-"Begin game" opening hand selection step
    CardPicker.jsx          — searchable card picker used by HandSetup and "Draw a card"
    CardThumb.jsx           — ViewToggle + CardThumb (art tile w/ fallback), shared everywhere
    DeckListPanel.jsx       — full deck list with search, "Full list" vs "Still in library"
                            toggle, list/image view, tap-to-move zone badges
    GameBoard.jsx           — the main active-game screen: turn ledger, life totals, library/
                            command zone, hand/battlefield/graveyard/exile, AI suggestion panel;
                            renders SyncedLifePanel/TurnTimerPanel instead of local life totals
                            when game.sessionId is set
    EndGameAndHistory.jsx   — EndGameModal (win/loss/draw) + HistoryTab (past games, AI analysis)
    SettingsTab.jsx          — Anthropic API key + model override, Firebase config, all local
    GroupSession.jsx         — the "Group" tab: host/join a session by room code, lobby roster +
                            reorder, then the same SyncedLifePanel/TurnTimerPanel used standalone
    SyncedLifePanel.jsx      — shared-session life totals (your row editable, others real-name
                            read-only), used by both GroupSession and GameBoard
    TurnTimerPanel.jsx       — shared-session turn/timer display + Start/Stop/End-turn-and-pass
                            controls (only shown to the active player), used by both
```

## Known limitations / things not yet done

- No deck/hand/battlefield sync — only life totals, turn order, and the turn timer are shared via
  a group session; each player's own card tracking is still local-only (localStorage is per-browser).
- Group sessions have no real cleanup job (no server-side cron is possible on a static site) —
  abandoned rooms just sit in Firebase until a room-code collision reclaims them after 12h, or the
  user manually clears `/sessions` in the Firebase console.
- No commander damage tracking (only generic life totals per opponent).
- Moxfield/Archidekt direct URL import is best-effort; CORS blocks it more often than not from a
  `localhost` origin. It may behave better once deployed to a real domain, but that's untested.
- Not a PWA yet — no offline support, no "add to home screen" manifest, which would matter for
  actually using this at a physical table without reliable wifi.
- No automated tests.

## Ideas discussed for extending this (not started)

- Syncing deck/hand/battlefield state too (currently only life/turn/timer sync); would need a
  much bigger rethink since card tracking assumes a single local perspective today.
- True push notifications for "it's your turn" (needs a PWA + service worker + push infra —
  today's turn alert is an in-tab screen flash + vibration, only works while the tab is open).
- Per-opponent commander damage counters.
- PWA manifest + service worker for offline use at the table.
- A small serverless proxy for the Anthropic API key if this is ever deployed publicly.

## Working conventions

- The build was verified with `npm install && npm run build` (Vite) before being handed off —
  keep doing that after nontrivial changes rather than assuming JSX is correct from a read-through.
- Component files are kept single-purpose and fairly small on purpose; prefer adding a new file
  in `src/components/` or `src/lib/` over growing an existing one significantly.
