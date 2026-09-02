import { describe, it, expect, beforeEach } from "vitest";
import { useGearCaptureStore } from "../gear-capture-store";
import type { ParsedItem } from "@exiled-orb/shared";

function item(itemClass: string, name = itemClass): ParsedItem {
  return { itemClass, name, baseType: name, game: "poe1", rarity: "Rare" } as ParsedItem;
}

describe("gear-capture-store", () => {
  beforeEach(() => useGearCaptureStore.getState().cancel());

  it("ignores items while no capture is active", () => {
    expect(useGearCaptureStore.getState().ingest(item("Body Armours"))).toBeNull();
  });

  it("routes armour pieces to their slots and tags them with the session game", () => {
    const s = useGearCaptureStore.getState();
    s.start("poe2");
    expect(s.ingest(item("Body Armours"))).toBe("BodyArmour");
    expect(s.ingest(item("Helmets"))).toBe("Helm");
    expect(s.ingest(item("Gloves"))).toBe("Gloves");
    expect(s.ingest(item("Boots"))).toBe("Boots");
    expect(s.ingest(item("Belts"))).toBe("Belt");
    expect(s.ingest(item("Amulets"))).toBe("Amulet");
    expect(useGearCaptureStore.getState().items.BodyArmour?.game).toBe("poe2");
    expect(useGearCaptureStore.getState().lastSlot).toBe("Amulet");
  });

  it("fills Ring then Ring2 and overwrites Ring2 afterwards", () => {
    const s = useGearCaptureStore.getState();
    s.start("poe1");
    expect(s.ingest(item("Rings", "A"))).toBe("Ring");
    expect(s.ingest(item("Rings", "B"))).toBe("Ring2");
    expect(s.ingest(item("Rings", "C"))).toBe("Ring2");
    expect(useGearCaptureStore.getState().items.Ring2?.name).toBe("C");
  });

  it("fills Weapon then Offhand for weapons, and rejects a third", () => {
    const s = useGearCaptureStore.getState();
    s.start("poe1");
    expect(s.ingest(item("One Hand Swords"))).toBe("Weapon");
    expect(s.ingest(item("Daggers"))).toBe("Offhand");
    expect(s.ingest(item("Wands"))).toBeNull();
  });

  it("sends shields, foci and quivers straight to the off-hand", () => {
    const s = useGearCaptureStore.getState();
    s.start("poe2");
    expect(s.ingest(item("Foci"))).toBe("Offhand");
    s.cancel();
    s.start("poe1");
    expect(s.ingest(item("Quivers"))).toBe("Offhand");
    expect(s.ingest(item("Bows"))).toBe("Weapon");
  });

  it("rejects non-gear", () => {
    const s = useGearCaptureStore.getState();
    s.start("poe1");
    expect(s.ingest(item("Stackable Currency"))).toBeNull();
    expect(s.ingest(item("Maps"))).toBeNull();
    expect(s.ingest(item("Jewels"))).toBeNull();
    expect(s.ingest(item("Life Flasks"))).toBeNull();
  });

  it("finish returns the captured items and resets the session", () => {
    const s = useGearCaptureStore.getState();
    s.start("poe1");
    s.ingest(item("Boots"));
    const out = s.finish();
    expect(out.game).toBe("poe1");
    expect(Object.keys(out.items)).toEqual(["Boots"]);
    expect(useGearCaptureStore.getState()).toMatchObject({ active: false, game: null, items: {} });
  });
});
