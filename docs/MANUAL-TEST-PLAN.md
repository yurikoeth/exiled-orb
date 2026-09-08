# ExiledOrb — Manual Test Plan (v1.0.0 launch)

Everything the automated suites cannot prove: real clipboard, real Client.txt,
real GGG/poe.ninja/Claude round-trips, real window/tray/hotkey behaviour.
Work through Part A first (5 minutes, no game), then B (no game needed),
then C/D with the game running. Tick boxes as you go and paste console lines
into the "Result" column when something is off — the `[ExiledOrb] …` lines
named below are the exact ones to look for.

**Build under test.** Run Parts B–D twice if you can: once against
`pnpm run dev:overlay` (console visible: right-click the overlay → Inspect,
Rust `[ExiledOrb]` lines in the terminal) and once against the installed
release build from `pnpm tauri build` (what users get; no console — judge by
what is on screen).

**Legend.** `[ ]` not run · `[x]` pass · `[!]` fail (note what happened) ·
`[-]` not applicable this run.

---

## Part A — Automated gate (no game, ~5 min)

Every one of these must be green before any manual step is worth doing.

```
cd f:\dev\poe-helper
git fetch && git status            # local main must not be behind origin
pnpm run typecheck                 # TS strict, both packages
pnpm run test                      # vitest: shared + overlay
pnpm run lint                      # eslint (0 errors; MapCountStats warning is known)
pnpm exec prettier --check . --end-of-line auto
                                   # prettier, ignoring CRLF drift from the Windows checkout.
                                   # Plain `pnpm run format:check` flags ~20 untouched files
                                   # for line endings only and hides real failures; CI (Linux)
                                   # runs it without the flag and is the authority.
cd apps\overlay\src-tauri
cargo test                         # Rust unit tests
cargo clippy --all-targets -- -D warnings
cargo fmt --check
```

- [ ] A1. All commands exit 0.
- [ ] A2. `pnpm run test` count matches the number printed in the latest
      commit message / this doc's "coverage" appendix (a drop means a suite
      was silently skipped).

---

## Part B — Out of game (PoE closed)

### B1. Install, launch, tray, window lifecycle

- [ ] B1.1 Installer (`ExiledOrb_1.0.0_x64-setup.exe`) runs without admin;
      SmartScreen shows "More info → Run anyway" as the README describes.
- [ ] B1.2 App launches to the home screen; window title is "ExiledOrb";
      tray icon appears.
- [ ] B1.3 Window **X** hides to tray (process stays alive). Tray → Show
      brings it back at the same position.
- [ ] B1.4 Minimize → tray → Show restores (not stuck minimized).
- [ ] B1.5 Tray → Quit exits fully (no ghost process in Task Manager).
- [ ] B1.6 Launch twice → only one window (or a clear second instance — note
      which; both are acceptable, "vanishing" is not).
- [ ] B1.7 At the very end of testing: uninstall via Settings → Apps works
      (close any open setup window first).

### B2. First run and settings persistence

- [ ] B2.1 Fresh install (or delete `%APPDATA%\com.exiled-orb.overlay\exiled-orb.db`
      + `exiled-orb-store.json`): first launch opens Settings as onboarding.
- [ ] B2.2 Change default game, per-game league override, hotkey, AI
      toggles → restart → all values survive. Console: none expected; a
      `[ExiledOrb] Failed to write settings` line is a fail.
- [ ] B2.3 League override set to "Standard" → home tile / price checks use
      Standard (see B5/B10). Clear the override → back to season league.
- [ ] B2.4 Settings → custom Client.txt path pointing at a **non-existent**
      file → visible error, previous watcher untouched. Try both Enter in
      the field and the Apply button (Enter was not confirmed on 2026-09-08).
- [ ] B2.5 Custom path pointing at a real Client.txt → home banner clears,
      console `[ExiledOrb] log watcher started: <path>`.

### B3. Client.txt detection banner

- [ ] B3.1 With no PoE installed (or all `Client.txt` temporarily renamed):
      home shows the "Client.txt not found" banner with an Open Settings
      shortcut. Console: `Initial state loaded: {… log_path: null …}`.
