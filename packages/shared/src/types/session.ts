import type { Game } from "./item.js";

/** A zone change event from Client.txt */
export interface ZoneEvent {
  timestamp: number;
  zoneName: string;
  areaLevel: number | null;
  game: Game;
}

/** A death event from Client.txt */
export interface DeathEvent {
  timestamp: number;
  characterName: string;
  game: Game;
}

/** A whisper/trade message from Client.txt */
export interface WhisperEvent {
  timestamp: number;
  direction: "incoming" | "outgoing";
  playerName: string;
  message: string;
}

/** Client.txt log event union */
export type LogEvent =
  | { type: "zone"; data: ZoneEvent }
  | { type: "death"; data: DeathEvent }
  | { type: "whisper"; data: WhisperEvent }
  | { type: "level_up"; data: { timestamp: number; level: number } }
  | { type: "connected"; data: { timestamp: number; server: string } };

/**
 * Raw "log-event" payload emitted by the Rust log_watcher.
 * Serde tags the event variant with the `type` field (see log_watcher.rs).
 * Fields are snake_case since Rust serializes that way.
 */
export interface LogEventPayload {
  type: string;
  zone_name?: string;
  character_name?: string;
  direction?: string;
  player_name?: string;
  message?: string;
  level?: number;
  server?: string;
  game?: string;
  log_path?: string;
}

/** Initial game state returned by the Rust `get_initial_game_state` IPC command. */
export interface InitialGameState {
  character_name: string | null;
  character_level: number | null;
  zone: string | null;
  area_level: number | null;
  game: string | null;
  log_path: string | null;
}

/**
 * A character mined from local Client.txt history. Returned by the Rust
 * `scan_character_history` IPC command. Provides name + class + max-level
 * for characters where GGG's API is unavailable (e.g. PoE2 without OAuth).
 */
export interface DetectedCharacter {
  name: string;
  class: string | null;
  level: number;
  game: string;
  /** "YYYY/MM/DD HH:MM:SS" prefix from the most recent log line. */
  last_seen: string | null;
  deaths: number;
}

/** An active play session */
export interface Session {
  id: string;
  game: Game;
  league: string;
  startedAt: number;
  endedAt: number | null;
  zonesVisited: number;
  deaths: number;
  currentZone: string | null;
  events: LogEvent[];
}
