import { describe, it, expect } from "vitest";
import { isHideout } from "../hideout-names.js";

describe("isHideout", () => {
  it("recognises hideouts in both games", () => {
    expect(isHideout("Coastal Hideout")).toBe(true);
    expect(isHideout("Celestial Nebula Hideout")).toBe(true);
    expect(isHideout("Felled Hideout")).toBe(true);
    expect(isHideout("Guild Hideout")).toBe(true);
  });

  it("does not treat campaign zones or towns as hideouts", () => {
    // Was listed as a hideout — it is the Act 1 / Act 6 starting zone.
    expect(isHideout("The Twilight Strand")).toBe(false);
    expect(isHideout("Clearfell Encampment")).toBe(false);
    expect(isHideout("Ziggurat Encampment")).toBe(false);
    expect(isHideout("Kingsmarch")).toBe(false);
    expect(isHideout("Lioneye's Watch")).toBe(false);
  });
});
