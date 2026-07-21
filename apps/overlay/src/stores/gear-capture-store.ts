import { create } from "zustand";
import type { ParsedItem, Game } from "@exiled-orb/shared";

/**
 * Slot ids match GGG's `inventory_id` field so captured builds line up with
 * GGG-fetched ones (same slot keys flow through build-store + AI prompts).
 */
export const CAPTURE_SLOTS = [
  "Helm",
  "Amulet",
  "Weapon",
  "Offhand",
  "BodyArmour",
  "Gloves",
  "Ring",
  "Ring2",
  "Belt",
  "Boots",
] as const;

export type CaptureSlot = (typeof CAPTURE_SLOTS)[number];

export const SLOT_LABELS: Record<CaptureSlot, string> = {
  Helm: "Helmet",
  Amulet: "Amulet",
  Weapon: "Weapon",
  Offhand: "Off-hand",
  BodyArmour: "Body",
  Gloves: "Gloves",
  Ring: "Ring 1",
  Ring2: "Ring 2",
  Belt: "Belt",
  Boots: "Boots",
};

const WEAPON_KEYWORDS = [
  "sword", "axe", "mace", "bow", "claw", "dagger",
  "wand", "stave", "staff", "sceptre", "scepter",
  "crossbow", "quarterstaff", "spear", "flail", "rune dagger",
];

/**
 * Map a parsed item to its target slot. Two-of slots (Ring/Ring2,
 * Weapon/Offhand) fill in order — second item of the same family lands in
 * the secondary slot. Returns null for items that aren't gear (currency,
 * maps, jewels, flasks, gems) or when both candidate slots are filled.
 */
function slotForItem(
  item: ParsedItem,
  filled: Partial<Record<CaptureSlot, ParsedItem>>,
): CaptureSlot | null {
  const cls = item.itemClass.toLowerCase();

  if (cls.includes("body armour")) return "BodyArmour";
  if (cls.includes("helmet") || cls === "helm" || cls === "helmets") return "Helm";
  if (cls.includes("glove")) return "Gloves";
  if (cls.includes("boot")) return "Boots";
  if (cls.includes("belt")) return "Belt";
  if (cls.includes("amulet")) return "Amulet";

  if (cls.includes("ring")) {
    return filled.Ring ? "Ring2" : "Ring";
  }

  // Off-hand-only families
  if (cls.includes("shield") || cls.includes("focus") || cls.includes("foci") || cls.includes("quiver")) {
    return "Offhand";
  }

  // Weapons: primary first, then off-hand for dual-wield / second weapon
  if (WEAPON_KEYWORDS.some((k) => cls.includes(k))) {
    if (!filled.Weapon) return "Weapon";
    if (!filled.Offhand) return "Offhand";
    return null;
  }

  return null;
}

interface GearCaptureState {
  active: boolean;
  /** Game the capture is locked to — items from the other game are rejected. */
  game: Game | null;
  /** Items filled so far, keyed by slot. */
  items: Partial<Record<CaptureSlot, ParsedItem>>;
  /** Last slot that received an item — drives the "just captured" highlight. */
  lastSlot: CaptureSlot | null;

  start: (game: Game) => void;
  cancel: () => void;
  /** Try to ingest a parsed item; returns the slot it landed in, or null if rejected. */
  ingest: (item: ParsedItem) => CaptureSlot | null;
  /** End the session and return what was captured (does not auto-save). */
  finish: () => { items: Partial<Record<CaptureSlot, ParsedItem>>; game: Game | null };
}

export const useGearCaptureStore = create<GearCaptureState>((set, get) => ({
  active: false,
  game: null,
  items: {},
  lastSlot: null,

  start: (game) => {
    console.log(`[ExiledOrb] Capture started (${game}) — Ctrl+C gear in PoE`);
    set({ active: true, game, items: {}, lastSlot: null });
  },

  cancel: () => {
    const filled = (Object.keys(get().items) as CaptureSlot[]).filter((k) => get().items[k]).length;
    console.log(`[ExiledOrb] Capture cancelled — ${filled} item(s) discarded`);
    set({ active: false, game: null, items: {}, lastSlot: null });
  },

  ingest: (item) => {
    const { active, game, items } = get();
    if (!active) return null;
    const slot = slotForItem(item, items);
    if (!slot) return null;
    // Force the session's game onto the captured item — the parser falls back
    // to "poe1" for shared item classes (body armours, rings, etc.) that have
    // no PoE2-specific markers, but the user has already declared the active
    // game by starting the capture, so we trust that.
    const taggedItem = game ? { ...item, game } : item;
    set({ items: { ...items, [slot]: taggedItem }, lastSlot: slot });
    return slot;
  },

  finish: () => {
    const { items, game } = get();
    const filled = (Object.keys(items) as CaptureSlot[]).filter((k) => items[k]).length;
    console.log(`[ExiledOrb] Capture finished (${game}) — ${filled} item(s) saved to active build`);
    set({ active: false, game: null, items: {}, lastSlot: null });
    return { items, game };
  },
}));
