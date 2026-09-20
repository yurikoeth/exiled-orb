import { describe, it, expect } from "vitest";
import { POE1_LEVELING, POE2_LEVELING, findCurrentStep, getNextStep } from "../leveling-guide.js";

describe("POE2_LEVELING", () => {
  it("covers the released acts (1–4) plus the three Interludes (5–7)", () => {
    for (const step of POE2_LEVELING.steps) {
      expect(step.act, step.zone).toBeGreaterThanOrEqual(1);
      expect(step.act, step.zone).toBeLessThanOrEqual(7);
    }
  });

  it("contains none of the invented zones", () => {
    const zones = new Set(POE2_LEVELING.steps.map((s) => s.zone));
    for (const fake of [
      "The Twilight Strand",
      "The Muddled Meadow",
      "The Sanctum of the Huntress",
      "The Ormath",
      "The Throne Room",
      "The Epilogue",
    ]) {
      expect(zones.has(fake), fake).toBe(false);
    }
  });

  it("starts at The Riverbank", () => {
    expect(POE2_LEVELING.steps[0].zone).toBe("The Riverbank");
  });
});

describe("POE1_LEVELING", () => {
  it("credits all 24 quest passive points", () => {
    const total = POE1_LEVELING.steps.reduce((sum, s) => sum + s.skillPoints, 0);
    expect(total).toBe(24);
  });

  it("puts bosses in their real zones", () => {
    const byZone = new Map(POE1_LEVELING.steps.map((s) => [s.zone, s]));
    expect(byZone.get("The Upper Sceptre of God")?.objective).toContain("Dominus");
    expect(byZone.get("The Temple of Decay Level 2")?.objective).toContain("Arakaali");
    expect(byZone.get("Harbour Bridge")?.objective).toContain("Solaris");
    expect(byZone.get("The Feeding Trough")?.objective).toContain("Kitava");
    expect(byZone.get("The Sewers")).toBeDefined();
    expect(byZone.get("The Sewer")).toBeUndefined();
  });
});

describe("findCurrentStep", () => {
  it("disambiguates reused zone names by character level", () => {
    expect(findCurrentStep(POE1_LEVELING, "The Twilight Strand", 2)?.act).toBe(1);
    expect(findCurrentStep(POE1_LEVELING, "The Twilight Strand", 45)?.act).toBe(6);
    expect(findCurrentStep(POE1_LEVELING, "The Twilight Strand")?.act).toBe(1);
    expect(findCurrentStep(POE1_LEVELING, "The Control Blocks", 39)?.act).toBe(5);
    expect(findCurrentStep(POE1_LEVELING, "The Control Blocks", 62)?.act).toBe(10);
  });

  it("prefers an exact zone name over a substring match", () => {
    expect(findCurrentStep(POE1_LEVELING, "The Sceptre of God")?.zone).toBe("The Sceptre of God");
    expect(findCurrentStep(POE1_LEVELING, "The Upper Sceptre of God")?.zone).toBe(
      "The Upper Sceptre of God"
    );
  });

  it("returns null for zones not in the guide", () => {
    expect(findCurrentStep(POE1_LEVELING, "Coastal Hideout")).toBeNull();
    expect(findCurrentStep(POE2_LEVELING, "Sinking Spire")).toBeNull();
  });
});

describe("getNextStep", () => {
  it("follows the level-disambiguated step", () => {
    expect(getNextStep(POE1_LEVELING, "The Twilight Strand", 45)?.zone).toBe("Prisoner's Gate");
    expect(getNextStep(POE1_LEVELING, "The Twilight Strand", 2)?.zone).toBe("The Coast");
  });

  it("returns null at the end of the guide", () => {
    expect(getNextStep(POE2_LEVELING, "The Cuachic Vault")).toBeNull();
    // Act 4's finale now hands over to the first Interlude hub
    expect(getNextStep(POE2_LEVELING, "Heart of the Tribe")?.zone).toBe("The Refuge");
  });
});
