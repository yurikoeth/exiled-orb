import type { Game, Rarity, Influence, ParsedItem, ItemMod } from "../types/item.js";

const SEPARATOR = "--------";

/** PoE2-exclusive item classes that don't exist in PoE1 */
const POE2_ITEM_CLASSES = new Set([
  // Weapons
  "crossbows",
  "quarterstaves",
  "flails",
  "spears",
  "traps",
  // Off-hand
  "foci",
  "bucklers",
  // Endgame
  "waystones",
  "precursor tablets",
  // Items
  "charms",
  // Currency
  "barya",
  "augments",
  "omens",
  "preserved bones",
  "liquid emotions",
]);

/** Detect which game an item clipboard text is from */
function detectGame(raw: string): Game {
  // PoE2 always starts with "Item Class:" — PoE1 often starts with "Rarity:"
  // But PoE1 also has "Item Class:" in newer versions, so check class values
  const classMatch = raw.match(/Item Class:\s*(.+)/i);
  if (classMatch) {
    const itemClass = classMatch[1].trim().toLowerCase();
    // Check for PoE2-exclusive item classes
    if (POE2_ITEM_CLASSES.has(itemClass)) return "poe2";
    // PoE2 uses "Waystones", PoE1 uses "Maps"
    if (itemClass.includes("waystone")) return "poe2";
  }
  // PoE2 items never have socket links (R-R-R-G-B format) — sockets are on gems
  // If we see the old socket format, it's definitely PoE1
  if (raw.match(/Sockets:\s*[RGBWA][-\s]/)) return "poe1";
  // PoE2 has "Critical Damage Bonus" / "Critical Hit Chance" instead of
  // "Critical Strike Multiplier" / "Critical Strike Chance"
  if (raw.includes("Critical Damage Bonus") || raw.includes("Critical Hit Chance")) return "poe2";
  // PoE2 has Spirit instead of Mana reservation — as a property line
  // ("Spirit: 120"), a flat mod ("+45 to Spirit") or a percent mod
  // ("20% increased Spirit"). Plain \bSpirit\b would catch PoE1's
  // "Spirit Shield" bases, so keep the forms explicit.
  if (/^Spirit: \d+/m.test(raw) || /(\+\d+ (?:to )?|% increased )Spirit\b/.test(raw)) {
    return "poe2";
  }
  // PoE2 prints requirements on one line ("Requires: Level 26, 50 Str");
  // PoE1 prints a "Requirements:" section with "Level: 62" below it.
  if (/^Requires: Level \d+/m.test(raw)) return "poe2";
  // Runes are PoE2-only socketables
  if (raw.includes("(rune)")) return "poe2";
  return "poe1";
}

/** Parse the rarity line */
/** "20(20-26)%" / "2(1-2) to 3(3-4)" → "20%" / "2 to 3" (advanced copy ranges). */
const ROLL_RANGE = /(-?\d+(?:\.\d+)?)\(-?\d+(?:\.\d+)?-(?:-?\d+(?:\.\d+)?)\)/g;

function parseRarity(line: string): Rarity {
  const value = line.replace("Rarity: ", "").trim();
  switch (value) {
    case "Normal":
      return "Normal";
    case "Magic":
      return "Magic";
    case "Rare":
      return "Rare";
    case "Unique":
      return "Unique";
    case "Currency":
      return "Currency";
    case "Gem":
      return "Gem";
    case "Divination Card":
      return "Divination Card";
    default:
      return "Normal";
  }
}

/** Parse socket string and count max links (PoE1) */
function parseSockets(socketStr: string): { sockets: string; links: number } {
  const groups = socketStr.split(" ");
  let maxLinks = 0;
  for (const group of groups) {
    const linked = group.split("-").length;
    if (linked > maxLinks) maxLinks = linked;
  }
  return { sockets: socketStr, links: maxLinks };
}

/** Extract a numeric value from a property line like "Quality: +20% (augmented)" */
function extractPercent(line: string): number | null {
  const match = line.match(/\+?(\d+)%/);
  return match ? parseInt(match[1], 10) : null;
}

