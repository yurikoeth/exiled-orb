use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

/// Default Client.txt search paths (PoE1 + PoE2 across common install
/// locations). The active-game watcher picks the most-recently-modified one;
/// the character-history scan reads ALL existing files so chars from both
/// games (and across drives) are surfaced.
pub fn log_path_candidates() -> Vec<String> {
    vec![
        // PoE1 paths
        r"C:\Program Files (x86)\Grinding Gear Games\Path of Exile\logs\Client.txt".into(),
        r"C:\Program Files (x86)\Steam\steamapps\common\Path of Exile\logs\Client.txt".into(),
        r"C:\Program Files\Grinding Gear Games\Path of Exile\logs\Client.txt".into(),
        r"D:\SteamLibrary\steamapps\common\Path of Exile\logs\Client.txt".into(),
        r"E:\SteamLibrary\steamapps\common\Path of Exile\logs\Client.txt".into(),
        r"F:\SteamLibrary\steamapps\common\Path of Exile\logs\Client.txt".into(),
        // PoE2 paths
        r"C:\Program Files (x86)\Grinding Gear Games\Path of Exile 2\logs\Client.txt".into(),
        r"C:\Program Files (x86)\Steam\steamapps\common\Path of Exile 2\logs\Client.txt".into(),
        r"C:\Program Files\Grinding Gear Games\Path of Exile 2\logs\Client.txt".into(),
        r"D:\SteamLibrary\steamapps\common\Path of Exile 2\logs\Client.txt".into(),
        r"E:\SteamLibrary\steamapps\common\Path of Exile 2\logs\Client.txt".into(),
        r"F:\SteamLibrary\steamapps\common\Path of Exile 2\logs\Client.txt".into(),
    ]
}

/// Wraps a LogEvent with the originating game so the frontend can re-sync
/// detectedGame when activity is observed (handles mid-session game switches
/// once we ever watch both logs concurrently).
#[derive(serde::Serialize, Clone)]
struct LogEventEnvelope<'a> {
    game: &'a str,
    #[serde(flatten)]
    event: &'a LogEvent,
}

fn detect_game_from_path(path: &std::path::Path) -> &'static str {
    if path.to_string_lossy().contains("Path of Exile 2") {
        "poe2"
    } else {
        "poe1"
    }
}

/// PoE2 SCENE sentinels that should not be treated as zone changes:
/// `(null)` and `(unknown)` are scene-unload markers, and `Act N` is the
/// act-select hub screen between actual zone loads.
fn is_scene_sentinel(zone: &str) -> bool {
    matches!(zone, "(null)" | "(unknown)")
        || (zone.starts_with("Act ") && zone[4..].chars().all(|c| c.is_ascii_digit()))
}

/// Represents a parsed log event sent to the frontend
#[derive(serde::Serialize, Clone)]
#[serde(tag = "type")]
pub enum LogEvent {
    #[serde(rename = "zone")]
    Zone { zone_name: String },
    #[serde(rename = "death")]
    Death { character_name: String },
    #[serde(rename = "whisper")]
    Whisper {
        direction: String,
        player_name: String,
        message: String,
    },
    #[serde(rename = "level_up")]
    LevelUp {
        character_name: String,
        level: u32,
        /// PoE2 level-up lines carry the class ("Name (Witch) is now level N").
        class: Option<String>,
    },
    #[serde(rename = "connected")]
    Connected { server: String },
    #[serde(rename = "area_level")]
    AreaLevel { level: u32 },
    /// "{name} has joined/left the area." — always ANOTHER player (your own
    /// name never appears in these in your own log). Used to build the
    /// exclusion set so party members' deaths/level-ups aren't attributed to
    /// the local character. Never emitted to the frontend.
    #[serde(rename = "other_player")]
    OtherPlayer { character_name: String },
}

/// Initial state scanned from Client.txt history, stored in Tauri managed state
/// so the frontend can fetch it on mount (no race condition).
#[derive(serde::Serialize, Clone, Default)]
pub struct InitialGameState {
    pub character_name: Option<String>,
    pub character_level: Option<u32>,
    pub character_class: Option<String>,
    pub zone: Option<String>,
    pub area_level: Option<u32>,
    pub game: Option<String>,
    pub log_path: Option<String>,
}

/// Wrapper for Tauri managed state
pub struct GameState(pub Mutex<InitialGameState>);

