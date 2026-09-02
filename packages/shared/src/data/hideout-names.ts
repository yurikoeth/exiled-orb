/**
 * Hideout detection — returning to a hideout ends the active map run.
 *
 * Every hideout in both games is literally named "<Tileset> Hideout": all
 * ~100 PoE1 tilesets/MTX hideouts (poedb Hideouts, checked 2026-09-02) and
 * the six PoE2 ones (Felled, Limestone, Shrine, Canal, Farmlands, Prison —
 * poe2db). The substring test in `isHideout` is therefore the real rule; the
 * explicit set only exists for names that would NOT contain the word, and
 * currently none do.
 *
 * Towns (Lioneye's Watch, Clearfell Encampment, The Ardura Caravan,
 * Ziggurat Encampment, Kingsmarch, …) and campaign zones such as The Twilight
 * Strand are deliberately NOT hideouts: useMapSpeedrun keeps a run open on a
 * town visit so a portal back into the map still counts.
 */
export const HIDEOUT_NAMES: Set<string> = new Set(["Guild Hideout"]);

/** Check if a zone name is a hideout */
export function isHideout(zoneName: string): boolean {
  if (HIDEOUT_NAMES.has(zoneName)) return true;
  return zoneName.toLowerCase().includes("hideout");
}