- [ ] B3.2 Rename the file back → Settings → Auto-detect → banner clears.
- [ ] B3.3 With both games installed the watcher picks the most recently
      modified log (`Auto-detected log file (most recent): …` in Rust
      stderr).

### B4. Global hotkey

- [ ] B4.1 Focus Notepad. Press F5 → overlay hides. F5 → shows. (Notepad
      must NOT receive the F5.)
- [ ] B4.2 Rebind to Ctrl+Shift+O in Settings → old key does nothing, new
      key toggles. Restart → still Ctrl+Shift+O.
- [ ] B4.3 Bind a key already used by another app (e.g. Ctrl+C) → app shows
      an error rather than silently stealing it. Rebind back to F5.
      Refused on purpose: Ctrl+C/V/X/A/Z/Y, Alt+F4, and any bare letter,
      digit, Space or Enter (with or without Shift) — Windows reports no
      conflict for these, so the app has to. The previous binding stays
      registered after a refusal.

### B5. Market tab

- [ ] B5.1 PoE1 selected: categories load, prices render, 7-day trend
      arrows present. Second open of the same category is instant (cache).
- [ ] B5.2 PoE2 selected: same. Currency shows chaos AND divine values.
- [ ] B5.3 Search filters the list; clearing restores it.
- [ ] B5.4 Console must NOT contain `Refusing to proxy` (allow-list
      rejecting a legit ninja URL) or `poe.ninja returned HTML`.

### B6. Season tile

- [ ] B6.1 Home tile shows "Allflame · day N" (PoE1) / "Return of the
      Ancients · day N" (PoE2), not "config outdated". Day N matches
      today − launch date (PoE1 launch 2026-07-24, PoE2 2026-05-29).

### B7. Price check WITHOUT the game (clipboard from a text editor)

Copying item text from Notepad triggers the same clipboard path as the
game. Paste each fixture from **Appendix A** into Notepad, select all,
Ctrl+C, and watch the overlay.

- [ ] B7.1 Fixture 1 (PoE1 rare body armour): panel appears; tier bars for
      Life (T1), Fire Res (T1), Chaos Res (T1), **Life Regen (T1)** — regen
      was invisible before the 2026-09-02 fix; verdict "godly"/"great".
- [ ] B7.2 Ctrl+C the SAME text again after dismissing (the × on the card;
      Esc does not close it) → panel reappears (sequence-number fix).
- [ ] B7.3 Fixture 2 (PoE1 map): MapModWarnings panel; "-Max Res" flagged
      DANGER, "Ele Reflect" DEADLY, "Fast Monsters" CAUTION; tier shows 16.
- [ ] B7.4 Fixture 3 (PoE2 rare with Spirit + Critical Hit Chance): game
      detected as poe2 (console `game: poe2`), Spirit and Crit Chance both
      tiered.
- [ ] B7.5 Fixture 4 (PoE2 waystone): warnings for "Fast Monsters",
      "Ele Pen", "-Max Res"; no "Ele Reflect" (does not exist in PoE2).
- [ ] B7.6 Fixture 5 (unique): poe.ninja price with chaos + divine; a
      6-link Tabula prices the 6L variant.
- [ ] B7.7 Fixture 6 (currency stack): price × 1 (not × stack size),
      divine rate sane (console `Price check: … category=Currency`).
- [ ] B7.8 Fixture 7 (gem): priced as the Lv.4 corrupted Enlighten variant
      (poe.ninja listing count shown, not the tier estimate).
- [ ] B7.9 Fixture 8 (garbage text): nothing happens; console
      `Not a PoE item, ignoring`.
- [ ] B7.10 Fixture 9 (malformed item): panel shows the "Parse Error" card
      (no blank-titled VENDOR card, no `Calling Claude API` line), app keeps
      working for the next copy.
- [ ] B7.11 With AI enabled but **no key**: rare shows the local mod-tier
      insight ("Based on mod tier analysis only — add Claude API key…").
- [ ] B7.12 With a valid key: Witch-persona insight; copying the same item
      again is instant (cached, no second `Calling Claude API` line).