/// A character mined from a Client.txt log file. Aggregates the highest level
/// seen, class (from PoE2 level-up suffix), death count, and last-seen
/// timestamp. Returned by `scan_character_history`.
#[derive(serde::Serialize, Clone, Debug)]
pub struct DetectedCharacter {
    pub name: String,
    pub class: Option<String>,
    pub level: u32,
    pub game: String,
    /// First 19 chars of the most recent log line referencing this char
    /// ("YYYY/MM/DD HH:MM:SS"). None if no timestamped event was found.
    pub last_seen: Option<String>,
    pub deaths: u32,
}

/// Tauri command: frontend calls this after mounting to get initial state
#[tauri::command]
pub fn get_initial_game_state(state: tauri::State<'_, GameState>) -> InitialGameState {
    state.0.lock().unwrap().clone()
}

/// Fold a parsed log event into the tracked game state. Used both by the
/// initial history scan and the live watcher loop.
fn apply_event(state: &mut InitialGameState, event: &LogEvent) {
    match event {
        LogEvent::Death { character_name } => {
            state.character_name = Some(character_name.clone());
        }
        LogEvent::LevelUp {
            character_name,
            level,
            class,
        } => {
            state.character_name = Some(character_name.clone());
            state.character_level = Some(*level);
            if class.is_some() {
                state.character_class = class.clone();
            }
        }
        LogEvent::Zone { zone_name } => {
            state.zone = Some(zone_name.clone());
        }
        LogEvent::AreaLevel { level } => {
            state.area_level = Some(*level);
        }
        _ => {}
    }
}

/// Parse a single Client.txt log line into an event.
/// `game` selects the zone-detection format: PoE1 uses
/// "You have entered X."; PoE2 uses "[SCENE] Set Source [X]".
fn parse_log_line(line: &str, game: &str) -> Option<LogEvent> {
    // Check for DEBUG lines (area level detection — same format in both games)
    if line.contains("[DEBUG Client ") && line.contains("Generating level ") {
        if let Some(rest) = line.split("Generating level ").nth(1) {
            if let Some(level_str) = rest.split_whitespace().next() {
                if let Ok(level) = level_str.parse::<u32>() {
                    return Some(LogEvent::AreaLevel { level });
                }
            }
        }
    }

    // PoE2 zone change: "[INFO Client XXX] [SCENE] Set Source [zone]".
    // PoE1 also emits SCENE lines but uses "You have entered" for actual zone
    // changes, so we only treat SCENE as a zone signal for PoE2.
    if game == "poe2" && line.contains("[INFO Client ") {
        const MARKER: &str = "[SCENE] Set Source [";
        if let Some(start) = line.find(MARKER) {
            let after = &line[start + MARKER.len()..];
            if let Some(end) = after.find(']') {
                let zone = &after[..end];
                if !is_scene_sentinel(zone) {
                    return Some(LogEvent::Zone {
                        zone_name: zone.to_string(),
                    });
                }
            }
        }
    }

    // Extract message after [INFO Client XXXX] :
    let marker = "[INFO Client ";
    let marker_pos = line.find(marker)?;
    let after_marker = &line[marker_pos..];
    let colon_pos = after_marker.find("] : ")?;
    let message = after_marker[colon_pos + 4..].trim();

    // PoE1 zone change: "You have entered {zone}."
    if game == "poe1" {
        if let Some(zone) = message
            .strip_prefix("You have entered ")
            .and_then(|s| s.strip_suffix('.'))
        {
            return Some(LogEvent::Zone {
                zone_name: zone.to_string(),
            });
        }
    }

    // Death: "{name} has been slain."
    if let Some(name) = message.strip_suffix(" has been slain.") {
        return Some(LogEvent::Death {
            character_name: name.to_string(),
        });
    }

    // Other players entering/leaving your area — never the local character.
    if let Some(name) = message
        .strip_suffix(" has joined the area.")
        .or_else(|| message.strip_suffix(" has left the area."))
    {
        return Some(LogEvent::OtherPlayer {
            character_name: name.to_string(),
        });
    }

    // Incoming whisper: "@From {name}: {message}"
    if let Some(rest) = message.strip_prefix("@From ") {
        if let Some(colon_idx) = rest.find(": ") {
            return Some(LogEvent::Whisper {
                direction: "incoming".to_string(),
                player_name: rest[..colon_idx].to_string(),
                message: rest[colon_idx + 2..].to_string(),
            });
        }
    }

    // Outgoing whisper: "@To {name}: {message}"
    if let Some(rest) = message.strip_prefix("@To ") {
        if let Some(colon_idx) = rest.find(": ") {
            return Some(LogEvent::Whisper {
                direction: "outgoing".to_string(),
                player_name: rest[..colon_idx].to_string(),
                message: rest[colon_idx + 2..].to_string(),
            });
        }
    }

    // Level up: "{name} is now level {level}"
    // PoE2 emits "{name} ({class}) is now level {N}" — split the class off
    // to keep the stored character name clean, and carry it as data.
    if message.contains(" is now level ") {
        let parts: Vec<&str> = message.split(" is now level ").collect();
        if parts.len() == 2 {
            if let Ok(level) = parts[1].trim().parse::<u32>() {
                let raw = parts[0].trim();
                let (name, class) = match raw.rsplit_once(" (") {
                    Some((name, suffix)) if suffix.ends_with(')') => {
                        (name, Some(suffix.trim_end_matches(')').to_string()))
                    }
                    _ => (raw, None),
                };
                return Some(LogEvent::LevelUp {
                    character_name: name.to_string(),
                    level,
                    class,
                });
            }
        }
    }

    // Connection: "Connecting to instance server at {addr}"
    if let Some(server) = message.strip_prefix("Connecting to instance server at ") {
        return Some(LogEvent::Connected {
            server: server.to_string(),
        });
    }

    None
}

