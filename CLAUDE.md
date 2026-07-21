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
poe-helper/
├── packages/shared/src/
│   ├── types/          # Item, Character, Currency, Map, Session, Settings, Speedrun, AI
│   ├── parsers/        # item-parser.ts (clipboard), client-log.ts (Client.txt)
│   ├── api/            # poe-ninja.ts, ggg-trade.ts, rate-limiter.ts
│   ├── data/           # dangerous-mods, stat-mappings, map-data, hideout-names,
│   │                   # leveling-guide, mod-tiers
│   └── utils/          # format.ts, constants.ts
├── apps/overlay/
│   ├── src-tauri/
│   │   ├── .cargo/config.toml   # target-dir = "E:\\rust-target" (avoids C: disk space issues)
│   │   ├── capabilities/        # Tauri v2 permissions (MUST include core:event:allow-listen)
│   │   └── src/                 # ai.rs, clipboard.rs, log_watcher.rs, oauth.rs, settings.rs, lib.rs
│   └── src/
│       ├── hooks/       # useClipboard, useClientLog, usePriceCheck, useMapSpeedrun,
│       │                # useAiAnalysis, useTradeWhispers, useLevelingTracker
│       ├── components/  # PriceCheck, ZoneTracker, GggAccount, AskAi, MarketTab,
│       │                # LevelingGuide, MapTimer, Settings, WitchSays,
│       │                # AiPriceInsight, TradeAssistant, SpeedrunStats
│       ├── stores/      # overlay-store, settings-store, speedrun-store, ai-store,
│       │                # build-store, gear-capture-store
│       ├── utils/       # store.ts (shared tauri-plugin-store access)
│       └── assets/      # classes/, menu/, poe1/poe2 logos, wallpaper
└── run.bat              # Launch script
ggg-developer-application.txt   # Draft GGG OAuth dev-app submission (pending)
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
Rust debug builds consume ~6-7GB. Build target is on **E: drive** via `src-tauri/.cargo/config.toml`:
```toml
[build]
target-dir = "E:\\rust-target"
```
If C: runs out of space, `cargo clean` only helps if target is still on C:. Check config.toml first.

### Rust Rebuilds During Dev
Tauri's file watcher triggers Rust rebuilds when `src-tauri/` files change. If it double-rebuilds and runs out of space, kill the process and restart manually. Only the overlay crate recompiles (~8-20s), not all 500+ deps.

## Architecture

### Clipboard → Price Check
```
Ctrl+C in PoE → Win32 clipboard API (polls 200ms)
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
  → parse_log_line(line, game): zone/death/whisper/level_up/connected/area_level
  → Tauri "log-event" event (LogEventEnvelope adds `game`) → useClientLog hook
  → Startup: scans last 64KB for char name, char level, zone, area level
  → Stores in Tauri managed state (GameState) → get_initial_game_state IPC
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

### PoE2 Characters — no public API, so two workarounds
```
GGG's public character API returns ONLY PoE1 chars (realm=poe2 is ignored;
api.pathofexile.com needs OAuth). Until OAuth lands (app draft pending), PoE2
characters come from:
  1. Character history mining — scan_character_history (log_watcher.rs) reads
     ENTIRE Client.txt files (PoE1+PoE2, all drives), aggregates name/class/
     max-level/deaths/last-seen per character. Frontend caches result module-
     level (detectedCharsCache); "↻ history" forces re-scan. Surfaced ONLY in
     the PoE2 section (PoE1 stays GGG-API-only).
  2. Gear Capture — useGearCaptureStore + BuildCapturePanel. User clicks
     "Capture gear", Ctrl+Cs each equipped item; clipboard items route to slots
     (slotForItem), game forced to the session's game. Save → setActiveBuild
     with structured gear (BuildItem[], same shape as GGG fetch) so ItemCard
     renders it + AI build review works identically to PoE1.
Live Session tile (GggAccount) ties it together: shows the live Client.txt
character with manual class entry (persisted live_char_classes), Capture gear,
Analyze build, build-goal editor, and a gear viewer.
```

### Characters + AI Build Analysis
```
GGG public API → fetch_characters (PoE1 + PoE2, deduped by name)
  → fetch_character_items → gear with sockets/links
  → Analyze Build → ai.rs (Sonnet, 4096 tokens, Witch persona)
  → parseAiJson handles malformed JSON (code fences, truncation, trailing commas)
```

### Navigation
```
Home: ZoneTracker header + menu grid (7 pages)
  Market | Leveling | Maps | Ask AI | Characters
Esc → back to home
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
- **PoE2 character workarounds**: GGG exposes no public PoE2 character API, so we mine Client.txt history + capture gear via clipboard. These are deliberate stopgaps until OAuth — see the PoE2 architecture section.
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

## PoE-Specific

- **Client.txt paths**: PoE1 `...\Path of Exile\logs\Client.txt`, PoE2 `...\Path of Exile 2\logs\Client.txt`. Both scanned for character history; the most-recently-modified one is watched live.
- **Auto-detect**: Checks C:\, D:\, E:\, F:\ SteamLibrary paths + GGG standalone, picks newest mtime
- **Current league**: Mirage (hardcoded PoE1 league in DEFAULT_SETTINGS + usePriceCheck fallback). NOTE: still PoE1-only — per-game league default is an open gap.
- **User's account**: yurikoeth#5030. PoE1: witchtimee (Elementalist). PoE2: xYuriko (Witch, log-mined — not in GGG API).
- **Item text format**: Sections split by "--------", starts with "Item Class:" (PoE2) or "Rarity:" (PoE1)

## Not Yet Implemented

- **GGG OAuth2 integration** — APPROVED 2026-05-28 (email from GGG enabled `account:characters` and `account:profile`; `account:stashes` NOT enabled — stash scope is not yet available for PoE2). Implementation pending. Until built, the legacy `character-window/get-characters` and `get-items` calls have been disabled in `oauth.rs` per the GGG email warning that those endpoints are TOS breaches. PoE2 still uses log-mining + gear capture (see PoE2 architecture section).
- Per-game league default (DEFAULT_SETTINGS league is hardcoded PoE1 "Mirage")
- POE2_LEVELING data (LevelingGuide is PoE1-only)
- MapTimer — not yet game-aware audited for PoE2
- AtlasHelper — removed 2026-05-28; rebuild plan in `oauth-migration-affected-features.txt` (scoped: curated library + pick-and-track + clipboard integration + profit tracking)
- Tauri Windows packaging/installer (.msi/.exe)
- Snipe alerts (background trade polling)
- GGG Trade API for rare pricing (currently mod-tier estimation only)