- [ ] B7.13 With an invalid key: Rust stderr `[ExiledOrb] Claude API error
      401`, local fallback shown (the panel itself only says "add Claude API
      key for deeper insight" — it does not surface the 401 text).

### B8. GGG OAuth (needs a GGG account, no game needed)

- [ ] B8.1 Characters → Connect → browser opens pathofexile.com → approve
      → "Authorized!" page → app lists characters for BOTH games.
- [ ] B8.2 Close the browser without approving → after 5 min the app
      shows the timeout message and Connect is usable again.
- [ ] B8.3 Expand a PoE1 row and a PoE2 row → gear loads with sockets/links
      (PoE1) and without (PoE2). Console must be free of `429`.
- [ ] B8.4 Expand five rows as fast as you can → no hang, no 429; Rust
      stderr shows the limiter waiting rather than erroring.
- [ ] B8.5 Restart the app → still connected (tokens persisted).
- [ ] B8.6 Revoke the app at pathofexile.com/my-account/applications →
      next fetch shows the "authorization revoked, reconnect" message (NOT
      "no characters").
- [ ] B8.7 Disconnect → Connect again works.
- [ ] B8.8 Account with zero characters (or a fresh account) → empty state,
      not an error.
- [ ] B8.9 Analyze Build on a character with gear (key set) → Witch
      analysis with upgrades; goal editor saves and survives re-analysis.

### B9. Leveling guide tab (no game)

- [ ] B9.1 PoE1: act tabs I–X; Act I starts at The Twilight Strand, Act X
      ends at The Feeding Trough; skill-point badges add up to 24.
- [ ] B9.2 PoE2: act tabs I–IV only; Act I starts at The Riverbank; no
      "Act V/VI" and no "The Ormath"/"The Throne Room".
- [ ] B9.3 Per-character checklist ticks persist across restart (with a
      saved active build).

### B10. Speedrun stats and history (no game — uses the existing DB)

- [ ] B10.1 Maps page loads history, leaderboard and outcome counts without
      `Failed to load` console lines.
- [ ] B10.2 Mark a historical run as bricked → counts and PB update; delete
      a run (the × on a history row) → it is gone after restart.
- [ ] B10.3 Set goals (maps/hour, target time) → persist across restart.
      The goal editor lives in the session stats card, so this needs at
      least one completed run in the current session (C2 / D1).
- [ ] B10.4 Export CSV/JSON → the text is copied to the clipboard ("CSV
      copied!"); paste into Notepad and check the rows match the list.
      Same session requirement as B10.3.

### B11. Offline behaviour

- [ ] B11.1 Disable the network adapter. Price check → panel shows
      unavailable (no hang > 10 s). Market → error text. OAuth fetch → error
      within 15 s. Nothing freezes; F5 still toggles.
- [ ] B11.2 Re-enable → next price check works without restart.

---

## Part C — In game: Path of Exile 1

Start the app first, then the game (so the watcher tails from the start).
Keep the dev console visible on a second monitor if possible.

### C1. Zone tracker and character

- [ ] C1.1 Log in with a character → header shows name, `Lv.N` (correct
      level, not 1) and class within ~2 s. Console: `Initial state loaded`
      then possibly `initial-state-updated` (deep scan).
- [ ] C1.2 Change zones → zone row updates each time; the "Area N" value
      equals the monster level shown in-game.
- [ ] C1.3 Level up → `Lv.N` increments (console `Level up: … → N`).
- [ ] C1.4 Die → death counter +1. Have a party member die → counter does
      NOT move, header name does not change.
- [ ] C1.5 Party member joins/leaves → header still shows YOUR character.
- [ ] C1.6 Switch to a different character (logout → login) → header
      follows the new character after its first level-up/zone.

### C2. Map speedrun tracking

- [ ] C2.1 Tracking ON: enter a map → timer starts; map name = the map,
      tier = the map's tier (area level − 67), NOT the area level.
- [ ] C2.2 Visit town via portal and come back → run is still running.
- [ ] C2.3 Return to hideout → timer stops, Clear/Brick popup. Clear →
      run saved, PB set on first clear, "new PB" badge on a faster repeat.
- [ ] C2.4 Brick a run (6 deaths or the button) → bricked count +1, no PB.
- [ ] C2.5 Ignore the popup and enter another map → previous run
      auto-resolves as completed.
- [ ] C2.6 Enter The Twilight Strand / any campaign zone with tracking on
      → NO run starts (regression: "Strand" used to match it).
- [ ] C2.7 Run Caldera Map right after Volcano Map → Caldera starts its own
      run (used to be treated as Volcano's boss arena).
- [ ] C2.8 Guild/MTX hideouts (Celestial Nebula, etc.) also end the run.
- [ ] C2.9 Restart the app mid-session → history and PBs are still there.

### C3. Price check in game

- [ ] C3.1 Ctrl+C a rare in the inventory → panel within 1 s; tiers match
      what poedb says for the item level (spot-check one mod).
- [ ] C3.2 Ctrl+C the same item again → panel reappears.
- [ ] C3.3 Ctrl+C a unique → ninja price; a corrupted/6-link variant is
      reflected.
- [ ] C3.4 Ctrl+C a map → mod warnings; a map with reflect is DEADLY.
- [ ] C3.5 Ctrl+C in chat (plain text) → nothing happens.
- [ ] C3.6 Open the price panel, then alt-tab to the game → panel does not
      steal focus / block clicks.

### C4. Leveling guide auto-advance

- [ ] C4.1 New character in Act 1 → guide highlights the current zone and
      scrolls to it; next step shown.
- [ ] C4.2 Act 6 character in The Twilight Strand → Act VI step (not
      Act I). Act 10 character in The Control Blocks → Act X step.
- [ ] C4.3 Entering a map hides the leveling state (`isLeveling` false).

### C5. Trade whispers (AI + trade assistant enabled, key set)

- [ ] C5.1 Have a friend whisper "Hi, I'd like to buy your X listed for 5
      chaos" → analysis card appears in Ask AI / trade section.
- [ ] C5.2 A whisper without price words ("hi") → no API call (no
      `Calling Claude API` line).
- [ ] C5.3 Outgoing whispers never trigger analysis.

### C6. Hotkey with the game focused

- [ ] C6.1 Game in focus (windowed/borderless): F5 hides/shows the overlay;
      the game does not react to F5.
- [ ] C6.2 Fullscreen exclusive: note whether the overlay shows at all
      (document as a limitation if not).

---

## Part D — In game: Path of Exile 2

### D1. Zone parsing and character

- [ ] D1.1 Log in → header name/level/class (class comes from the PoE2
      level-up line format `Name (Class) is now level N`).
- [ ] D1.2 Zone changes come from `[SCENE] Set Source [X]` lines; hub
      screens ("Act 3", "(null)") never appear as zones.
- [ ] D1.3 Enter The Venom Crypts / Chimeral Wetlands → NO map run starts
      (regression: "Crypt"/"Wetlands" substrings).
- [ ] D1.4 Enter a waystone map (e.g. Crypt, Sinking Spire, Blooming
      Field) → run starts, tier = waystone tier (area level − 64).
- [ ] D1.5 A map not on poe2db's current list (new patch) → note its name
      here so `map-data.ts` can be re-synced: ______________________.
- [ ] D1.6 Return to Felled/Limestone/Shrine/Canal/Farmlands/Prison Hideout
      → run ends. Returning to Kingsmarch/Ziggurat Encampment (towns) does
      NOT end it.
- [ ] D1.7 Pinnacle: The Burning Monolith (Arbiter) starts a "boss"-tagged
      run.

### D2. Gear capture (no OAuth)

- [ ] D2.1 Characters → Live Session tile → Capture gear → Ctrl+C each
      equipped item → slots fill in order (Ring, Ring2; Weapon, Offhand);
      currency/gems are ignored with a console `Capture: no slot` line.
- [ ] D2.2 Save → build stored with structured gear; ItemCards render;
      Analyze build works (key set).
- [ ] D2.3 Cancel → nothing saved; price check works again immediately.

### D3. Character history mining

- [ ] D3.1 Characters tab (no OAuth) → PoE2 characters mined from
      Client.txt with correct max level and class; ↻ history re-scans.
- [ ] D3.2 Hide / dismiss a character → hidden survives restart,
      dismissed never returns.

### D4. PoE2 price check

- [ ] D4.1 Ctrl+C a rare with `+N to Spirit` → Spirit tiered.
- [ ] D4.2 Ctrl+C a rare with `Critical Hit Chance` / `Critical Damage
      Bonus` → both tiered (were invisible before 2026-09-02).
- [ ] D4.3 Ctrl+C a waystone → mod warnings; "Monsters have N% increased
      Attack, Cast and Movement Speed" flagged.
- [ ] D4.4 Ctrl+C a PoE2 unique → poe.ninja poe2 price (league "Runes of
      Aldur" in the console line).

### D5. Leveling guide

- [ ] D5.1 New character → The Riverbank step highlighted; advances through
      Clearfell → The Mud Burrow etc.
- [ ] D5.2 Act 4 island (e.g. Isle of Kin) → Act IV tab selected.

---

## Part E — Regressions specific to the 2026-09-02 data audit

Quick cross-check list; most are covered above but this is the "did the
rewrite break anything" pass.

- [ ] E1. PoE1 pinnacle: enter Eye of the Storm / The Shaper's Realm /
      Absence of Value and Meaning → boss run starts, tier blank.
- [ ] E2. Maven's Invitation (The Feared etc.) → boss run starts.
- [ ] E3. A PoE1 map missing from the curated list (e.g. Lava Lake Map)
      still starts a run via the " Map" suffix.
- [ ] E4. Ring with +79 life shows NO tier and a VENDOR verdict: the life
      table is the body-armour one (T5 floor 80), so a top ring roll reads
      as untiered. Known slot-approximation gap, not a regression — but if
      that verdict bothers you, per-slot tables are the fix.
- [ ] E5. Old wording no longer matches: an item that says "Life
      Regenerated per second" cannot exist in-game any more; if you see one
      in a stash from years ago, note it.

---

## Part F — Release cut (after B–E are green)

- [ ] F1. Screenshots: price check, map timer, characters/gear, market →
      README.
- [ ] F2. `git tag v1.0.0 && git push origin v1.0.0` → release.yml drafts
      the GitHub Release with installers; download the asset in a browser
      and install THAT file; repeat B1.1–B1.5 on it.
- [ ] F3. Reddit post text ready (overlay + official OAuth API + Client.txt
      only, open source, unsigned installer note).

---

## Appendix A — Clipboard fixtures (paste into Notepad, select all, Ctrl+C)

### Fixture 1 — PoE1 rare body armour (life/res/regen tiers)

```
Item Class: Body Armours
Rarity: Rare
Doom Shell
Astral Plate
--------
Quality: +20% (augmented)
Armour: 1200 (augmented)
--------
Requirements:
Level: 62
Str: 180
--------
Sockets: R-R-R-G-B-B
--------
Item Level: 86
--------
+12% to all Elemental Resistances (implicit)
--------
+125 to maximum Life
+46% to Fire Resistance
+35% to Chaos Resistance
Regenerate 22 Life per second
+53 to Strength
```

### Fixture 2 — PoE1 map with dangerous mods

```
Item Class: Maps
Rarity: Rare
Ghastly Pit
Strand Map
--------
Map Tier: 16
Item Quantity: +78% (augmented)
Item Rarity: +34% (augmented)
Monster Pack Size: +22% (augmented)
--------
Item Level: 83
--------
Monsters reflect 18% of Elemental Damage
-12% maximum Player Resistances
25% increased Monster Movement Speed
35% increased Monster Attack Speed
35% increased Monster Cast Speed
Players have 25% less Area of Effect
```

### Fixture 3 — PoE2 rare (Spirit, Critical Hit Chance)

```
Item Class: Amulets
Rarity: Rare
Grim Torc
Stellar Amulet
--------
Requirements:
Level: 60
--------
Item Level: 78
--------
+6 to all Attributes (implicit)
--------
+58 to Spirit
30% increased Critical Hit Chance
+35% to Critical Damage Bonus
+120 to maximum Life
```

### Fixture 4 — PoE2 waystone

```
Item Class: Waystones
Rarity: Rare
Crypt Waystone
Waystone (Tier 15)
--------
Waystone Tier: 15
--------
Item Level: 79
--------
Monsters have 15% increased Attack, Cast and Movement Speed
Monster Damage Penetrates 12% Elemental Resistances
-8% maximum Player Resistances
Monsters have 90% increased Stun Buildup
```

### Fixture 5 — PoE1 unique (6-link)

```
Item Class: Body Armours
Rarity: Unique
Tabula Rasa
Simple Robe
--------
Sockets: W-W-W-W-W-W
--------
Item Level: 1
--------
Item has no level requirement and Energy Shield (Hidden)
Item has 6 White Sockets and is fully linked (Hidden)
```

### Fixture 6 — currency stack

```
Item Class: Stackable Currency
Rarity: Currency
Divine Orb
--------
Stack Size: 3/10
--------
Randomises the values of the random modifiers on an item
```

### Fixture 7 — gem

```
Item Class: Skill Gems
Rarity: Gem
Enlighten Support
--------
Level: 4 (Max)
--------
Requirements:
Level: 72
--------
Corrupted
```

### Fixture 8 — garbage (must be ignored)

```
Just some text with the word Rarity: in it
```

### Fixture 9 — malformed item (must not crash)

```
Item Class: Rings
Rarity: Rare
```

## Appendix B — Console lines cheat-sheet

| Line | Meaning |
| --- | --- |
| `[ExiledOrb] Initial state loaded: {…}` | Rust watcher state synced; `log_path: null` = no Client.txt found |
| `[ExiledOrb] log watcher started: <path>` | a watcher (auto or manual) began tailing |
| `[ExiledOrb] log watcher error: …` | file vanished / unreadable → home banner |
| `[ExiledOrb] Clipboard event received, length: N` | Rust saw a clipboard change that looks like an item |
| `[ExiledOrb] Not a PoE item, ignoring` | clipboard text failed `isPoEItem` |
| `[ExiledOrb] Parsed item: Rare … game: poe2` | parser result + game detection |
| `[ExiledOrb] Price check: "X" category=… league=… game=…` | ninja lookup about to run |
| `[ExiledOrb] poe.ninja returned HTML` | wrong league name or ninja outage |
| `[ExiledOrb] Calling Claude API: model=…` (Rust stderr) | an AI request left the machine |
| `[ExiledOrb] Claude API error 401: …` (Rust stderr) | bad key |
| `[ExiledOrb] Level up: Name → N` | header level updated from the log |
| `Refusing to proxy non-poe.ninja URL` | allow-list rejected a URL — a bug if the URL is poe.ninja |

## Appendix C — What the automated suites cover (so you don't retest it)

Shared package: item parser (both games, sockets/links, implicit/crafted/
fractured tags, influences, gems, currency, magic, unidentified/mirrored),
Client.txt parser, poe.ninja URL/response/fetch cache, GGG rate limiter, the
parked trade client, all game-data tables (maps, hideouts, dangerous mods,
mod tiers, leveling guides, seasons, stat mappings), formatting helpers,
session statistics.

Overlay: every Zustand store (overlay, ai, gear-capture, build, speedrun,
settings), the SQLite access layer (query shapes + error swallowing), the
Tauri store wrapper, price-check routing/league resolution, AI analysis
gating/caching/fallbacks, initial-state sync, build save/analyze helpers,
character-history cache/level resolution, slot ordering, AI JSON repair,
ninja response cache.

Rust: Client.txt line parsing for both games (sentinels, party members,
backward scan), GGG rate limiter, character dedupe, proxy allow-list, PKCE
(RFC 7636 vector, verifier/state, authorize URL, token expiry), Witch prompt
assembly, SQL migrations, log path candidates.

**Not automated (React effect hooks — needs a DOM test renderer):**
`useClipboard`, `useClientLog` event wiring, `useMapSpeedrun`,
`useLevelingTracker`, `useTradeWhispers`. Parts B7, C2, C4, C5 and D1 cover
them by hand.