/// Scan the last 64KB of Client.txt for initial state
/// Bytes covered by the fast synchronous tail scan at startup.
const QUICK_SCAN_BYTES: u64 = 65536;
/// Chunk size for the backward deep scan.
const SCAN_CHUNK: u64 = 262_144;
/// After adopting a character candidate, keep scanning this many additional
/// bytes for contradicting evidence before trusting it (see BackwardScan).
const CONFIRM_BYTES: u64 = 1_048_576;

/// State accumulated while scanning a Client.txt backward (most recent line
/// first). Character identity comes from level-up/death lines; names in
/// "has joined/left the area" lines are always OTHER players (your own name
/// never appears in those in your own log).
///
/// Because the scan runs newest-to-oldest, another player's death/level-up is
/// seen BEFORE the join line that would expose them (they join, then die).
/// Candidates are therefore adopted provisionally and DEMOTED when an older
/// join/left line names them — the scan then continues looking for the real
/// character. A candidate is only trusted after `CONFIRM_BYTES` of older log
/// yield no contradiction.
#[derive(Default)]
struct BackwardScan {
    zone: Option<String>,
    area_level: Option<u32>,
    character_name: Option<String>,
    character_level: Option<u32>,
    character_class: Option<String>,
    /// Names known to be other players.
    others: HashSet<String>,
    /// True once a level-up matching the candidate has been found.
    level_found: bool,
}

impl BackwardScan {
    /// Fold one log line (lines arrive most-recent-first).
    fn fold(&mut self, line: &str, game: &str) {
        let Some(event) = parse_log_line(line.trim(), game) else {
            return;
        };
        match event {
            LogEvent::OtherPlayer { character_name } => {
                // The current candidate turns out to be another player —
                // demote and keep looking.
                if self.character_name.as_ref() == Some(&character_name) {
                    self.character_name = None;
                    self.character_level = None;
                    self.character_class = None;
                    self.level_found = false;
                }
                self.others.insert(character_name);
            }
            LogEvent::Zone { zone_name } => {
                if self.zone.is_none() {
                    self.zone = Some(zone_name);
                }
            }
            LogEvent::AreaLevel { level } => {
                if self.area_level.is_none() {
                    self.area_level = Some(level);
                }
            }
            // Most recent non-excluded death names the candidate (its level
            // must still come from a level-up line).
            LogEvent::Death { character_name } => {
                if self.character_name.is_none() && !self.others.contains(&character_name) {
                    self.character_name = Some(character_name);
                }
            }
            LogEvent::LevelUp {
                character_name,
                level,
                class,
            } => {
                if self.level_found || self.others.contains(&character_name) {
                    return;
                }
                // If a more recent death already named the candidate, only a
                // level-up for the SAME name may set the level (an older
                // level-up for a different name is an alt or another player).
                match &self.character_name {
                    Some(current) if *current != character_name => return,
                    _ => {}
                }
                self.character_name = Some(character_name);
                self.character_level = Some(level);
                if class.is_some() {
                    self.character_class = class;
                }
                self.level_found = true;
            }
            _ => {}
        }
    }

    fn to_initial(&self, game: &str, log_path: &std::path::Path) -> InitialGameState {
        InitialGameState {
            character_name: self.character_name.clone(),
            character_level: self.character_level,
            character_class: self.character_class.clone(),
            zone: self.zone.clone(),
            area_level: self.area_level,
            game: Some(game.to_string()),
            log_path: Some(log_path.to_string_lossy().to_string()),
        }
    }
}

