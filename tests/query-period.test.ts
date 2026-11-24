import { expect, it, vi } from 'vitest';
import { registerYardTools } from '../src/tools/yard.js';
import { McpServer } from '../src/mcp/server.js';
import type { WhatapApiClient } from '../src/api/client.js';
import { parseQueryPeriod } from '../src/utils/query-period.js';
import { parseTimeRange } from '../src/utils/time.js';

const start = '2025-01-01T01:00:00.125Z';
const end = '2025-01-01T01:15:00Z';
const interval = start + '/' + end;

function makeQuery() {
  const mcp = new McpServer({ name: 'test', version: '0.0.0' });
  const mxql = vi.fn().mockResolvedValue([{ time: Date.parse(start), cpu: 42 }]);
  const promql = vi.fn().mockResolvedValue([{ time: Date.parse(start), value: 42 }]);
  registerYardTools(mcp, { executeMxqlPath: mxql, executePromql: promql } as unknown as WhatapApiClient);
  const tool = (mcp as any)._tools.get('whatap_query_data');
  return { query: tool.callback, mxql, promql };
}

it('accepts mixed whole seconds and milliseconds without altering the range', () => {
  expect(parseQueryPeriod(interval)).toEqual({ stime: Date.parse(start), etime: Date.parse(end) });
  expect(() => parseTimeRange(interval)).toThrow('Invalid time range format');
});

it.each([
  end + '/' + start,
  start + '/' + start,
  start.replace('01-01', '02-30') + '/' + end,
  start.replace('Z', '+00:00') + '/' + end,
  start + '/' + end + '/' + end,
])('rejects invalid absolute input %s before executing a query', async range => {
  const { query, mxql } = makeQuery();
  const result = await query({ projectCode: 1, path: 'v2/sys/server_base', timeRange: range, limit: 100 });
  expect(result.isError).toBe(true);
  expect(result.content[0].text).toContain('Invalid time range format');
  expect(mxql).not.toHaveBeenCalled();
});

it.each([
  ['MXQL', { path: 'v2/sys/server_base' }, 'mxql'],
  ['PromQL', { query: 'up' }, 'promql'],
] as const)('uses exact upstream boundaries and displays them for %s', async (_name, mode, transport) => {
  const tool = makeQuery();
  const result = await tool.query({ projectCode: 1, ...mode, timeRange: interval, limit: 100 });
  expect(tool[transport]).toHaveBeenCalledWith(1, expect.objectContaining({
    stime: Date.parse(start), etime: Date.parse(end),
  }));
  expect(result.content[0].text).toContain(
    '**Period**: 2025-01-01 01:00:00.125 UTC → 2025-01-01 01:15:00 UTC',
  );
});

it('keeps relative-window semantics and exposes the exact relative boundaries', async () => {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(start));
  try {
    const { query, mxql } = makeQuery();
    const result = await query({ projectCode: 1, path: 'v2/sys/server_base', timeRange: 'last 5 minutes', limit: 100 });
    expect(mxql).toHaveBeenCalledWith(1, expect.objectContaining({
      stime: Date.parse(start) - 300_000, etime: Date.parse(start),
    }));
    expect(result.content[0].text).toContain(
      '**Period**: 2025-01-01 00:55:00.125 UTC → 2025-01-01 01:00:00.125 UTC',
    );
  } finally {
    clock.mockRestore();
  }
});
