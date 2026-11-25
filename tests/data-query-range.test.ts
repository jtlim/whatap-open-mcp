import { describe, expect, it } from "vitest";
import { formatMxqlResponse } from "../src/utils/format.ts";
import { formatPromqlResponse } from "../src/utils/format-promql.ts";
import { parseDataQueryRange } from "../src/utils/time.ts";

describe("data query time range", () => {
  it("preserves both fractional UTC endpoints in the displayed Period", () => {
    const queryMeta = parseDataQueryRange("2026-01-01T00:00:00.125Z/2026-01-01T00:15:00.750Z");
    expect(queryMeta).toEqual({ stime: 1767225600125, etime: 1767226500750 });
    const data = [{ time: queryMeta.stime, value: 7 }];
    const label = "**Period**: 2026-01-01 00:00:00.125 UTC → 2026-01-01 00:15:00.750 UTC";
    expect(formatMxqlResponse(data, { queryMeta })).toContain(label);
    expect(formatPromqlResponse(data, { queryMeta })).toContain(label);
  });
  it("accepts whole seconds and retains the relative input contract", () => {
    const absolute = parseDataQueryRange("2026-01-01T00:00:00Z/2026-01-01T00:15:00Z");
    expect(absolute.etime - absolute.stime).toBe(900_000);
    const relative = parseDataQueryRange("last 5 minutes");
    expect(relative.etime - relative.stime).toBe(300_000);
  });
  it.each([
    "2026-02-30T00:00:00Z/2026-03-02T00:15:00Z",
    "2026-01-01T00:00:00/2026-01-01T00:15:00Z",
    "2026-01-01T00:15:00Z/2026-01-01T00:00:00Z",
    "2026-01-01T00:00:00Z/2026-01-01T00:00:00Z",
    "2026-01-01T00:00:00Z/2026-01-01T00:15:00Z/",
  ])("rejects %s", (range) => {
    expect(() => parseDataQueryRange(range)).toThrow("Invalid time range format");
  });
});
