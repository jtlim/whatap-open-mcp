import { expect, it, vi } from 'vitest';
import { formatMxqlResponse } from '../src/utils/format.js';
import { formatPromqlResponse } from '../src/utils/format-promql.js';
import { formatQueryPeriod, parseTimeRange } from '../src/utils/time.js';

const start = '2025-01-01T00:00:00.123Z';
const end = '2025-01-01T00:15:00.456Z';

it('parses a fixed UTC query without rounding either endpoint', () => {
  expect(parseTimeRange(start + '/' + end)).toEqual({
    stime: Date.parse(start),
    etime: Date.parse(end),
  });
});

it.each([
  end + '/' + start,
  start + '/' + start,
  start.replace('01-01', '02-30') + '/' + end,
  start.replace('Z', '+00:00') + '/' + end,
  start + '/' + end + '/' + end,
])('rejects an invalid absolute interval %s', interval => {
  expect(() => parseTimeRange(interval)).toThrow('Invalid time range format');
});

it('uses the existing relative duration and shows the precise request window', () => {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(end));
  try {
    const range = parseTimeRange('last 5 minutes');
    expect(range.etime - range.stime).toBe(300_000);
    expect(formatQueryPeriod(range)).toBe(
      '**Period**: 2025-01-01 00:10:00.456 UTC → 2025-01-01 00:15:00.456 UTC',
    );
  } finally {
    clock.mockRestore();
  }
});

it('prints the request precision in both MXQL and PromQL output', () => {
  const queryMeta = parseTimeRange(start + '/' + end);
  const rows = [{ time: queryMeta.stime, _id_: 'test', cpu: 1.25 }];
  const period = '**Period**: 2025-01-01 00:00:00.123 UTC → 2025-01-01 00:15:00.456 UTC';
  expect(formatMxqlResponse(rows, { queryMeta })).toContain(period);
  expect(formatPromqlResponse(rows, { queryMeta })).toContain(period);
});
