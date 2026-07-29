/**
 * Single source of truth for GGG equipment slot ids (`inventory_id`), their
 * display order/labels, and the subset used by the gear-capture flow.
 * Previously duplicated between GggAccount.tsx and gear-capture-store.ts.
 */

/** Display order for equipped items (GGG inventory ids). */
export const SLOT_ORDER = [
  "Helm",
  "Amulet",
  "Weapon",
  "Weapon2",
  "BodyArmour",
  "Offhand",
  "Offhand2",
  "Gloves",
  "Ring",
  "Ring2",
  "Belt",
  "Boots",
  "Flask",
] as const;

export const SLOT_LABELS: Record<string, string> = {
  Helm: "Helmet",
  Amulet: "Amulet",
  Weapon: "Weapon",
  Weapon2: "Swap Weapon",
  BodyArmour: "Body",
  Offhand: "Off-hand",
  Offhand2: "Swap Off-hand",
  Gloves: "Gloves",
  Ring: "Ring 1",
  Ring2: "Ring 2",
  Belt: "Belt",
  Boots: "Boots",
  Flask: "Flask",
};

/**
 * Slots the clipboard gear-capture flow fills. Ids match GGG's `inventory_id`
 * so captured builds line up with GGG-fetched ones (same slot keys flow
 * through build-store + AI prompts).
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

/** Sort items into standard equipment display order (unknown slots last). */
export function sortBySlot<T extends { inventory_id: string }>(items: T[]): T[] {
  const order = SLOT_ORDER as readonly string[];
  return [...items].sort((a, b) => {
    const ai = order.indexOf(a.inventory_id);
    const bi = order.indexOf(b.inventory_id);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}
