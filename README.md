# ExiledOrb

[![CI](https://github.com/yurikoeth/exiled-orb/actions/workflows/ci.yml/badge.svg)](https://github.com/yurikoeth/exiled-orb/actions/workflows/ci.yml)

**All-in-one Path of Exile companion** — desktop overlay for PoE1 and PoE2.

ExiledOrb is an always-on-top desktop companion that monitors your clipboard and game log in real time to provide instant price checks, map-run tracking, AI-powered trade analysis, and character/build tools — using only sanctioned techniques (no memory reading, no input injection, official OAuth API only).

---

## Features

- **Price Check with Mod Tier Evaluation** — Copy any item in-game and get an instant price overlay. Each mod is evaluated against a local T1–T5 tier database with roll quality bars, combo detection (triple res, life+res, speed+damage), and price estimation.

- **Map Speedrun Tracker** — Automatically tracks your map runs via Client.txt zone events. Live timer, maps per hour, average clear time, fastest run, PB split comparisons, and a per-map leaderboard persisted to SQLite.

- **AI Trading Assistant (Witch Persona)** — Claude API integration where all responses are delivered in-character as the PoE1 Witch. Analyzes trade whispers for suspicious pricing, suggests responses, evaluates builds, and answers any PoE question — with image/vision support. Bring your own API key; it never leaves your machine except to Anthropic.

- **Character and Gear Viewer** — Connects to your GGG account via OAuth2 (PKCE, official developer API) to load PoE1 and PoE2 characters. View equipped gear with socket colors and links, set build goals, and run AI-powered build analysis. Without OAuth, PoE2 characters are mined from Client.txt history and gear is captured via clipboard.

- **Market Browser** — Browse live poe.ninja prices across all item categories with search, 7-day trend indicators, and category filtering — proxied through Rust to avoid CORS restrictions and cached to keep lookups instant.

- **Leveling Guide** — Step-by-step guides for PoE1 (Acts 1–10) and PoE2 (Acts 1–6) with per-character checklists that auto-advance as you change zones.

> The overlay runs as a normal always-on-top window; hotkeys (F5 toggle, Esc back) apply while the overlay window has focus. Global in-game hotkeys and click-through transparency are on the roadmap.

---

## Screenshots

<!-- TODO: add screenshots/GIF — overlay next to the game: price check panel, map timer, characters tab -->
_Screenshots coming soon._

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop App | Tauri v2 (Rust backend + React 19 frontend) |
| Frontend | React 19, TypeScript (strict), Tailwind CSS v4 |
| State Management | Zustand (dedicated stores per feature) |
| Local Database | SQLite via tauri-plugin-sql (versioned migrations) |
| HTTP | Rust `reqwest` + rustls-tls (CORS-free, timeouts) |
| AI | Claude API (user provides their own key) |
| Monorepo | pnpm workspaces + Turborepo |
| Testing | Vitest (TS) + `cargo test` (Rust) |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the data-flow pipelines and design decisions.

---

## Getting Started

### Prerequisites

- Windows 10/11 (clipboard + log watching use Win32 APIs)
- [Node.js](https://nodejs.org/) (v20+)
- [pnpm](https://pnpm.io/) (v10+)
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/) (Visual Studio Build Tools)

### Installation

```bash
git clone https://github.com/yurikoeth/exiled-orb.git
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
```

### Other Commands

```bash
pnpm run build         # Build all packages
pnpm run test          # Run all TS tests
pnpm run typecheck     # TypeScript check all packages
pnpm run lint          # ESLint
cargo test             # Rust tests (from apps/overlay/src-tauri)
```

---

## How It Works

ExiledOrb uses the same safe, non-invasive techniques as other GGG-sanctioned community tools:

- **Clipboard monitoring** — A Rust background thread uses the Win32 clipboard API to poll every 500ms. When it detects PoE item text (identified by "Item Class:" or "Rarity:" headers), it parses the item and triggers a price lookup. No hotkey interception or memory reading.

- **Client.txt polling** — A Rust background thread polls the game's Client.txt log file every second, reading only new lines appended since the last check. This detects zone changes, deaths, trade whispers, level-ups, and more. On startup, it scans the last 64KB to recover current state.

- **Official GGG OAuth API** — Character data comes from `api.pathofexile.com` via an OAuth2 PKCE flow implemented in Rust (loopback callback server, CSRF state validation, automatic token refresh). Requests honor GGG's `X-Rate-Limit-*` headers with sliding-window throttling and `Retry-After` back-off. Only the official developer API is used.

- **poe.ninja via Rust proxy** — All market data comes from poe.ninja, fetched through a Rust-side HTTP proxy to avoid browser CORS restrictions. Prices are cached with a 5-minute TTL.

- **AI through Rust** — Claude API calls are made from the Rust backend using the user's own Claude API key, stored locally in tauri-plugin-store. Nothing is sent anywhere except the Claude API.

### Rust Build Target Directory

Rust debug builds can consume 6–7 GB of disk space. If your system drive is limited, you can redirect the build target to another drive by creating an (untracked) `apps/overlay/src-tauri/.cargo/config.toml`:

```toml
[build]
target-dir = "D:\\rust-target"
```

---

## PoE1 and PoE2 Support

ExiledOrb is fully game-agnostic. All types, parsers, APIs, and data are parameterized by `game: 'poe1' | 'poe2'`. The game is auto-detected from the Client.txt file path (most recently active install wins). Both PoE1 and PoE2 characters, items, maps, and league data are supported.

---

## Roadmap

- Global in-game hotkeys (tauri-plugin-global-shortcut) and click-through transparency
- Settings UI (league/game/log-path overrides — persistence layer already in place)
- Windows installer (`.msi`/`.exe` via `tauri build`) and GitHub Releases
- Trade API integration for live rare pricing (client written, parked — see [ARCHITECTURE.md](docs/ARCHITECTURE.md#parked--work-in-progress))
- Atlas farming strategies: curated per-game strategy library, pick-and-track, map-mod alignment hints, per-strategy profit tracking

---

## Project Structure

```
exiled-orb/
  packages/shared/       Shared TypeScript library (parsers, API clients, game data, types)
  apps/overlay/          Tauri v2 desktop overlay (Rust + React)
  docs/                  Architecture documentation
```

---

## License

[MIT](LICENSE)
