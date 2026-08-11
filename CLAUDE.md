# ExiledOrb

All-in-one Path of Exile companion — desktop overlay for PoE1 & PoE2.

## Tech Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **Overlay**: Tauri v2 (Rust backend + React 19 frontend)
- **Shared**: TypeScript library — item/log parsers, API clients, types, game data
- **State**: Zustand — one store per feature domain
- **Styling**: Tailwind CSS v4
- **DB**: SQLite via tauri-plugin-sql (local)
- **AI**: Claude API via Rust reqwest + rustls-tls. User's own key in tauri-plugin-store. All responses in PoE1 Witch persona.
- **Testing**: Vitest

## Project Layout

```
exiled-orb/
├── packages/shared/src/
│   ├── types/          # Item, Character, Currency, Map, Session, Settings, Speedrun, AI
│   ├── parsers/        # item-parser.ts (clipboard), client-log.ts (Client.txt)
│   ├── api/            # poe-ninja.ts, ggg-trade.ts, rate-limiter.ts
│   ├── data/           # dangerous-mods, stat-mappings, map-data, hideout-names,
│   │                   # leveling-guide, mod-tiers, seasons (league dates — manual config)
│   └── utils/          # format.ts, constants.ts
├── apps/overlay/
│   ├── src-tauri/
│   │   ├── .cargo/config.toml   # OPTIONAL, untracked — local target-dir override for disk space
│   │   ├── capabilities/        # Tauri v2 permissions (MUST include core:event:allow-listen)
│   │   └── src/                 # ai.rs, clipboard.rs, log_watcher.rs, ninja.rs (poe.ninja proxy),
│   │                            # oauth.rs (GGG API), oauth_flow.rs (PKCE flow), settings.rs, lib.rs
│   └── src/
│       ├── hooks/       # useClipboard, useClientLog, usePriceCheck, useMapSpeedrun,
│       │                # useAiAnalysis, useTradeWhispers, useLevelingTracker
│       ├── components/  # ui.tsx (Panel/Btn/SectionTitle primitives), PriceCheck,
│       │                # ZoneTracker, AskAi, MarketTab, LevelingGuide, MapTimer,
│       │                # WitchSays, AiPriceInsight, TradeAssistant, SpeedrunStats,
│       │                # SettingsTab (game/league/log-path/AI settings + onboarding)
│       │   └── characters/  # GggAccount (orchestrator), GggCharacterRow, LiveSessionTile,
│       │                    # BuildCapturePanel, DetectedCharacterTile, ItemCard,
│       │                    # BuildGoalEditor, BuildAnalysisCard, ApiKeyInline,
│       │                    # build-actions.ts, character-history.ts, constants.ts
│       ├── stores/      # overlay-store, settings-store, speedrun-store, ai-store,
│       │                # build-store, gear-capture-store
│       ├── utils/       # store.ts (getStore/persistToStore/getApiKey), slots.ts
│       │                # (slot order/labels — single source), parseAiJson.ts
│       └── assets/      # classes/, menu/, poe1/poe2 logos, wallpaper
├── docs/                # ARCHITECTURE.md (public architecture documentation)
└── run.bat              # Launch script
```

## Commands

```bash
pnpm install                     # Install all deps
pnpm run dev:overlay             # Start overlay (Tauri dev)
pnpm run build                   # Build all packages
pnpm run test                    # Run all tests
pnpm run typecheck               # TS check all packages

# From apps/overlay/:
pnpm tauri dev                   # Dev overlay with hot reload
pnpm tauri build                 # Production .msi/.exe

# Shared package tsbuildinfo cache issue:
#   rm -f packages/shared/tsconfig.tsbuildinfo && pnpm run --filter @exiled-orb/shared build

# Launch: Double-click run.bat or Desktop/ExiledOrb.bat
```

## Critical: Things That Break and How to Fix Them

### Tauri v2 Permissions (capabilities/default.json)
**Every** frontend `listen()` and `emit()` call requires `core:event:allow-listen` and `core:event:allow-emit` in the capabilities file. Without these, clipboard detection and log events silently fail with NO error. If events stop working, check capabilities first.