/// Scan a log file backward in chunks, folding each line (most recent first)
/// into `scan`. Stops when a character candidate has survived `CONFIRM_BYTES`
/// of older log without a contradicting join/left line (and zone/area are
/// known), when `max_bytes` (from the end) is exhausted, or when `abort()`
/// returns true (superseded watcher).
fn scan_log_backward(
    log_path: &PathBuf,
    game: &str,
    max_bytes: Option<u64>,
    scan: &mut BackwardScan,
    abort: &dyn Fn() -> bool,
) {
    let Ok(mut file) = File::open(log_path) else {
        return;
    };
    let len = file.metadata().map(|m| m.len()).unwrap_or(0);
    let stop = max_bytes.map_or(0, |m| len.saturating_sub(m));
    let mut end = len;
    // Byte offset below which the current candidate counts as confirmed.
    let mut confirm_below: Option<u64> = None;
    // Partial first line of the previously processed (chronologically later)
    // chunk — its beginning lives in the chunk we read next.
    let mut carry: Vec<u8> = Vec::new();

    while end > stop && !abort() {
        let start = end.saturating_sub(SCAN_CHUNK).max(stop);
        let size = (end - start) as usize;
        let mut buf = vec![0u8; size];
        if file.seek(SeekFrom::Start(start)).is_err() || file.read_exact(&mut buf).is_err() {
            return;
        }
        buf.extend_from_slice(&carry);

        let mut lines: Vec<&[u8]> = buf.split(|&b| b == b'\n').collect();
        // The first piece is incomplete unless this chunk starts at the file
        // start — its beginning is in the next (earlier) chunk.
        carry = if start > 0 {
            lines.remove(0).to_vec()
        } else {
            Vec::new()
        };

        for line in lines.iter().rev() {
            scan.fold(String::from_utf8_lossy(line).trim(), game);
        }
        end = start;

        // Track/refresh the confirmation window at chunk granularity.
        if scan.level_found {
            let below = *confirm_below.get_or_insert(end.saturating_sub(CONFIRM_BYTES));
            if end <= below && scan.zone.is_some() && scan.area_level.is_some() {
                return;
            }
        } else {
            confirm_below = None;
        }
    }
}

/// Generation counter for watcher threads. Starting a new watcher bumps the
/// generation; superseded threads notice at their next poll tick and exit, so
/// `start_log_watcher` can safely be called again (e.g. when the user sets a
/// custom log path) without leaving duplicate watchers emitting events.
static WATCHER_GEN: AtomicU64 = AtomicU64::new(0);

/// Start watching a Client.txt file for new log events.
/// Seeks to end of file on startup, only reads new lines.
/// Replaces any previously started watcher.
pub fn start_log_watcher(app: AppHandle, log_path: PathBuf) {
    let game = detect_game_from_path(&log_path);
    let generation = WATCHER_GEN.fetch_add(1, Ordering::SeqCst) + 1;
    let superseded = move || WATCHER_GEN.load(Ordering::SeqCst) != generation;

    // Fast synchronous tail scan so the frontend has zone/area (and usually
    // the character) the moment it mounts.
    let mut scan = BackwardScan::default();
    scan_log_backward(&log_path, game, Some(QUICK_SCAN_BYTES), &mut scan, &|| {
        false
    });
    let initial = scan.to_initial(game, &log_path);
    println!(
        "Scanned log tail: char={:?}, char_level={:?}, zone={:?}, area_level={:?}, game={:?}",
        initial.character_name,
        initial.character_level,
        initial.zone,
        initial.area_level,
        initial.game
    );
    if let Some(game_state) = app.try_state::<GameState>() {
        *game_state.0.lock().unwrap() = initial;
    }

    std::thread::spawn(move || {
        // Open file and seek to end FIRST so lines appended while the deep
        // scan below runs are not lost.
        let mut file = match File::open(&log_path) {
            Ok(f) => f,
            Err(e) => {
                eprintln!("Failed to open log file {:?}: {}", log_path, e);
                let _ = app.emit("log-error", format!("Cannot open {:?}: {}", log_path, e));
                return;
            }
        };

        if let Err(e) = file.seek(SeekFrom::End(0)) {
            eprintln!("Failed to seek to end of log file: {}", e);
            return;
        }

        let mut reader = BufReader::new(file);

        // Continue the scan past the tail window: confirm (or correct) the
        // tail's provisional candidate, and find the most recent level-up for
        // characters that haven't leveled recently (e.g. max level). Stops
        // ~1MB after a candidate survives unchallenged, so this is cheap.
        let tail_char = (
            scan.character_name.clone(),
            scan.character_level,
            scan.character_class.clone(),
        );
        scan_log_backward(&log_path, game, None, &mut scan, &superseded);
        let deep_char = (
            scan.character_name.clone(),
            scan.character_level,
            scan.character_class.clone(),
        );
        if deep_char != tail_char && !superseded() {
            println!(
                "Deep scan resolved character: {:?} (level {:?})",
                scan.character_name, scan.character_level
            );
            let mut changed = false;
            if let Some(game_state) = app.try_state::<GameState>() {
                let mut state = game_state.0.lock().unwrap();
                // Don't clobber live events that arrived while scanning.
                if state.character_name == tail_char.0 && state.character_level == tail_char.1 {
                    state.character_name = deep_char.0.clone();
                    state.character_level = deep_char.1;
                    state.character_class = deep_char.2.clone();
                    changed = true;
                }
            }
            if changed {
                let _ = app.emit("initial-state-updated", ());
            }
        }

        // Names of other players (party members etc.) — their deaths and
        // level-ups must not be attributed to the local character.
        let mut others = scan.others;

        println!("Watching log file (polling): {:?}", log_path);

        // Poll for new lines every 500ms — reliable on all drives
        loop {
            // A newer watcher has been started (log path changed) — exit.
            if superseded() {
                println!("Stopping superseded log watcher for {:?}", log_path);
                return;
            }

            let mut line = String::new();
            while reader.read_line(&mut line).unwrap_or(0) > 0 {
                if let Some(log_event) = parse_log_line(line.trim(), game) {
                    match &log_event {
                        // Track other players; never emit these.
                        LogEvent::OtherPlayer { character_name } => {
                            others.insert(character_name.clone());
                            line.clear();
                            continue;
                        }
                        // Drop deaths/level-ups of known other players.
                        LogEvent::Death { character_name }
                        | LogEvent::LevelUp { character_name, .. }
                            if others.contains(character_name) =>
                        {
                            line.clear();
                            continue;
                        }
                        _ => {}
                    }

                    // Update managed state
                    if let Some(game_state) = app.try_state::<GameState>() {
                        apply_event(&mut game_state.0.lock().unwrap(), &log_event);
                    }

                    let envelope = LogEventEnvelope {
                        game,
                        event: &log_event,
                    };
                    if let Err(e) = app.emit("log-event", &envelope) {
                        eprintln!("Failed to emit log event: {}", e);
                    }
                }
                line.clear();
            }

            thread::sleep(Duration::from_millis(1000));
        }
    });
}

