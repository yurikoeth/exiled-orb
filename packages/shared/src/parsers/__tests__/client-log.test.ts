import { describe, it, expect } from "vitest";
import { parseLogLine, parseLogLines } from "../client-log.js";

describe("parseLogLine", () => {
  it("parses zone change events", () => {
    const line =
      "2024/03/15 14:23:45 12345678 abc [INFO Client 1234] : You have entered Lioneye's Watch.";
    const event = parseLogLine(line);

    expect(event).not.toBeNull();
    expect(event!.type).toBe("zone");
    if (event!.type === "zone") {
      expect(event!.data.zoneName).toBe("Lioneye's Watch");
    }
  });

  it("parses death events", () => {
    const line =
      "2024/03/15 14:25:00 12345678 abc [INFO Client 1234] : ShadowBlade has been slain.";
    const event = parseLogLine(line);

    expect(event).not.toBeNull();
    expect(event!.type).toBe("death");
    if (event!.type === "death") {
      expect(event!.data.characterName).toBe("ShadowBlade");
    }
  });

  it("parses incoming whispers", () => {
    const line =
      "2024/03/15 14:30:00 12345678 abc [INFO Client 1234] : @From TradeBot: Hi, I'd like to buy your Chaos Orb";
    const event = parseLogLine(line);

    expect(event).not.toBeNull();
    expect(event!.type).toBe("whisper");
    if (event!.type === "whisper") {
      expect(event!.data.direction).toBe("incoming");
      expect(event!.data.playerName).toBe("TradeBot");
      expect(event!.data.message).toContain("Chaos Orb");
    }
  });

  it("parses outgoing whispers", () => {
    const line =
      "2024/03/15 14:31:00 12345678 abc [INFO Client 1234] : @To TradeBot: Sure, invite sent";
    const event = parseLogLine(line);

    expect(event).not.toBeNull();
    expect(event!.type).toBe("whisper");
    if (event!.type === "whisper") {
      expect(event!.data.direction).toBe("outgoing");
      expect(event!.data.playerName).toBe("TradeBot");
    }
  });

  it("parses level up events", () => {
    const line =
      "2024/03/15 14:35:00 12345678 abc [INFO Client 1234] : ShadowBlade is now level 85";
    const event = parseLogLine(line);

    expect(event).not.toBeNull();
    expect(event!.type).toBe("level_up");
    if (event!.type === "level_up") {
      expect(event!.data.level).toBe(85);
    }
  });

  it("parses connection events", () => {
    const line =
      "2024/03/15 14:20:00 12345678 abc [INFO Client 1234] : Connecting to instance server at 1.2.3.4:6112";
    const event = parseLogLine(line);

    expect(event).not.toBeNull();
    expect(event!.type).toBe("connected");
    if (event!.type === "connected") {
      expect(event!.data.server).toBe("1.2.3.4:6112");
    }
  });

  it("returns null for unrecognized lines", () => {
    expect(parseLogLine("some random text")).toBeNull();
    expect(parseLogLine("")).toBeNull();
    expect(
      parseLogLine("2024/03/15 14:23:45 12345678 abc [INFO Client 1234] : Loading...")
    ).toBeNull();
  });
});

describe("parseLogLines", () => {
  it("filters and parses multiple lines", () => {
    const lines = [
      "2024/03/15 14:23:45 12345678 abc [INFO Client 1234] : You have entered The Coast.",
      "some noise",
      "2024/03/15 14:24:00 12345678 abc [INFO Client 1234] : Player has been slain.",
      "",
    ];

    const events = parseLogLines(lines);
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("zone");
    expect(events[1].type).toBe("death");
  });
});
