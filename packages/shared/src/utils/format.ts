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
  return `${Math.round(chaos)}c`;
}

/** Format a price range */
export function formatPriceRange(
  range: [number, number],
  divineRate: number
): string {
  return `${formatPrice(range[0], divineRate)} - ${formatPrice(range[1], divineRate)}`;
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