/// Extract the "YYYY/MM/DD HH:MM:SS" prefix from a log line if it has one.
fn extract_timestamp(line: &str) -> Option<&str> {
    if line.len() < 19 {
        return None;
    }
    let bytes = line.as_bytes();
    if bytes[4] == b'/'
        && bytes[7] == b'/'
        && bytes[10] == b' '
        && bytes[13] == b':'
        && bytes[16] == b':'
    {
        Some(&line[..19])
    } else {
        None
    }
}

/// Pulls (name, class, level) from a level-up line. The standard parser
/// strips the class suffix; for history-mining we want to keep it. Returns
/// None for non-level-up lines or malformed timestamps.
fn parse_levelup_for_history(line: &str) -> Option<(String, Option<String>, u32)> {
    let marker = "[INFO Client ";
    let marker_pos = line.find(marker)?;
    let after_marker = &line[marker_pos..];
    let colon_pos = after_marker.find("] : ")?;
    let message = after_marker[colon_pos + 4..].trim();

    let parts: Vec<&str> = message.split(" is now level ").collect();
    if parts.len() != 2 {
        return None;
    }
    let level = parts[1].trim().parse::<u32>().ok()?;
    let raw_name = parts[0].trim();

    // PoE2: "Witchtimeee (Witch)"; PoE1: "Witchtimeee".
    if let Some((name_part, suffix)) = raw_name.rsplit_once(" (") {
        if let Some(class) = suffix.strip_suffix(')') {
            return Some((name_part.to_string(), Some(class.to_string()), level));
        }
    }
    Some((raw_name.to_string(), None, level))
}

/// Pulls the character name from a "<name> has been slain." line.
fn parse_death_for_history(line: &str) -> Option<String> {
    let marker = "[INFO Client ";
    let marker_pos = line.find(marker)?;
    let after_marker = &line[marker_pos..];
    let colon_pos = after_marker.find("] : ")?;
    let message = after_marker[colon_pos + 4..].trim();
    message
        .strip_suffix(" has been slain.")
        .map(|s| s.to_string())
}

