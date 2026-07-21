/** A character as returned by the GGG OAuth character API. */
export interface GggCharacter {
  name: string;
  class: string;
  level: number;
  league: string | null;
  experience: number | null;
  game: string;
}

export const POE1_CLASSES = ["Marauder", "Ranger", "Witch", "Duelist", "Templar", "Shadow", "Scion"];
export const POE2_CLASSES = ["Warrior", "Sorceress", "Witch", "Monk", "Mercenary", "Ranger", "Druid", "Huntress"];

/** Persisted map of manually-picked classes for live-session characters. */
export const LIVE_CLASS_STORE_KEY = "live_char_classes";
/** Hidden (restorable) log-mined characters. */
export const HIDDEN_DETECTED_KEY = "hidden_detected_chars";
/**
 * Permanently dismissed characters — filtered out of scan results entirely,
 * never counted in the "hidden" UI, never restorable except by editing the
 * persisted store file. Keyed by `<game>::<name-lowercase>` like hidden.
 */
export const DISMISSED_DETECTED_KEY = "dismissed_detected_chars";

export const detectedKey = (game: string, name: string) => `${game}::${name.toLowerCase()}`;
