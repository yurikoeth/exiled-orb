import { describe, it, expect } from "vitest";
import { SLOT_ORDER, SLOT_LABELS, CAPTURE_SLOTS, sortBySlot } from "../slots.js";

describe("slots", () => {
  it("every slot in SLOT_ORDER has a label", () => {
    for (const slot of SLOT_ORDER) {
      expect(SLOT_LABELS[slot], `label for ${slot}`).toBeTruthy();
    }
  });

  it("every capture slot is a known display slot", () => {
    const order = SLOT_ORDER as readonly string[];
    for (const slot of CAPTURE_SLOTS) {
      expect(order).toContain(slot);
    }
  });

  it("sortBySlot orders items by equipment order", () => {
    const items = [
      { inventory_id: "Boots" },
      { inventory_id: "Helm" },
      { inventory_id: "Weapon" },
    ];
    expect(sortBySlot(items).map((i) => i.inventory_id)).toEqual(["Helm", "Weapon", "Boots"]);
  });

  it("sortBySlot puts unknown slots last and does not mutate the input", () => {
    const items = [{ inventory_id: "MysterySlot" }, { inventory_id: "Amulet" }];
    const sorted = sortBySlot(items);
    expect(sorted.map((i) => i.inventory_id)).toEqual(["Amulet", "MysterySlot"]);
    expect(items.map((i) => i.inventory_id)).toEqual(["MysterySlot", "Amulet"]);
  });
});
