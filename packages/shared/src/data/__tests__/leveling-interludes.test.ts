import { describe, it, expect } from "vitest";
import { getLevelingGuide, findCurrentStep } from "../leveling-guide.js";

describe("PoE2 Interludes", () => {
  const guide = getLevelingGuide("poe2");

  it("adds three labelled interlude acts after Act 4", () => {
    const acts = [...new Set(guide.steps.map((s) => s.act))];
    expect(acts).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(guide.actLabels).toEqual({ 5: "Int 1", 6: "Int 2", 7: "Int 3" });
  });

  it("resolves interlude zones seen in Client.txt to steps", () => {
    for (const [zone, act] of [
      ["Scorched Farmlands", 5],
      ["Holten Estate", 5],
      ["The Khari Crossing", 6],
      ["Qimah Reservoir", 6],
      ["Ashen Forest", 7],
      ["The Cuachic Vault", 7],
    ] as const) {
      const step = findCurrentStep(guide, zone, 62);
      expect(step?.zone, zone).toBe(zone);
      expect(step?.act, zone).toBe(act);
    }
  });

  it("does not treat the repeatable Vaal side area as a step", () => {
    expect(findCurrentStep(guide, "Vaal Ruins", 62)).toBeNull();
    expect(findCurrentStep(guide, "Atziri's Temple", 62)).toBeNull();
  });
});
