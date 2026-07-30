use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::path::PathBuf;
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
    LevelUp { character_name: String, level: u32 },
    #[serde(rename = "connected")]
    Connected { server: String },
    #[serde(rename = "area_level")]
    AreaLevel { level: u32 },
}

/// Initial state scanned from Client.txt history, stored in Tauri managed state
/// so the frontend can fetch it on mount (no race condition).
#[derive(serde::Serialize, Clone, Default)]
pub struct InitialGameState {
    pub character_name: Option<String>,
    pub character_level: Option<u32>,
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
        } => {
            state.character_name = Some(character_name.clone());
            state.character_level = Some(*level);
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
    // PoE2 emits "{name} ({class}) is now level {N}", so strip a trailing
    // " (Class)" suffix to keep the stored character name clean.
    if message.contains(" is now level ") {
        let parts: Vec<&str> = message.split(" is now level ").collect();
        if parts.len() == 2 {
            if let Ok(level) = parts[1].trim().parse::<u32>() {
                let raw = parts[0].trim();
                let name = raw
                    .rsplit_once(" (")
                    .filter(|(_, suffix)| suffix.ends_with(')'))
                    .map(|(name, _)| name)
                    .unwrap_or(raw);
                return Some(LogEvent::LevelUp {
                    character_name: name.to_string(),
                    level,
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
fn scan_log_history(log_path: &PathBuf) -> InitialGameState {
    let mut state = InitialGameState::default();

    // Detect game from path
    let game = detect_game_from_path(log_path);
    state.game = Some(game.to_string());
    state.log_path = Some(log_path.to_string_lossy().to_string());

    if let Ok(mut file) = File::open(log_path) {
        let file_len = file.metadata().map(|m| m.len()).unwrap_or(0);
        let seek_pos = file_len.saturating_sub(65536);
        let _ = file.seek(SeekFrom::Start(seek_pos));

        let reader = BufReader::new(file);
        for line in reader.lines().map_while(Result::ok) {
            if let Some(event) = parse_log_line(line.trim(), game) {
                apply_event(&mut state, &event);
            }
        }
    }

    println!(
        "Scanned log history: char={:?}, char_level={:?}, zone={:?}, area_level={:?}, game={:?}",
        state.character_name, state.character_level, state.zone, state.area_level, state.game
    );

    state
}

/// Start watching a Client.txt file for new log events.
/// Seeks to end of file on startup, only reads new lines.
pub fn start_log_watcher(app: AppHandle, log_path: PathBuf) {
    // Scan history and store in managed state BEFORE spawning the thread
    let initial = scan_log_history(&log_path);
    if let Some(game_state) = app.try_state::<GameState>() {
        *game_state.0.lock().unwrap() = initial;
    }

    let game = detect_game_from_path(&log_path);

    std::thread::spawn(move || {
        // Open file and seek to end
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

        println!("Watching log file (polling): {:?}", log_path);

        // Poll for new lines every 500ms — reliable on all drives
        loop {
            let mut line = String::new();
            while reader.read_line(&mut line).unwrap_or(0) > 0 {
                if let Some(log_event) = parse_log_line(line.trim(), game) {
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
            }) => {
                assert_eq!(character_name, "Witchtimeee");
                assert_eq!(level, 42);
            }
            other => panic!("expected LevelUp, got {:?}", other.is_some()),
        }
    }

    #[test]
    fn poe2_level_up_strips_class_suffix() {
        let line = info("Sorceress (Witch) is now level 8");
        match parse_log_line(&line, "poe2") {
            Some(LogEvent::LevelUp {
                character_name,
                level,
            }) => {
                assert_eq!(character_name, "Sorceress");
                assert_eq!(level, 8);
            }
            other => panic!("expected LevelUp, got {:?}", other.is_some()),
        }
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
