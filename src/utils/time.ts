export interface TimeRange {
  stime: number;
  etime: number;
}

const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

export const UTC_INTERVAL_EXAMPLE = "2025-01-01T00:00:00.000Z/2025-01-01T00:15:00.000Z";
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function parseUtcTimestamp(value: string): number {
  if (!UTC_TIMESTAMP.test(value)) return NaN;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
    ? timestamp
    : NaN;
}

/**
 * Parses a human-readable time range string into start/end timestamps (ms).
 *
 * Supported formats:
 *   "5m", "30m", "1h", "6h", "1d", "7d", "30d"
 *   "last 1 hour", "last 30 minutes", "last 7 days"
 *   A fixed UTC interval with millisecond precision
 */
export function parseTimeRange(range: string): TimeRange {
  if (range.includes("/")) {
    const endpoints = range.trim().split("/");
    if (endpoints.length === 2) {
      const stime = parseUtcTimestamp(endpoints[0]);
      const etime = parseUtcTimestamp(endpoints[1]);
      if (stime < etime) return { stime, etime };
    }
    throw new Error(
      `Invalid time range format: use a UTC interval like "${UTC_INTERVAL_EXAMPLE}" with start before end.`
    );
  }

  const etime = Date.now();
  const trimmed = range.trim().toLowerCase();

  // Short form: "5m", "1h", "7d", "30s", "2w"
  const shortMatch = trimmed.match(/^(\d+)\s*([smhdw])$/);
  if (shortMatch) {
    const amount = parseInt(shortMatch[1], 10);
    const unit = shortMatch[2];
    const ms = amount * UNIT_MS[unit];
    return { stime: etime - ms, etime };
  }

  // Long form: "last 30 minutes", "last 1 hour", "last 7 days"
  const longMatch = trimmed.match(
    /^(?:last\s+)?(\d+)\s+(second|minute|hour|day|week)s?$/
  );
  if (longMatch) {
    const amount = parseInt(longMatch[1], 10);
    const unit = longMatch[2];
    const unitKey =
      unit === "second"
        ? "s"
        : unit === "minute"
          ? "m"
          : unit === "hour"
            ? "h"
            : unit === "day"
              ? "d"
              : "w";
    const ms = amount * UNIT_MS[unitKey];
    return { stime: etime - ms, etime };
  }

  throw new Error(
    `Invalid time range format: "${range}". ` +
      `Use formats like "5m", "1h", "7d", or "last 30 minutes".`
  );
}

/** Render the exact window sent to the API while keeping whole seconds readable. */
export function formatQueryPeriod({ stime, etime }: TimeRange): string {
  const format = (timestamp: number) => new Date(timestamp).toISOString()
    .replace("T", " ").replace(/(?:\.000)?Z$/, " UTC");
  return `**Period**: ${format(stime)} → ${format(etime)}`;
}