/// Read an entire Client.txt and collect every character that ever leveled
/// up or died in it. Aggregates by name: highest level wins, last-seen
/// timestamp tracks the most recent line that mentioned the character,
/// deaths counts every slain event.
fn scan_for_characters(log_path: &PathBuf) -> Vec<DetectedCharacter> {
    let game = detect_game_from_path(log_path).to_string();
    let mut acc: HashMap<String, DetectedCharacter> = HashMap::new();

    let file = match File::open(log_path) {
        Ok(f) => f,
        Err(e) => {
            eprintln!(
                "[ExiledOrb] scan_for_characters: cannot open {:?}: {}",
                log_path, e
            );
            return vec![];
        }
    };
    let mut reader = BufReader::with_capacity(1 << 20, file);

    // Reuse one line buffer for the whole file (BufReader::lines allocates a
    // fresh String per line — measurable on multi-hundred-MB logs).
    let mut line = String::new();
    loop {
        line.clear();
        match reader.read_line(&mut line) {
            Ok(0) => break,
            Ok(_) => {}
            Err(_) => continue, // skip non-UTF8 chunks
        }

        // Cheap pre-filter: only level-up and death lines matter here.
        if !line.contains(" is now level ") && !line.contains(" has been slain.") {
            continue;
        }

        let timestamp = extract_timestamp(&line).map(|s| s.to_string());

        if let Some((name, class, level)) = parse_levelup_for_history(&line) {
            let entry = acc
                .entry(name.clone())
                .or_insert_with(|| DetectedCharacter {
                    name: name.clone(),
                    class: class.clone(),
                    level,
                    game: game.clone(),
                    last_seen: timestamp.clone(),
                    deaths: 0,
                });
            if level > entry.level {
                entry.level = level;
            }
            if class.is_some() && entry.class.is_none() {
                entry.class = class;
            }
            if timestamp.is_some() && timestamp > entry.last_seen {
                entry.last_seen = timestamp;
            }
            continue;
        }

        if let Some(name) = parse_death_for_history(&line) {
            let entry = acc
                .entry(name.clone())
                .or_insert_with(|| DetectedCharacter {
                    name: name.clone(),
                    class: None,
                    level: 0,
                    game: game.clone(),
                    last_seen: timestamp.clone(),
                    deaths: 0,
                });
            entry.deaths += 1;
            if timestamp.is_some() && timestamp > entry.last_seen {
                entry.last_seen = timestamp;
            }
        }
    }

    acc.into_values().collect()
}

/// Tauri command: scan every existing Client.txt file (PoE1 + PoE2 across
/// drives), aggregate detected characters, return sorted by level descending.
/// Frontend invokes this on the Characters tab; results are cached client-side.
///
/// MUST stay async: sync Tauri commands run on the main thread, and this scan
/// reads entire (potentially huge) log files — as a sync command it froze the
/// whole UI. spawn_blocking moves the file IO to a blocking worker thread.
#[tauri::command]
pub async fn scan_character_history() -> Vec<DetectedCharacter> {
    tauri::async_runtime::spawn_blocking(scan_character_history_blocking)
        .await
        .unwrap_or_else(|e| {
            eprintln!("[ExiledOrb] scan_character_history join error: {e}");
            Vec::new()
        })
}

