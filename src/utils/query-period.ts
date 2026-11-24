import { parseTimeRange, type TimeRange } from "./time.js";

export const FIXED_QUERY_EXAMPLE = "2025-01-01T00:00:00Z/2025-01-01T00:15:00Z";

function parseUtcBoundary(text: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(text)) return NaN;

  const milliseconds = Date.parse(text);
  if (!Number.isFinite(milliseconds)) return NaN;

  // Reject dates that the JavaScript parser accepts by rolling over into another day.
  const canonical = text.includes(".") ? text : text.slice(0, -1) + ".000Z";
  return new Date(milliseconds).toISOString() === canonical ? milliseconds : NaN;
}

/** The data query tool accepts a UTC interval as well as the shared relative formats. */
export function parseQueryPeriod(input: string): TimeRange {
  const text = input.trim();
  if (!text.includes("/")) return parseTimeRange(text);

  const parts = text.split("/");
  if (parts.length === 2) {
    const stime = parseUtcBoundary(parts[0]);
    const etime = parseUtcBoundary(parts[1]);
    if (stime < etime) return { stime, etime };
  }
  throw new Error(
    `Invalid time range format. Use a UTC start/end interval such as "${FIXED_QUERY_EXAMPLE}", with start before end.`
  );
}

/** Render the exact query boundaries without altering unrelated row timestamps. */
export function formatQueryPeriod({ stime, etime }: TimeRange): string {
  const boundary = (value: number) =>
    new Date(value).toISOString().replace("T", " ").replace(/(?:\.000)?Z$/, " UTC");
  return `**Period**: ${boundary(stime)} → ${boundary(etime)}`;
}
