import { describe, it, expect, vi } from "vitest";
import { parseAiJson } from "../parseAiJson.js";

const FALLBACK = { ok: false };

describe("parseAiJson", () => {
  it("parses clean JSON", () => {
    expect(parseAiJson('{"a": 1}', FALLBACK)).toEqual({ a: 1 });
  });

  it("strips ```json code fences", () => {
    const raw = '```json\n{"verdict": "GOOD", "price": 5}\n```';
    expect(parseAiJson(raw, FALLBACK)).toEqual({ verdict: "GOOD", price: 5 });
  });

  it("ignores prose before the JSON object", () => {
    const raw = 'Ah, darling, here is my analysis: {"verdict": "VENDOR"}';
    expect(parseAiJson(raw, FALLBACK)).toEqual({ verdict: "VENDOR" });
  });

  it("removes trailing commas", () => {
    const raw = '{"items": [1, 2, 3,], "done": true,}';
    expect(parseAiJson(raw, FALLBACK)).toEqual({ items: [1, 2, 3], done: true });
  });

  it("repairs truncation mid-array", () => {
    const raw = '{"mods": ["fire res", "cold res"';
    expect(parseAiJson(raw, FALLBACK)).toEqual({ mods: ["fire res", "cold res"] });
  });

  it("repairs truncation mid-string", () => {
    const raw = '{"summary": "a solid ite';
    expect(parseAiJson(raw, FALLBACK)).toEqual({ summary: "a solid ite" });
  });

  it("returns the fallback when no object exists", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(parseAiJson("no json here at all", FALLBACK)).toBe(FALLBACK);
    spy.mockRestore();
  });

  it("returns the fallback for unrecoverable garbage", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(parseAiJson('{:::""}', FALLBACK)).toBe(FALLBACK);
    spy.mockRestore();
  });
});
