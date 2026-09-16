/** Format a large number with K/M/B suffixes */
export function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

/** Format a chaos value, showing in divine if high enough */
export function formatPrice(chaos: number, divineRate: number): string {
  if (divineRate > 0 && chaos >= divineRate) {
    const divines = chaos / divineRate;
    return `${divines.toFixed(1)} div`;
  }
  // PoE2 uniques are often worth a fraction of a chaos — "0c" reads as
  // "no price", so keep one decimal below 1c.
  if (chaos > 0 && chaos < 1) return chaos < 0.05 ? "<0.1c" : `${chaos.toFixed(1)}c`;
  return `${Math.round(chaos)}c`;
}

/** Format a price range */
export function formatPriceRange(range: [number, number], divineRate: number): string {
  return `${formatPrice(range[0], divineRate)} - ${formatPrice(range[1], divineRate)}`;
}

/**
 * Exchange rates needed to print a chaos-denominated value in the units a
 * game's economy actually trades in: PoE1 = chaos / divine, PoE2 = exalted /
 * divine (chaos exists in PoE2 but nobody prices in it).
 */
export interface PriceUnits {
  game: "poe1" | "poe2";
  /** Chaos per divine orb. */
  chaosPerDivine: number;
  /** Chaos per exalted orb (PoE2 only; unknown until the exchange is fetched). */
  chaosPerExalted?: number;
}

/**
 * Format a chaos value in the game's trading units. PoE2: "1.4 div" at or
 * above a divine, otherwise "37 ex" / "<1 ex"; falls back to chaos when the
 * exalted rate is unknown. PoE1: same as formatPrice.
 */
export function formatGamePrice(chaos: number, units: PriceUnits): string {
  if (units.game !== "poe2") return formatPrice(chaos, units.chaosPerDivine);
  if (units.chaosPerDivine > 0 && chaos >= units.chaosPerDivine) {
    return `${(chaos / units.chaosPerDivine).toFixed(1)} div`;
  }
  if (units.chaosPerExalted && units.chaosPerExalted > 0) {
    const ex = chaos / units.chaosPerExalted;
    if (ex <= 0) return "0 ex";
    return ex < 1 ? "<1 ex" : `${Math.round(ex)} ex`;
  }
  return formatPrice(chaos, units.chaosPerDivine);
}

/** Format a chaos range in the game's trading units. */
export function formatGamePriceRange(range: [number, number], units: PriceUnits): string {
  return `${formatGamePrice(range[0], units)} - ${formatGamePrice(range[1], units)}`;
}

/**
 * Format a long duration as days + hours ("23d 14h"), for season-length
 * countdowns. Under a day drops to hours ("14h"); under an hour → "<1h".
 * Negative input is treated as 0.
 */
export function formatDaysHours(ms: number): string {
  const totalHours = Math.floor(Math.max(0, ms) / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return "<1h";
}

/** Format duration in ms to human readable */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