### Clipboard (Win32 API, not arboard)
Clipboard uses **direct Win32 API** calls (`OpenClipboard`/`GetClipboardData`/`CloseClipboard`) in `clipboard.rs`. The `arboard` crate was removed because it fails on every read when PoE or other apps hold the clipboard. Do NOT switch back to arboard.

### Rust HTTP (reqwest + rustls-tls)
reqwest uses `rustls-tls` (NOT native-tls). Native TLS on Windows fails to connect to api.anthropic.com. The Cargo.toml must have:
```toml
reqwest = { version = "0.12", default-features = false, features = ["json", "rustls-tls"] }
```

### Disk Space
Rust debug builds consume ~6-7GB. An **untracked, optional** `src-tauri/.cargo/config.toml`
can redirect the build target to another drive:
```toml
[build]
target-dir = "E:\\rust-target"
```
If the system drive runs out of space, check whether such an override exists before
assuming `cargo clean` in the repo will help.

### Sync Tauri Commands Block the Main Thread
A `#[tauri::command]` WITHOUT `async` runs on the main thread — heavy work in
one freezes the entire UI. `scan_character_history` did exactly this (whole-
file log scan → window froze). Any command doing file IO / network / heavy CPU
must be `async` (+ `tauri::async_runtime::spawn_blocking` for blocking work).

### poe.ninja Responses Are Cached
`utils/ninja-cache.ts` caches raw responses 5 min per URL (a category is
megabytes of JSON). ALL ninja fetches must go through `fetchNinjaCached` —
calling `invoke("fetch_ninja")` directly reintroduces multi-second Ctrl+C
price checks. `clearNinjaCache()` exists for league/settings changes.

### Dev Build Optimization
Cargo.toml sets `[profile.dev] opt-level = 1` + deps at opt 3 (one-time ~7 min
rebuild, cached in E:ust-target). Without this, log scanning/parsing runs
10-50x slower in dev. Incremental rebuilds are ~30s (was ~10s at opt 0).

### Rust Rebuilds During Dev
Tauri's file watcher triggers Rust rebuilds when `src-tauri/` files change. If it double-rebuilds and runs out of space, kill the process and restart manually. Only the overlay crate recompiles (~8-20s), not all 500+ deps.

## Architecture

### Clipboard → Price Check
```
Ctrl+C in PoE → Win32 clipboard API (polls 500ms)
  → detects "Item Class:" or "Rarity:" + "--------"
  → Tauri "clipboard-item" event → useClipboard hook
  → item-parser.ts → ParsedItem
  → usePriceCheck: poe.ninja lookup via fetch_ninja Rust proxy
  → For rares: mod-tiers.ts evaluates mods (T1-T5, roll %, combos)
  → PriceCheck.tsx renders tier bars, price, verdict
  → [if AI key set] useAiAnalysis → ai.rs → Claude (Witch persona)
```

### Client.txt → Zone/Death Tracking
```
PoE writes Client.txt → log_watcher.rs (polls 1s, tail-only)
  → parse_log_line(line, game): zone/death/whisper/level_up/connected/
    area_level/other_player ("has joined/left the area" = another player)
  → Tauri "log-event" event (LogEventEnvelope adds `game`) → useClientLog hook
  → Startup (BackwardScan): quick 64KB tail scan (sync), then the watcher
    thread continues scanning the file BACKWARD in 256KB chunks until the
    char's most recent level-up is found (handles max-level chars whose last
    level-up is months back) + a 1MB confirmation window. Candidates are
    demoted if an older join/left line names them (they were a party member).
    Deep-scan result → "initial-state-updated" event → frontend re-syncs.
  → Live loop keeps an `others` exclusion set: party members' deaths and
    level-ups are dropped, so they can't hijack the displayed character or
    inflate the death counter.
  → Stores in Tauri managed state (GameState) → get_initial_game_state IPC
  → PoE2 level-up lines carry the class → auto-populates characterClass
ZoneTracker shows charName + Lv.{charLevel} + class; zone row shows
"Area {N}" (monster level) — do not conflate the two levels.
```

