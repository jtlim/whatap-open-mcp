import { describe, expect, it } from "vitest";
import { formatMxqlResponse } from "../src/utils/format.ts";
import { formatPromqlResponse } from "../src/utils/format-promql.ts";
import { parseQueryWindow } from "../src/utils/time.ts";

describe("query window", () => {
  it("carries precise UTC endpoints into both response Periods", () => {
    const queryMeta = parseQueryWindow(
      "2026-01-01T00:00:00.123Z/2026-01-01T00:15:00.789Z"
    );
    expect(queryMeta).toEqual({ stime: 1767225600123, etime: 1767226500789 });
    const rows = [{ time: queryMeta.stime, value: 7 }];
    const period = "**Period**: 2026-01-01 00:00:00.123 UTC → 2026-01-01 00:15:00.789 UTC";
    expect(formatMxqlResponse(rows, { queryMeta })).toContain(period);
    expect(formatPromqlResponse(rows, { queryMeta })).toContain(period);
  });

  it("preserves the relative duration", () => {
    const { stime, etime } = parseQueryWindow("last 5 minutes");
    expect(etime - stime).toBe(300_000);
  });

  it.each([
    "2026-02-30T00:00:00Z/2026-03-02T00:15:00Z",
    "2026-01-01T00:00:00/2026-01-01T00:15:00Z",
    "2026-01-01T00:15:00Z/2026-01-01T00:00:00Z",
    "2026-01-01T00:00:00Z/2026-01-01T00:00:00Z",
    "2026-01-01T00:00:00Z/",
  ])("rejects %s", (input) => {
    expect(() => parseQueryWindow(input)).toThrow("Invalid time range format");
  });
});
