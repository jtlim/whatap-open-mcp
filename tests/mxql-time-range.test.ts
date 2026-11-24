import { describe, expect, it } from "vitest";
import { parseMxqlTimeRange, parseTimeRange } from "../src/utils/time.js";
import { formatMxqlResponse } from "../src/utils/format.js";

describe("MXQL query periods", () => {
  const start = "2026-01-01T00:00:00.734Z";
  const end = "2026-01-01T00:15:00Z";

  it("passes the exact UTC bounds through to the response period", () => {
    const bounds = parseMxqlTimeRange(start + "/" + end);
    expect(bounds).toEqual({ stime: Date.parse(start), etime: Date.parse(end) });
    const formatted = formatMxqlResponse([{ value: 1 }], {
      title: "MXQL",
      queryMeta: { ...bounds, exactPeriod: true },
    });
    expect(formatted).toContain(start + " → 2026-01-01T00:15:00.000Z");
  });

  it.each([
    end + "/" + start,
    end + "/" + end,
    "2026-02-30T00:00:00Z/2026-03-03T00:00:00Z",
    "2026-01-01T00:00:00+01:00/" + end,
    start + "/" + end + "/",
  ])("rejects an invalid fixed interval %s", (interval) => {
    expect(() => parseMxqlTimeRange(interval)).toThrow("Invalid time range format");
  });

  it("keeps relative durations and the relative-only parser", () => {
    const bounds = parseMxqlTimeRange("last 15 minutes");
    expect(bounds.etime - bounds.stime).toBe(900_000);
    expect(() => parseTimeRange(start + "/" + end)).toThrow("Invalid time range format");
  });
});