/** Extract a numeric value from a line like "Map Tier: 16" */
function extractNumber(line: string): number | null {
  const match = line.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/** Detect influence types from mod text */
function detectInfluences(sections: string[]): Influence[] {
  const influences: Influence[] = [];
  const fullText = sections.join("\n");
  const influenceNames: Influence[] = [
    "Shaper",
    "Elder",
    "Crusader",
    "Hunter",
    "Redeemer",
    "Warlord",
  ];
  for (const inf of influenceNames) {
    if (fullText.includes(`${inf} Item`)) {
      influences.push(inf);
    }
  }
  return influences;
}

/** Parse a PoE item from clipboard text (Ctrl+C output) */
export function parseItem(raw: string): ParsedItem {
  const trimmed = raw.trim();
  const sections = trimmed
    .split(SEPARATOR)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sections.length === 0) {
    throw new Error("Empty or invalid item text");
  }

  const game = detectGame(trimmed);

  // Parse header section (always first)
  const headerLines = sections[0].split("\n").map((l) => l.trim());

  let itemClass = "";
  let rarity: Rarity = "Normal";
  let name: string | null = null;
  let baseType = "";

  for (const line of headerLines) {
    if (line.startsWith("Item Class:")) {
      itemClass = line.replace("Item Class:", "").trim();
    } else if (line.startsWith("Rarity:")) {
      rarity = parseRarity(line);
    }
  }

  // After Item Class and Rarity lines, remaining lines are name/base
  const nameLines = headerLines.filter(
    (l) => !l.startsWith("Item Class:") && !l.startsWith("Rarity:")
  );

  if (rarity === "Rare" || rarity === "Unique") {
    // First line = name, second line = base type
    name = nameLines[0] || null;
    baseType = nameLines[1] || nameLines[0] || "";
  } else if (rarity === "Magic") {
    // Magic items have one line with affixes baked into the name
    baseType = nameLines[0] || "";
    name = null;
  } else {
    // Normal, Currency, Gem, Divination Card
    baseType = nameLines[0] || "";
    name = nameLines.length > 1 ? nameLines[0] : null;
    if (nameLines.length === 1) name = null;
  }

  // Initialize result
  const result: ParsedItem = {
    raw: trimmed,
    game,
    itemClass,
    rarity,
    name,
    baseType,
    itemLevel: null,
    quality: null,
    sockets: null,
    links: null,
    implicits: [],
    explicits: [],
    enchants: [],
    corrupted: false,
    mirrored: false,
    unidentified: false,
    influences: detectInfluences(sections),
    stackSize: null,
    mapTier: null,
    gemLevel: null,
    requirements: {},
    properties: {},
  };

  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    const lines = section.split("\n").map((l) => l.trim());

    // Single-line special markers
    if (lines.length === 1) {
      const line = lines[0];
      if (line === "Corrupted") {
        result.corrupted = true;
        continue;
      }
      if (line === "Mirrored") {
        result.mirrored = true;
        continue;
      }
      if (line === "Unidentified") {
        result.unidentified = true;
        continue;
      }
    }

    // Item Level
    const ilvlLine = lines.find((l) => l.startsWith("Item Level:"));
    if (ilvlLine) {
      result.itemLevel = extractNumber(ilvlLine);
      if (lines.length === 1) continue;
    }

    // Quality
    const qualityLine = lines.find((l) => l.startsWith("Quality:"));
    if (qualityLine) {
      result.quality = extractPercent(qualityLine);
    }

    // Sockets
    const socketLine = lines.find((l) => l.startsWith("Sockets:"));
    if (socketLine) {
      const socketStr = socketLine.replace("Sockets:", "").trim();
      const parsed = parseSockets(socketStr);
      result.sockets = parsed.sockets;
      result.links = parsed.links;
    }

    // Map Tier
    const tierLine = lines.find((l) => l.startsWith("Map Tier:"));
    if (tierLine) {
      result.mapTier = extractNumber(tierLine);
    }

    // Stack Size
    const stackLine = lines.find((l) => l.startsWith("Stack Size:"));
    if (stackLine) {
      const match = stackLine.match(/Stack Size:\s*(\d+)/);
      if (match) result.stackSize = parseInt(match[1], 10);
    }

    // Requirements section — check BEFORE gem level to avoid matching "Level:" inside requirements
    if (lines[0] === "Requirements:") {
      for (let j = 1; j < lines.length; j++) {
        const reqMatch = lines[j].match(/^(\w+):\s*(\d+)/);
        if (reqMatch) {
          result.requirements[reqMatch[1]] = parseInt(reqMatch[2], 10);
        }
      }
      continue;
    }

    // Gem Level — only match "Level:" outside of requirements sections
    if (rarity === "Gem" && result.gemLevel === null) {
      const levelLine = lines.find((l) => l.startsWith("Level:"));
      if (levelLine) {
        result.gemLevel = extractNumber(levelLine);
      }
    }

    // Properties section (Armour, Evasion, Energy Shield, etc.)
    const isPropertySection = lines.some(
      (l) =>
        l.startsWith("Armour:") ||
        l.startsWith("Evasion Rating:") ||
        l.startsWith("Energy Shield:") ||
        l.startsWith("Physical Damage:") ||
        l.startsWith("Attacks per Second:") ||
        l.startsWith("Critical Hit Chance:")
    );
    if (isPropertySection) {
      for (const line of lines) {
        const colonIdx = line.indexOf(":");
        if (colonIdx > 0) {
          const key = line.substring(0, colonIdx).trim();
          const value = line.substring(colonIdx + 1).trim();
          result.properties[key] = value;
        }
      }
      continue;
    }

    // Mod sections. The game tags every non-explicit line ("(implicit)",
    // "(enchant)", "(crafted)", "(fractured)") in both PoE1 and PoE2, so an
    // untagged line is an explicit — there is no positional guessing.
    const isMods = lines.every(
      (l) =>
        !l.startsWith("Item Level:") &&
        !l.startsWith("Sockets:") &&
        !l.startsWith("Quality:") &&
        !l.startsWith("Requirements:") &&
        !l.startsWith("Map Tier:") &&
        !l.startsWith("Stack Size:") &&
        l !== "Corrupted" &&
        l !== "Mirrored" &&
        l !== "Unidentified"
    );

    if (isMods && lines.length > 0 && !isPropertySection && !ilvlLine) {
      const mods: ItemMod[] = [];
      // Advanced mod descriptions (Alt-copy, or the "advanced mod
      // descriptions" option) insert a metadata line above each mod —
      //   { Prefix Modifier "Lord's" (Tier: 8) — Attribute }
      // — and print the roll range after every value: "20(20-26)% increased
      // Spirit". Keep the tier, drop the line, strip the ranges so the mod
      // reads exactly like a plain copy.
      let pendingTier: number | undefined;
      for (const l of lines) {
        // Trailing marker lines such as "Shaper Item", "Searing Exarch Item",
        // "Synthesised Item" or "Fractured Item" are not mods.
        if (l.length === 0 || / Item$/.test(l)) continue;
        if (l.startsWith("{") && l.endsWith("}")) {
          const tier = /\(Tier: (\d+)\)/.exec(l);
          pendingTier = tier ? Number(tier[1]) : undefined;
          continue;
        }
        {
          let type: ItemMod["type"] = "explicit";
          let text = l.replace(ROLL_RANGE, "$1");

          if (l.includes("(implicit)")) {
            type = "implicit";
            text = text.replace("(implicit)", "").trim();
          } else if (l.includes("(enchant)")) {
            type = "enchant";
            text = text.replace("(enchant)", "").trim();
          } else if (l.includes("(crafted)")) {
            type = "crafted";
            text = text.replace("(crafted)", "").trim();
          } else if (l.includes("(fractured)")) {
            type = "fractured";
            text = text.replace("(fractured)", "").trim();
          }

          const mod: ItemMod = { text, type };
          if (pendingTier !== undefined) {
            mod.gameTier = pendingTier;
            pendingTier = undefined;
          }
          mods.push(mod);
        }
      }

      for (const mod of mods) {
        if (mod.type === "implicit") {
          result.implicits.push(mod);
        } else if (mod.type === "enchant") {
          result.enchants.push(mod);
        } else {
          result.explicits.push(mod);
        }
      }
    }
  }

  return result;
}

/** Check if clipboard text looks like a PoE item */
export function isPoEItem(text: string): boolean {
  const trimmed = text.trim();
  return (
    trimmed.includes("Item Class:") ||
    trimmed.startsWith("Rarity:") ||
    (trimmed.includes("Rarity:") && trimmed.includes(SEPARATOR))
  );
}
