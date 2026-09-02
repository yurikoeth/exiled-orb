import { describe, it, expect } from "vitest";
import { parseLogLine, parseLogLines } from "../client-log.js";

const PREFIX = "2024/03/15 14:23:45 12345678 abc [INFO Client 1234] : ";

describe("parseLogLine edge cases", () => {
  it("returns null for blank, whitespace-only, and non-timestamped lines", () => {
    expect(parseLogLine("")).toBeNull();
    expect(parseLogLine("   \t ")).toBeNull();
    expect(parseLogLine("You have entered The Coast.")).toBeNull();
  });

  it("returns null for timestamped lines without the INFO Client marker", () => {
    expect(parseLogLine("2024/03/15 14:23:45 12345678 abc [DEBUG Client 1234] : Hello")).toBeNull();
  });

  it("parses the timestamp into epoch milliseconds", () => {
    const ev = parseLogLine(`${PREFIX}You have entered The Coast.`);
    expect(ev?.type).toBe("zone");
    expect(ev && "timestamp" in ev.data ? ev.data.timestamp : null).toBe(
      new Date("2024-03-15 14:23:45").getTime()
    );
  });

  it("tags zone and death events with the requested game", () => {
    const zone = parseLogLine(`${PREFIX}You have entered The Coast.`, "poe2");
    expect(zone?.type === "zone" && zone.data.game).toBe("poe2");
    const death = parseLogLine(`${PREFIX}Exile has been slain.`, "poe2");
    expect(death?.type === "death" && death.data.game).toBe("poe2");
  });

  it("keeps zone names with apostrophes and trailing periods intact", () => {
    const ev = parseLogLine(`${PREFIX}You have entered Lioneye's Watch.`);
    expect(ev?.type === "zone" && ev.data.zoneName).toBe("Lioneye's Watch");
  });

  it("parses the PoE2 level-up wording with a class suffix", () => {
    const ev = parseLogLine(`${PREFIX}Zana (Witch) is now level 42`);
    expect(ev).toEqual({
      type: "level_up",
      data: { timestamp: expect.any(Number), level: 42 },
    });
  });

  it("splits whispers on the first colon only", () => {
    const ev = parseLogLine(`${PREFIX}@From <GUILD> Trader: Hi: I'd like to buy your item`);
    expect(ev?.type === "whisper" && ev.data.playerName).toBe("<GUILD> Trader");
    expect(ev?.type === "whisper" && ev.data.message).toBe("Hi: I'd like to buy your item");
  });

  it("does not confuse chat mentioning 'has been slain' mid-sentence", () => {
    // The death regex is anchored: only a whole "<name> has been slain." line matches.
    const ev = parseLogLine(`${PREFIX}#Trade someone said Boss has been slain. lol`);
    expect(ev).toBeNull();
  });
});

describe("parseLogLines", () => {
  it("propagates the game to every event and drops nulls", () => {
    const events = parseLogLines(
      [`${PREFIX}You have entered Clearfell.`, "garbage", `${PREFIX}Exile has been slain.`],
      "poe2"
    );
    expect(events).toHaveLength(2);
    for (const ev of events) {
      expect("game" in ev.data && ev.data.game).toBe("poe2");
    }
  });
});
