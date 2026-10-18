/**
 * Display helpers. Everything here is presentation only — no maths that the
 * analysis depends on, so it can change freely without touching the algorithm.
 */

/** Price with the market's own precision, grouped for readability. */
export function formatPrice(value: number, precision: number): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

/** A zone's range, e.g. "2,318.40 – 2,324.90". */
export function formatRange(low: number, high: number, precision: number): string {
  return `${formatPrice(low, precision)} – ${formatPrice(high, precision)}`;
}

/**
 * Dates are formatted in UTC on purpose: candle timestamps are UTC, and letting
 * the browser pick a timezone would make "Oct 16" disagree with the chart.
 */
export function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatDateTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });
}

/** "3 days ago", "2 hours ago" — gives recency context next to the date. */
export function relativeTime(unixSeconds: number, nowSeconds = Date.now() / 1000): string {
  const diff = Math.max(0, nowSeconds - unixSeconds);
  const minutes = Math.floor(diff / 60);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return days === 1 ? '1 day ago' : `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`;
  const years = Math.floor(months / 12);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/** Plain label for a 0-100 strength score. */
export function strengthLabel(score: number): string {
  if (score >= 75) return 'Strong';
  if (score >= 55) return 'Solid';
  if (score >= 35) return 'Moderate';
  return 'Weak';
}

export function strengthTone(score: number): 'strong' | 'solid' | 'moderate' | 'weak' {
  if (score >= 75) return 'strong';
  if (score >= 55) return 'solid';
  if (score >= 35) return 'moderate';
  return 'weak';
}

/** `count` touches / turns, with correct pluralisation. */
export function plural(count: number, singular: string, pluralForm?: string): string {
  return count === 1 ? singular : (pluralForm ?? `${singular}s`);
}
