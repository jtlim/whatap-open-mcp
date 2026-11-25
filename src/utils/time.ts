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

/**
 * Parses a human-readable time range string into start/end timestamps (ms).
 *
 * Supported formats:
 *   "5m", "30m", "1h", "6h", "1d", "7d", "30d"
 *   "last 1 hour", "last 30 minutes", "last 7 days"
 */
export function parseTimeRange(range: string): TimeRange {
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

const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function parseUtcInstant(input: string): number {
  if (!UTC_INSTANT.test(input)) return NaN;
  const ms = Date.parse(input);
  const expected = input.includes(".") ? input : input.replace(/Z$/, ".000Z");
  return Number.isFinite(ms) && new Date(ms).toISOString() === expected ? ms : NaN;
}

export function parseQueryWindow(input: string): TimeRange {
  if (!input.includes("/")) return parseTimeRange(input);

  const endpoints = input.trim().split("/");
  if (endpoints.length === 2) {
    const stime = parseUtcInstant(endpoints[0]);
    const etime = parseUtcInstant(endpoints[1]);
    if (stime < etime) return { stime, etime };
  }
  throw new Error(
    'Invalid time range format: expected an increasing UTC interval such as ' +
    '"2026-01-01T00:00:00Z/2026-01-01T00:15:00Z".'
  );
}

export function formatPeriodEndpoint(ms: number): string {
  return new Date(ms).toISOString().replace("T", " ").replace(/(?:\.000)?Z$/, " UTC");
}