### Active-Game Detection (PoE1 + PoE2)
```
Auto-detect picks the Client.txt with the MOST RECENT mtime across all
candidate paths (lib.rs) — so the actively-played game wins when both are
installed. Game derived from path ("Path of Exile 2" → poe2).
Zone parsing differs by game:
  - PoE1: "You have entered X."
  - PoE2: "[SCENE] Set Source [X]" (filters (null)/(unknown)/Act N sentinels)
Level-up strips the PoE2 "(Class)" suffix: "Name (Witch) is now level N" → "Name".
log-event envelope carries `game` so the frontend re-syncs detectedGame live.
```

### GGG OAuth2 (implemented)
```
oauth_flow.rs: PKCE flow against pathofexile.com
  Connect → bind localhost:11343 FIRST → open browser to /oauth/authorize
  → callback validates state → POST /oauth/token → tokens persisted to
  ggg_tokens.json in the Tauri app-data dir. get_access_token() transparently
  refreshes within 60s of expiry. Scopes: account:characters account:profile
  (client_id "exiledorb"; account:stashes NOT granted).
oauth.rs: documented api.pathofexile.com endpoints (Bearer auth)
  fetch_characters  → GET /character + /character/poe2 (parallel, deduped by
                      name keeping higher level)
  fetch_character_items → GET /character[/poe2]/<name> → equipment → GggItem
The legacy character-window/* endpoints are a TOS breach (GGG email
2026-05-28) — never reintroduce them.
```

### PoE2 fallbacks without OAuth (still active when not connected)
```
  1. Character history mining — scan_character_history (log_watcher.rs) reads
     ENTIRE Client.txt files (PoE1+PoE2, all drives), aggregates name/class/
     max-level/deaths/last-seen per character. Frontend caches result module-
     level (characters/character-history.ts); "↻ history" forces re-scan.
     Surfaced ONLY in the PoE2 section.
  2. Gear Capture — useGearCaptureStore + BuildCapturePanel. User clicks
     "Capture gear", Ctrl+Cs each equipped item; clipboard items route to slots
     (slotForItem), game forced to the session's game. Save → saveActiveBuild
     with structured gear (BuildItem[], same shape as GGG fetch) so ItemCard
     renders it + AI build review works identically to PoE1.
Live Session tile ties it together: shows the live Client.txt character with
manual class entry (persisted live_char_classes), Capture gear, Analyze build,
build-goal editor, and a gear viewer.
```

### Characters + AI Build Analysis
```
fetch_characters (OAuth) → GggCharacterRow list (PoE1 + PoE2, deduped by name)
  → fetch_character_items → gear with sockets/links
  → Analyze Build → characters/build-actions.ts runBuildAnalysis
  → ai.rs analyze_build (Sonnet, 4096 tokens, Witch persona)
  → parseAiJson handles malformed JSON (code fences, truncation, trailing commas)
```

### Navigation
```
Home: ZoneTracker header + menu grid (6 pages)
  Market | Leveling | Maps | Ask AI | Characters | Settings
Esc → back to home. First launch (no settings row in SQLite) opens the
Settings page as onboarding; settings-store.firstRun carries the flag.
```

### Settings & league resolution
```
SettingsTab edits settings-store (SQLite-persisted AppSettings):
  default game | per-game league override | Client.txt source | AI toggles + key
League: settings.leagues[game] is an override (null = auto). ALL league
lookups go through resolveLeague(game, settings.leagues) (data/seasons.ts) —
never read a raw league string from settings.
Log path: Auto-detect invokes autodetect_log_path (most-recent-mtime pick);
custom invokes set_log_path (errors if missing). start_log_watcher bumps a
WATCHER_GEN AtomicU64 — superseded watcher threads exit at their next poll
tick, so restarting the watcher never double-emits events. On startup, App.tsx
re-applies a saved custom path after settings load (Rust auto-detects first).
ai.enabled gates AiPriceInsight; ai.enabled + ai.enableTradeAssistant gate
whisper analysis — both were unreachable before the Settings UI existed.
```

## Key Design Decisions

