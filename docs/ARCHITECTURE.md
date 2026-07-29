# ExiledOrb Architecture

ExiledOrb is a Tauri v2 desktop companion for Path of Exile 1 & 2. The Rust
backend owns everything that touches the OS or the network (clipboard, log
files, HTTP, SQLite, OAuth); the React frontend is a thin presentation layer
fed by Tauri events and commands.

## Monorepo Layout

```
exiled-orb/
├── packages/shared/src/      # Game-agnostic TypeScript library
│   ├── types/                # Item, Character, Currency, Map, Session, Settings, Speedrun, AI
│   ├── parsers/              # item-parser.ts (clipboard text), client-log.ts (Client.txt lines)
│   ├── api/                  # poe-ninja.ts, ggg-trade.ts, rate-limiter.ts (see "Parked" below)
│   ├── data/                 # dangerous-mods, mod-tiers, stat-mappings, leveling-guide, seasons
│   └── utils/                # formatting, constants
└── apps/overlay/
    ├── src-tauri/src/        # Rust: clipboard.rs, log_watcher.rs, ninja.rs, oauth.rs,
    │                         #       oauth_flow.rs, ai.rs, settings.rs, lib.rs
    └── src/                  # React: hooks/, components/, stores/ (Zustand), utils/
```

Everything in `packages/shared` is parameterized by `game: 'poe1' | 'poe2'` —
types, parsers, API URL builders, and data tables all take the game as input,
so both games share one code path.

## Data-Flow Pipelines

### Clipboard → Price Check

```
Ctrl+C in game
  → Rust thread polls the Win32 clipboard API every 500ms (clipboard.rs)
  → detects PoE item text ("Item Class:" / "Rarity:" + "--------" sections)
  → emits a "clipboard-item" Tauri event
  → item-parser.ts turns the raw text into a structured ParsedItem
  → usePriceCheck looks the item up on poe.ninja (via the Rust proxy)
  → for rares: mod-tiers.ts evaluates each mod locally (T1–T5, roll %, combos)
  → PriceCheck.tsx renders tier bars, price, verdict
  → optionally: ai.rs asks Claude for a second opinion (user-supplied API key)
```

### Client.txt → Zone / Death / Whisper Tracking

```
Game writes Client.txt
  → Rust thread polls the file every 1s, reading only newly appended bytes
  → parse_log_line() classifies each line: zone change, death, trade whisper,
    level-up, login, area level (formats differ between PoE1 and PoE2)
  → "log-event" Tauri event (envelope carries which game produced it)
  → useClientLog dispatches to the zone tracker, map speedrun timer,
    death counter, and trade-whisper assistant
```

On startup the watcher scans the last 64 KB of the log to recover the current
character, zone, and area level without waiting for a new event.

### Active-Game Detection

Both games can be installed at once. The watcher collects every candidate
`Client.txt` path (Steam libraries across drives + standalone installs) and
tails the one with the **most recent mtime** — the actively played game wins.
The game is derived from the path and re-synced live via the event envelope.

### GGG OAuth2 (PKCE)

```
oauth_flow.rs — authorization-code flow with PKCE against pathofexile.com:
  Connect → bind a loopback listener on localhost:11343 FIRST
          → then open the browser to /oauth/authorize (S256 challenge + CSRF state)
  callback → validate state → POST /oauth/token → persist tokens (app-data dir)
  get_access_token() transparently refreshes within 60s of expiry
oauth.rs — Bearer-authenticated calls to api.pathofexile.com:
  fetch_characters       → GET /character + /character/poe2 in parallel,
                           deduplicated by name keeping the higher level
  fetch_character_items  → GET /character[/poe2]/<name> → equipped gear
```

Scopes are limited to `account:characters account:profile`. Only the official
OAuth API is used — the legacy `character-window/*` endpoints are a ToS breach
and are deliberately absent.

### PoE2 Fallbacks (no OAuth required)

1. **Character history mining** — a full scan of every Client.txt aggregates
   name / class / max level / deaths / last-seen per character.
2. **Gear capture** — the user Ctrl+C's each equipped item; clipboard items are
   routed to equipment slots and saved as a structured build, so the gear
   viewer and AI build analysis work identically to OAuth-fetched characters.

### AI (Claude API)

All Claude calls go through `ai.rs` (Rust `reqwest`), authenticated with the
user's own API key held in `tauri-plugin-store` — the key never leaves the
machine except to Anthropic. Fast lookups use Haiku, deep build analysis uses
Sonnet. Every response is delivered in-character as the PoE1 Witch.
`parseAiJson.ts` defensively parses model output (code fences, truncation,
trailing commas).

## Key Design Decisions

- **Win32 clipboard, not `arboard`** — direct `OpenClipboard`/`GetClipboardData`
  calls keep working when the game holds the clipboard open; `arboard` fails
  every read in that situation.
- **Log polling, not filesystem notifications** — a 1s tail poll is reliable
  on every drive; the `notify` crate is not, on secondary drives.
- **poe.ninja through a Rust proxy** — the webview cannot make cross-origin
  requests, so `fetch_ninja` proxies them. Responses are cached in the
  frontend for 5 minutes per URL (`ninja-cache.ts`) — a category payload is
  megabytes of JSON, so every ninja call must go through `fetchNinjaCached`.
- **`rustls-tls`, not native TLS** — Windows native TLS intermittently fails
  against api.anthropic.com.
- **Sync Tauri commands block the UI thread** — any command doing file I/O,
  network, or heavy CPU is `async` (with `spawn_blocking` where needed).
- **One Zustand store per feature domain**, read via selectors
  (`useStore((s) => s.x)`) so always-mounted components don't re-render on
  unrelated writes.
- **Local mod-tier database** — rare-item mod quality (T1–T5 ranges for 30+
  mods) is evaluated offline; no API round-trip for the common case.
- **Season/league dates are manual config** (`data/seasons.ts`) — verified
  that no GGG API reliably provides league end dates, so they're updated once
  per league.

## Parked / Work-in-Progress

Present in the codebase but intentionally not wired into the UI yet:

- **`packages/shared/src/api/ggg-trade.ts`** — a client for the official trade
  API (POST search → GET fetch) for pricing rares against live listings.
  Parked pending a Rust proxy route and trade-API scope decisions; rare
  pricing currently uses the local mod-tier estimator instead.
- **`packages/shared/src/api/rate-limiter.ts`** — sliding-window limiter used
  by the trade client above (unit-tested, parked with it).
- **Tauri commands `set_log_path` / `analyze_market_trends`** — registered and
  functional but not yet surfaced in the UI (manual log-path override and
  AI market summaries).

## Optional Local Overrides

Rust debug builds are large (~6–7 GB). To redirect the build output to another
drive, create an untracked `apps/overlay/src-tauri/.cargo/config.toml`:

```toml
[build]
target-dir = "D:\\rust-target"
```