fn scan_character_history_blocking() -> Vec<DetectedCharacter> {
    use std::collections::HashSet;

    let mut all: Vec<DetectedCharacter> = Vec::new();
    let mut seen_paths: HashSet<PathBuf> = HashSet::new();

    for path_str in log_path_candidates() {
        let path = PathBuf::from(&path_str);
        if !path.exists() {
            continue;
        }
        // Dedupe by canonical path so symlinks/duplicates don't double-scan.
        let canon = path.canonicalize().unwrap_or_else(|_| path.clone());
        if !seen_paths.insert(canon) {
            continue;
        }
        all.extend(scan_for_characters(&path));
    }

    // Dedupe across files by (name, game): keep highest level, max deaths,
    // most recent timestamp, prefer non-empty class.
    let mut by_key: HashMap<(String, String), DetectedCharacter> = HashMap::new();
    for c in all {
        let key = (c.name.clone(), c.game.clone());
        match by_key.get_mut(&key) {
            Some(entry) => {
                if c.level > entry.level {
                    entry.level = c.level;
                }
                entry.deaths = entry.deaths.max(c.deaths);
                if c.last_seen.is_some() && c.last_seen > entry.last_seen {
                    entry.last_seen = c.last_seen;
                }
                if entry.class.is_none() && c.class.is_some() {
                    entry.class = c.class;
                }
            }
            None => {
                by_key.insert(key, c);
            }
        }
    }

    let mut result: Vec<DetectedCharacter> = by_key.into_values().collect();
    result.sort_by_key(|c| std::cmp::Reverse(c.level));

    println!(
        "[ExiledOrb] scan_character_history: {} characters detected",
        result.len()
    );
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    const PREFIX: &str = "2026/07/21 12:00:00 3086096 cff945b9 [INFO Client 9560] : ";

    fn info(msg: &str) -> String {
        format!("{PREFIX}{msg}")
    }

    #[test]
    fn poe1_zone_entered() {
        let line = info("You have entered Aspirants' Plaza.");
        match parse_log_line(&line, "poe1") {
            Some(LogEvent::Zone { zone_name }) => assert_eq!(zone_name, "Aspirants' Plaza"),
            other => panic!("expected Zone, got {:?}", other.is_some()),
        }
    }

    #[test]
    fn poe2_ignores_you_have_entered() {
        let line = info("You have entered Clearfell.");
        assert!(parse_log_line(&line, "poe2").is_none());
    }

    #[test]
    fn poe2_scene_zone() {
        let line =
            "2026/07/21 12:00:00 123 abc [INFO Client 9560] [SCENE] Set Source [The Riverbank]";
        match parse_log_line(line, "poe2") {
            Some(LogEvent::Zone { zone_name }) => assert_eq!(zone_name, "The Riverbank"),
            other => panic!("expected Zone, got {:?}", other.is_some()),
        }
    }

    #[test]
    fn poe1_ignores_scene_lines() {
        let line =
            "2026/07/21 12:00:00 123 abc [INFO Client 9560] [SCENE] Set Source [The Riverbank]";
        assert!(parse_log_line(line, "poe1").is_none());
    }

    #[test]
    fn scene_sentinels_are_filtered() {
        for zone in ["(null)", "(unknown)", "Act 3", "Act 12"] {
            let line = format!(
                "2026/07/21 12:00:00 123 abc [INFO Client 9560] [SCENE] Set Source [{zone}]"
            );
            assert!(
                parse_log_line(&line, "poe2").is_none(),
                "sentinel {zone} not filtered"
            );
        }
        // A real zone that merely starts with "Act" must NOT be filtered.
        assert!(!is_scene_sentinel("Act on Instinct"));
    }

    #[test]
    fn death_line() {
        let line = info("Witchtimeee has been slain.");
        match parse_log_line(&line, "poe1") {
            Some(LogEvent::Death { character_name }) => assert_eq!(character_name, "Witchtimeee"),
            other => panic!("expected Death, got {:?}", other.is_some()),
        }
    }

    #[test]
    fn incoming_and_outgoing_whispers() {
        let line = info("@From Buyer: Hi, I'd like to buy your Mageblood");
        match parse_log_line(&line, "poe1") {
            Some(LogEvent::Whisper {
                direction,
                player_name,
                message,
            }) => {
                assert_eq!(direction, "incoming");
                assert_eq!(player_name, "Buyer");
                assert_eq!(message, "Hi, I'd like to buy your Mageblood");
            }
            other => panic!("expected Whisper, got {:?}", other.is_some()),
        }

        let line = info("@To Seller: still available?");
        match parse_log_line(&line, "poe1") {
            Some(LogEvent::Whisper { direction, .. }) => assert_eq!(direction, "outgoing"),
            other => panic!("expected Whisper, got {:?}", other.is_some()),
        }
    }

    #[test]
    fn poe1_level_up() {
        let line = info("Witchtimeee is now level 42");
        match parse_log_line(&line, "poe1") {
            Some(LogEvent::LevelUp {
                character_name,
                level,
                class,
            }) => {
                assert_eq!(character_name, "Witchtimeee");
                assert_eq!(level, 42);
                assert_eq!(class, None);
            }
            other => panic!("expected LevelUp, got {:?}", other.is_some()),
        }
    }

    #[test]
    fn poe2_level_up_splits_class_suffix() {
        let line = info("Sorceress (Witch) is now level 8");
        match parse_log_line(&line, "poe2") {
            Some(LogEvent::LevelUp {
                character_name,
                level,
                class,
            }) => {
                assert_eq!(character_name, "Sorceress");
                assert_eq!(level, 8);
                assert_eq!(class.as_deref(), Some("Witch"));
            }
            other => panic!("expected LevelUp, got {:?}", other.is_some()),
        }
    }

    #[test]
    fn joined_and_left_area_are_other_players() {
        for msg in [
            "PartyFriend has joined the area.",
            "PartyFriend has left the area.",
        ] {
            match parse_log_line(&info(msg), "poe1") {
                Some(LogEvent::OtherPlayer { character_name }) => {
                    assert_eq!(character_name, "PartyFriend");
                }
                other => panic!("expected OtherPlayer, got {:?}", other.is_some()),
            }
        }
    }

    #[test]
    fn backward_scan_excludes_party_members() {
        // Chronological order; the scan folds in REVERSE (most recent first).
        let lines = [
            info("MyChar is now level 97"),
            info("PartyFriend has joined the area."),
            info("PartyFriend is now level 80"),
            info("PartyFriend has been slain."),
        ];
        let mut scan = BackwardScan::default();
        for line in lines.iter().rev() {
            scan.fold(line, "poe1");
        }
        // PartyFriend's death and level-up are excluded; MyChar's older
        // level-up is the character.
        assert_eq!(scan.character_name.as_deref(), Some("MyChar"));
        assert_eq!(scan.character_level, Some(97));
    }

    #[test]
    fn backward_scan_death_name_locks_level_lookup() {
        // Most recent death names the char; an older level-up for a DIFFERENT
        // name (an alt) must not override, but the matching one sets level.
        let lines = [
            info("MyAlt is now level 12"),
            info("MyChar is now level 100"),
            info("MyChar has been slain."),
        ];
        let mut scan = BackwardScan::default();
        for line in lines.iter().rev() {
            scan.fold(line, "poe1");
        }
        assert_eq!(scan.character_name.as_deref(), Some("MyChar"));
        assert_eq!(scan.character_level, Some(100));
    }

    #[test]
    fn backward_file_scan_finds_old_levelup_across_chunks() {
        // A max-level char whose last level-up is deep in the file: the quick
        // tail scan misses it, the unbounded scan walks back and finds it.
        let dir = std::env::temp_dir().join("exiled-orb-test-scan");
        let _ = std::fs::create_dir_all(&dir);
        let path = dir.join("Client.txt");
        let mut content = String::new();
        content.push_str(&info("MaxLevel is now level 100"));
        content.push('\n');
        // ~1MB of filler so the level-up sits several chunks back.
        let filler = info("Async connecting to login server");
        for _ in 0..8000 {
            content.push_str(&filler);
            content.push('\n');
        }
        content.push_str(&info("You have entered Oriath."));
        content.push('\n');
        std::fs::write(&path, &content).unwrap();

        let mut quick = BackwardScan::default();
        scan_log_backward(&path, "poe1", Some(QUICK_SCAN_BYTES), &mut quick, &|| false);
        assert_eq!(quick.zone.as_deref(), Some("Oriath"));
        assert!(
            !quick.level_found,
            "level-up must be beyond the quick window"
        );

        scan_log_backward(&path, "poe1", None, &mut quick, &|| false);
        assert_eq!(quick.character_name.as_deref(), Some("MaxLevel"));
        assert_eq!(quick.character_level, Some(100));

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn area_level_debug_line() {
        let line = "2026/07/21 12:00:00 123 abc [DEBUG Client 9560] Generating level 72 area \"MapWorldsGrotto\"";
        match parse_log_line(line, "poe1") {
            Some(LogEvent::AreaLevel { level }) => assert_eq!(level, 72),
            other => panic!("expected AreaLevel, got {:?}", other.is_some()),
        }
    }

    #[test]
    fn instance_server_connection() {
        let line = info("Connecting to instance server at 169.63.67.235:6112");
        match parse_log_line(&line, "poe1") {
            Some(LogEvent::Connected { server }) => assert_eq!(server, "169.63.67.235:6112"),
            other => panic!("expected Connected, got {:?}", other.is_some()),
        }
    }

    #[test]
    fn unrelated_lines_return_none() {
        assert!(parse_log_line(&info("Async connecting to login server"), "poe1").is_none());
        assert!(parse_log_line("garbage with no markers", "poe1").is_none());
        assert!(parse_log_line("", "poe2").is_none());
    }

    #[test]
    fn timestamp_extraction() {
        assert_eq!(
            extract_timestamp("2026/07/21 12:34:56 whatever"),
            Some("2026/07/21 12:34:56")
        );
        assert_eq!(extract_timestamp("not a timestamp line here ok"), None);
        assert_eq!(extract_timestamp("short"), None);
    }

    #[test]
    fn levelup_history_keeps_class() {
        let line = info("Sorceress (Witch) is now level 30");
        assert_eq!(
            parse_levelup_for_history(&line),
            Some(("Sorceress".to_string(), Some("Witch".to_string()), 30))
        );
        let line = info("OldSchool is now level 90");
        assert_eq!(
            parse_levelup_for_history(&line),
            Some(("OldSchool".to_string(), None, 90))
        );
    }

    #[test]
    fn death_history_extracts_name() {
        let line = info("Sorceress has been slain.");
        assert_eq!(
            parse_death_for_history(&line),
            Some("Sorceress".to_string())
        );
        assert_eq!(parse_death_for_history(&info("no death here")), None);
    }
}
