import { describe, expect, it } from "vitest";
import { parseQueryTimeRange } from "../src/utils/time.ts";

describe("parseQueryTimeRange", () => {
  it("preserves exact UTC endpoints with and without milliseconds", () => {
    expect(parseQueryTimeRange("2026-01-01T00:00:00.123Z/2026-01-01T00:15:00Z")).toEqual({
      stime: Date.UTC(2026, 0, 1, 0, 0, 0, 123),
      etime: Date.UTC(2026, 0, 1, 0, 15),
    });
  });

  it("keeps relative durations", () => {
    const { stime, etime } = parseQueryTimeRange("last 5 minutes");
    expect(etime - stime).toBe(300_000);
  });

  it.each([
    "2026-02-30T00:00:00Z/2026-03-01T00:15:00Z",
    "2026-01-01T00:00:00/2026-01-01T00:15:00Z",
    "2026-01-01T00:15:00Z/2026-01-01T00:00:00Z",
    "2026-01-01T00:00:00Z/2026-01-01T00:00:00Z",
    "2026-01-01T00:00:00Z/2026-01-01T00:15:00Z/",
    "invalid-range",
  ])("rejects %s", (range) => {
    expect(() => parseQueryTimeRange(range)).toThrow("Invalid time range format");
  });
});