- **Win32 clipboard (not arboard)**: Direct API is reliable when games hold the clipboard open.
- **Client.txt polling (not notify)**: 1s poll — notify crate unreliable on non-C: drives.
- **poe.ninja via Rust proxy**: Avoids CORS. All ninja calls go through `fetch_ninja` command.
- **rustls-tls (not native-tls)**: Windows native TLS can't reach Claude API reliably.
- **Game-agnostic**: `game: 'poe1' | 'poe2'` throughout all types, parsers, APIs, data.
- **Witch AI Persona**: WITCH_PERSONA constant in ai.rs, injected into all Claude system prompts.
- **Mod Tier Evaluation**: Local mod-tiers.ts with T1-T5 ranges for 30+ mods. No API needed.
- **Build Store**: Per-character build profiles with goals + structured gear (BuildItem[]). Fed as context to all AI features (AskAi includes a [Gear Snapshot] block).
- **PoE2 fallbacks**: without OAuth connected we mine Client.txt history + capture gear via clipboard — see the PoE2 fallback architecture section.
- **Zustand selectors**: Read store fields via `useStore((s) => s.x)`, NOT `const {x} = useStore()` — the latter re-renders on every unrelated store write (matters for always-mounted components like ZoneTracker).
- **Timeouts**: 60s for Claude API, 10s for poe.ninja. Prevents hanging requests.

## Conventions

- TypeScript strict mode, package scope `@exiled-orb/*`
- Shared subpath exports: `@exiled-orb/shared/types`, `/parsers`, `/api`, `/data`
- Rust snake_case, Tauri auto-converts to camelCase for JS invoke params
- Rust return types (structs) serialize as snake_case — TS interfaces must match
- Prices in chaos orbs, divine conversion via live poe.ninja rate (getDivineRateCached)
- One Zustand store per domain (overlay, settings, speedrun, ai, build)
- AI: Haiku for fast, Sonnet for deep analysis. All wrapped in WitchSays component.
- Console logs prefixed with `[ExiledOrb]`, Rust stderr with `[ExiledOrb]`
- UI: build panels/buttons/headers from `components/ui.tsx` primitives (Panel,
  Btn, SectionTitle, COLORS, RARITY_COLORS) — do not re-declare inline style objects
- Persist small UI state via `persistToStore(key, value)` (utils/store.ts)
- Slot ids/order/labels come from `utils/slots.ts` — single source of truth
- Build save/analyze go through `characters/build-actions.ts` (saveActiveBuild,
  runBuildAnalysis) — do not hand-construct ActiveBuild objects

## PoE-Specific

- **Client.txt paths**: PoE1 `...\Path of Exile\logs\Client.txt`, PoE2 `...\Path of Exile 2\logs\Client.txt`. Both scanned for character history; the most-recently-modified one is watched live.
- **Auto-detect**: Checks C:\, D:\, E:\, F:\ SteamLibrary paths + GGG standalone, picks newest mtime
- **Current league**: resolved per game via `resolveLeague` — user override from settings, else `getCurrentLeague` from `data/seasons.ts` (PoE1 "Allflame", PoE2 "Runes of Aldur"). Update seasons.ts once per league launch.
- **Season dates**: `packages/shared/src/data/seasons.ts` — MANUAL config, update once per league. GGG APIs can't provide end dates (verified 2026-07-21: legacy /api/leagues ignores realm=poe2, omits challenge leagues, endAt always null; OAuth /league needs service:leagues + confidential client). Rendered by SeasonTimers (home tile) + a ZoneTracker line via getSeasonState/seasonLabel.
- **Item text format**: Sections split by "--------", starts with "Item Class:" (PoE2) or "Rarity:" (PoE1)

## Not Yet Implemented

- MapTimer — not yet game-aware audited for PoE2
- AtlasHelper — removed 2026-05-28; rebuild scoped in README roadmap (curated library + pick-and-track + clipboard integration + profit tracking); old implementation in git history pre-2026-05-28
- Tauri Windows packaging/installer (.msi/.exe)
- Snipe alerts (background trade polling)
- GGG Trade API for rare pricing (currently mod-tier estimation only)
- tauri-plugin-opener migration (oauth_flow.rs uses deprecated Shell::open — works, one warning)

## GGG API notes (OAuth2 — IMPLEMENTED 2026-07-21)

- Approved 2026-05-28: scopes `account:characters` + `account:profile`
  (`account:stashes` NOT enabled — stash scope not yet available for PoE2).
- The legacy `character-window/get-characters` / `get-items` endpoints are a
  TOS breach per the GGG email — never call them again.
