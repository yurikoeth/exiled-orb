# ExiledOrb

**All-in-one Path of Exile companion** -- desktop overlay + web dashboard for PoE1 and PoE2.

ExiledOrb is a transparent, always-on-top desktop overlay that monitors your clipboard and game log in real time to provide instant price checks, map tracking, AI-powered trade analysis, and more -- all without violating any game rules.

---

## Features

- **Price Check with Mod Tier Evaluation** -- Copy any item in-game and get an instant price overlay. Each mod is evaluated against a local T1-T5 tier database with roll quality bars, combo detection (triple res, life+res, speed+damage), and price estimation.

- **Map Speedrun Tracker** -- Automatically tracks your map runs via Client.txt zone events. Live timer, maps per hour, average clear time, fastest run, and PB split comparisons.

- **AI Trading Assistant (Witch Persona)** -- Claude API integration where all responses are delivered in-character as the PoE1 Witch. Analyzes trade whispers for suspicious pricing, suggests responses, evaluates builds, and answers any PoE question -- with image/vision support.

- **Character and Gear Viewer** -- Pulls your characters from the GGG public API (both PoE1 and PoE2 realms). View equipped gear with socket colors and links, set build goals, and run AI-powered build analysis.

- **Market Browser** -- Browse live poe.ninja prices across all item categories with search, 7-day trend indicators, and category filtering -- all proxied through Rust to avoid CORS issues.

- **Leveling Guide** -- Step-by-step guides for PoE1 (Acts 1-10) and PoE2 (Acts 1-6) with per-character checklists that auto-advance as you change zones.


---

## Screenshots

Screenshots coming soon.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop App | Tauri v2 (Rust backend + React 19 frontend) |
| Frontend | React 19, TypeScript, Tailwind CSS v4 |
| State Management | Zustand (dedicated stores per feature) |
| Local Database | SQLite via tauri-plugin-sql |
| AI | Claude API via Rust reqwest (user provides their own key) |
| Web Dashboard | React 19 + Vite (Vercel deployment) |
| Cloud Database | Supabase (web) |
| Monorepo | pnpm workspaces + Turborepo |
| Testing | Vitest |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/) (v8+)
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/) (Visual Studio Build Tools on Windows)

### Installation

```bash
git clone https://github.com/your-username/exiled-orb.git
cd exiled-orb
pnpm install
```

### Development

```bash
# Start the overlay (Tauri dev mode with hot reload)
pnpm run dev:overlay

# Or from the overlay directory
cd apps/overlay
pnpm tauri dev

# Start the web dashboard
pnpm run dev:web
```

### Build

```bash
# Build all packages
pnpm run build

# Production Windows build (.msi / .exe)
cd apps/overlay
pnpm tauri build
```

### Other Commands

```bash
pnpm run test          # Run all tests
pnpm run typecheck     # TypeScript check all packages
```

---

## How It Works

ExiledOrb uses the same safe, non-invasive techniques as other GGG-sanctioned community tools:

- **Clipboard monitoring** -- A Rust background thread uses the Win32 clipboard API to poll every 200ms. When it detects PoE item text (identified by "Item Class:" or "Rarity:" headers), it parses the item and triggers a price lookup. No hotkey interception or memory reading.

- **Client.txt polling** -- A Rust background thread polls the game's Client.txt log file every 500ms, reading only new lines appended since the last check. This detects zone changes, deaths, trade whispers, level-ups, and more. On startup, it scans the last 64KB to recover current state.

- **poe.ninja via Rust proxy** -- All price data comes from poe.ninja, fetched through a Rust-side HTTP proxy to avoid browser CORS restrictions. Prices are cached with a 5-minute TTL.

- **AI through Rust** -- Claude API calls are made from the Rust backend using the user's own Claude API key. The key is stored locally in tauri-plugin-store and never exposed to the frontend. All AI responses are delivered in-character as the Witch from PoE1.

### Rust Build Target Directory

Rust debug builds can consume 6-7 GB of disk space. If your system drive is limited, you can redirect the build target to another drive by creating `apps/overlay/src-tauri/.cargo/config.toml`:

```toml
[build]
target-dir = "E:\\rust-target"
```

Run `cargo clean` inside `src-tauri/` periodically to reclaim space from stale builds.

---

## PoE1 and PoE2 Support

ExiledOrb is fully game-agnostic. All types, parsers, APIs, and data are parameterized by `game: 'poe1' | 'poe2'`. The game is auto-detected from the Client.txt file path. Both PoE1 and PoE2 characters, items, maps, and league data are supported.

---

## Project Structure

```
exiled-orb/
  packages/shared/       Shared TypeScript library (parsers, API clients, game data, types)
  apps/overlay/          Tauri v2 desktop overlay (Rust + React)
  apps/web/              Web dashboard (React + Vite)
```

---

## License

MIT
