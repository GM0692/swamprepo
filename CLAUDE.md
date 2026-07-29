# CLAUDE.md — Project context for SwampTap

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
9. **Commander damage + custom counters** — per-opponent commander-damage slots (editable label,
   since SwampTap has no visibility into opponents' real decks; warns at 21) and per-player
   poison/energy/free-form counters (poison warns at 10), for both solo and synced games. See
   `game.trackers` in `src/lib/constants.js`, `src/components/Trackers.jsx` (shared UI),
   `src/components/MyTrackers.jsx` (synced-mode self-editable counterpart).
10. **Personal stats dashboard + export** — win rate (overall/per-deck), average turns, and a
    recent-games trend strip, computed entirely from local game history (no new persistence);
    CSV/JSON export of your saved games. See `src/lib/stats.js`, `src/components/StatsPanel.jsx`,
    reachable via a Games/Stats toggle on the History tab.
11. **Shared table view + chess-clock timer** — a big-screen read-only display of every player's
    life/status for a central device (`TableView.jsx`), and an optional chess-clock mode
    (`ChessClockPanel.jsx`) as an alternative to the default stopwatch, with a per-player time
    budget the host sets when starting a session.
12. **Pod / ELO leaderboard** — a persistent "Pod" (own long-lived join code, distinct from the
    ephemeral per-game session room code) that a group creates once and reuses across many games;
    member ELO/win-rate accumulates over time. See `src/lib/podSync.js`, `src/lib/elo.js`,
    `src/components/PodTab.jsx`. A hosted Group session can optionally link to a Pod to feed its
    result into the leaderboard.

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
  from other players in the room via `auth.uid`. This identity is **not durable** — clearing
  browser storage or switching devices makes a player a "new person" to Firebase, with no merge
  path for their Pod history. Accepted, not solved.
- **Commander damage is self-scoped, not a full N×N matrix**: `game.trackers.commanderDamage` only
  tracks damage *this seat has taken*, per opponent, per slot (2 slots for partner/background
  commanders) — because only your own incoming damage decides your own loss condition, and the app
  has always been a single-perspective tool. Counters (`game.trackers.counters`) are per-player
  (you + each opponent) since solo play already scorekeeps every seat from one device, same as
  `life`. In synced sessions, each player writes only their own `players/{uid}.commanderDamage` /
  `.counters`, and `GameBoard.jsx`'s existing life-mirroring effect also mirrors trackers back into
  local `game.trackers` so `finalTrackers` in saved history reflects synced state correctly.
- **Chess-clock time is only decremented at a turn transition, never per-second** — writing every
  second would blow through Firebase's write budget. Each device computes its own live *display*
  value client-side (current remaining minus elapsed-since-turn-started), mirroring exactly how the
  default stopwatch already computes its own elapsed-time display; only `clockRemainingMs` at the
  moment of "End turn" is actually written. There's deliberately no manual pause in chess-clock
  mode (a real chess clock only runs on your turn) — allowing one would need pause/resume
  accounting this design doesn't implement. Each device self-initializes its own
  `clockRemainingMs` (the host can't legally write another player's, same rule that protects
  `life`).
- **A "Pod" is a separate, persistent concept from a "Group session."** Session room codes are
  4 characters, ephemeral, and get reclaimed after 12h idle. A Pod has its own longer-lived code,
  is never reclaimed, and its member roster/ELO/win-rate accumulate across every game it's linked
  to, indefinitely — this is what makes a real leaderboard possible. A hosted session optionally
  links to a Pod and gets a fresh `gameInstanceId` (independent of the reusable room code, so a
  later unrelated game reusing that room code can't collide with a stale Pod result). See
  `src/lib/podSync.js` and the `pods/{podId}` rules block in `database.rules.json`.
- **Pod result submission is exactly-once by construction, not by trust.** Whoever clicks "Win" on
  a Pod-linked game broadcasts a shared `session.gameResult`; every subscribed device watches for
  it (host attempts immediately, others after a grace delay) and calls the same submission
  function — but what actually prevents double-counting is that `pods/{podId}/results/{id}`'s
  write rule is `auth != null && !data.exists()`, so RTDB's atomic rule evaluation lets exactly one
  racing attempt succeed regardless of timing. ELO/game-count fields use Firebase's `increment()`
  transform (not read-then-write) so they stay correct even off a stale local read. This does
  require relaxing `pods/{podId}/members/{uid}`'s write rule to allow *any current pod member* to
  update *any other* member's stats (since one submitter applies deltas for everyone) — a
  deliberate trust extension consistent with the app's existing no-accounts,
  small-trusted-group model, not a new category of risk.

## Architecture map

```
src/
  main.jsx              — React root
  App.jsx                — top-level tab state (Decks / Play / History / Group / Pod / Settings),
                            owns activeGame and orchestrates saving completed games + triggering
                            post-game AI analysis + broadcasting a pod-linked game's win
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
                            actions, chess-clock actions, gameResult broadcast, onDisconnect
                            handling, local "which seat am I" persistence. Exports getDb()/
                            requireAuth so podSync.js can reuse the same initialized app/auth.
    podSync.js              — Pod create/join/subscribe, ELO result submission (trySubmitPodResult
                            is the exactly-once entry point), local "which pod am I linked to"
                            persistence
    elo.js                  — computeEloUpdates(): pairwise Elo extended for free-for-all
    stats.js                — pure aggregation over local game-index (win rate, avg turns,
                            per-deck breakdown, recency trend) + CSV/JSON export helpers
  components/
    DeckImporter.jsx       — paste-or-URL import flow, commander marking
    DecksAndSetup.jsx      — DecksTab (saved deck list) + GameSetup (deck/opponent picker; detects
                            an active group session and derives opponent count from its roster)
    HandSetup.jsx           — the post-"Load deck", pre-"Begin game" opening hand selection step
    CardPicker.jsx          — searchable card picker used by HandSetup and "Draw a card"
    CardThumb.jsx           — ViewToggle + CardThumb (art tile w/ fallback), shared everywhere
    DeckListPanel.jsx       — full deck list with search, "Full list" vs "Still in library"
                            toggle, list/image view, tap-to-move zone badges
    GameBoard.jsx           — the main active-game screen: turn ledger, life totals, trackers
                            (commander damage/counters), library/command zone,
                            hand/battlefield/graveyard/exile, AI suggestion panel; renders
                            SyncedLifePanel/MyLifeControl/MyCommanderDamageControl/
                            MyCounterControl/TurnTimerPanel instead of local trackers when
                            game.sessionId is set, and mirrors synced state back into local
                            game.life/game.trackers so saved history is accurate; also watches
                            for a pod-linked game's shared gameResult and submits it to the pod
    EndGameAndHistory.jsx   — EndGameModal (win/loss/draw) + HistoryTab (Games/Stats toggle: past
                            games with AI analysis + final trackers, or the StatsPanel dashboard)
    SettingsTab.jsx          — Anthropic API key + model override, Firebase config, all local
    GroupSession.jsx         — the "Group" tab: host/join a session by room code (optionally
                            linked to a Pod, and choosing stopwatch vs. chess-clock timer mode),
                            lobby roster + reorder, then SyncedLifePanel/TurnTimerPanel plus a
                            Table view toggle
    PodTab.jsx               — the "Pod" tab: create/join a persistent pod by its own code,
                            member roster sorted as a leaderboard (elo/games/W-L-D)
    SyncedLifePanel.jsx      — shared-session life totals (your row editable, others real-name
                            read-only, with a poison badge), used by both GroupSession and
                            GameBoard
    TurnTimerPanel.jsx       — shared-session turn/timer display + Start/Stop/End-turn-and-pass
                            controls (only shown to the active player); branches to
                            ChessClockPanel when session.timerMode is 'chessclock'
    ChessClockPanel.jsx      — per-player countdown variant of TurnTimerPanel, no manual pause
    MyLifeControl.jsx        — synced-mode big tap-zone life control for your own row
    MyTrackers.jsx           — synced-mode self-editable commander-damage/counter controls,
                            counterpart to MyLifeControl
    Trackers.jsx             — shared tracker UI primitives (TrackerChip, CommanderDamageRow,
                            PlayerCounters), used by GameBoard (solo + read-only history view),
                            MyTrackers, and TableView
    TableView.jsx            — read-only big-screen display of every player's life/status for a
                            shared/central device, purely reads existing session state
    StatsPanel.jsx           — win rate / avg turns / per-deck breakdown / recency strip +
                            CSV/JSON export, rendered inside HistoryTab's Stats view
```

## Known limitations / things not yet done

- No deck/hand/battlefield sync — only life totals, turn order, trackers, and the turn timer are
  shared via a group session; each player's own card tracking is still local-only (localStorage is
  per-browser).
- Group sessions have no real cleanup job (no server-side cron is possible on a static site) —
  abandoned rooms just sit in Firebase until a room-code collision reclaims them after 12h, or the
  user manually clears `/sessions` in the Firebase console. Pods are never reclaimed at all (by
  design — they're meant to persist), so an abandoned pod just sits there indefinitely too.
- Moxfield/Archidekt direct URL import is best-effort; CORS blocks it more often than not from a
  `localhost` origin. It may behave better once deployed to a real domain, but that's untested.
- Not a PWA yet — no offline support, no "add to home screen" manifest, which would matter for
  actually using this at a physical table without reliable wifi.
- No automated tests.
- Pod ELO/leaderboard identity rides entirely on Anonymous Auth UID, which isn't durable across
  cleared browser storage or a new device — no accounts, no merge path if that happens.
- The Firebase-dependent half of the commander-damage/counters/stats/table-view/chess-clock/pod
  rollout (everything except solo-mode trackers and the stats dashboard) hasn't been verified
  end-to-end on real multi-device Firebase yet as of 2026-07-29 — see `SESSION_MEMORY.md`.

## Ideas discussed for extending this (not started)

- Syncing deck/hand/battlefield state too (currently only life/turn/timer/trackers sync); would
  need a much bigger rethink since card tracking assumes a single local perspective today.
- True push notifications for "it's your turn" (needs a PWA + service worker + push infra —
  today's turn alert is an in-tab screen flash + vibration, only works while the tab is open).
- PWA manifest + service worker for offline use at the table.
- A small serverless proxy for the Anthropic API key if this is ever deployed publicly.
- Power-level estimation per deck (heuristic off decklist contents — avg CMC, fast mana, tutors).
- Turn-order win-rate analysis, once enough Pod result history accumulates to make it meaningful.

## Working conventions

- The build was verified with `npm install && npm run build` (Vite) before being handed off —
  keep doing that after nontrivial changes rather than assuming JSX is correct from a read-through.
- Component files are kept single-purpose and fairly small on purpose; prefer adding a new file
  in `src/components/` or `src/lib/` over growing an existing one significantly.
