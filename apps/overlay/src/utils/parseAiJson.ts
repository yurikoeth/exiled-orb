/** Robust JSON parser for AI responses — handles code fences, trailing commas, truncation. */
export function parseAiJson<T>(raw: string, fallback: T): T {
  let text = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  const start = text.indexOf("{");
  if (start < 0) {
    console.error("[ExiledOrb] No JSON object found in:", raw);
    return fallback;
  }
  text = text.substring(start);

  try {
    return JSON.parse(text);
  } catch {}

  const end = text.lastIndexOf("}");
  if (end > 0) text = text.substring(0, end + 1);
  text = text.replace(/,\s*([}\]])/g, "$1");

  try {
    return JSON.parse(text);
  } catch {}

  // Truncated mid-array: close open structures.
  let fixed = text;
  let braces = 0,
    brackets = 0,
    inString = false,
    escape = false;
  for (const ch of fixed) {
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") braces++;
    if (ch === "}") braces--;
    if (ch === "[") brackets++;
    if (ch === "]") brackets--;
  }
  if (inString) fixed += '"';
  for (let i = 0; i < brackets; i++) fixed += "]";
  for (let i = 0; i < braces; i++) fixed += "}";
  fixed = fixed.replace(/,\s*([}\]])/g, "$1");

  try {
    return JSON.parse(fixed);
  } catch (e) {
    console.error(
      "[ExiledOrb] JSON parse failed after all attempts:",
      e,
      "\nCleaned text:",
      fixed.substring(0, 500)
    );
    return fallback;
  }
}
