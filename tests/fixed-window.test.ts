import { describe, it, expect } from 'vitest';
import { registerYardTools } from '../src/tools/yard.ts';
import { McpServer } from '../src/mcp/server.ts';
import { resolveQueryTimeRange } from '../src/utils/time.ts';
import type { WhatapApiClient } from '../src/api/client.ts';
import { shapeToJsonSchema, validateShape } from '../src/mcp/schema.ts';

const STIME = 1_795_430_400_000;
const ETIME = STIME + 300_000;

type WindowCall = {
  route: 'mxql/text' | 'mxql/path' | 'promql';
  pcode: number;
  stime: number;
  etime: number;
  limit?: number;
  mql?: string;
  query?: string;
};

function fixture() {
  const calls: WindowCall[] = [];
  const client = {
    executeMxqlText: async (pcode: number, p: Omit<WindowCall, 'route' | 'pcode'>) => {
      calls.push({ route: 'mxql/text', pcode, ...p });
      return [];
    },
    executeMxqlPath: async (pcode: number, p: Omit<WindowCall, 'route' | 'pcode'>) => {
      calls.push({ route: 'mxql/path', pcode, ...p });
      return [];
    },
    executePromql: async (pcode: number, p: Omit<WindowCall, 'route' | 'pcode'>) => {
      calls.push({ route: 'promql', pcode, ...p });
      return [];
    },
    resolveOids: async () => new Map(),
  } as unknown as WhatapApiClient;
  const server = new McpServer({ name: 'fixed-window-test', version: '1.0.0' });
  registerYardTools(server, client);
  const registered = (server as any)._tools.get('whatap_query_data');
  return { calls, callback: registered.callback, inputSchema: registered.inputSchema };
}

describe('F1-A fixed window contract', () => {
  it('declares both optional numeric absolute fields and no timeRange default', () => {
    const { inputSchema } = fixture();
    const json = shapeToJsonSchema(inputSchema);
    expect(json.properties.stime).toMatchObject({ type: 'number' });
    expect(json.properties.etime).toMatchObject({ type: 'number' });
    expect(json.properties.timeRange).toMatchObject({ type: 'string' });
    expect(json.properties.timeRange).not.toHaveProperty('default');
    expect(json.required).not.toContain('stime');
    expect(json.required).not.toContain('etime');
    expect(json.required).not.toContain('timeRange');
    const raw = validateShape(inputSchema, { projectCode: 55, path: 'v2/sys/server_base', stime: STIME, etime: ETIME });
    expect(raw.ok).toBe(true);
    if (raw.ok) expect(raw.value.timeRange).toBeUndefined();
  });

  it('uses exactly the same fixed window for MXQL text, MXQL path and PromQL', async () => {
    const { calls, callback } = fixture();
    const base = { projectCode: 55, limit: 100, stime: STIME, etime: ETIME };
    await callback({ ...base, path: 'mxql/app/stat_tx_pcode' });
    await callback({ ...base, path: 'v2/container/kube_pod_stat' });
    await callback({ ...base, query: 'sum(rate(node_cpu_seconds_total[5m]))' });
    expect(calls).toHaveLength(3);
    expect(calls.map(c => c.route)).toEqual(['mxql/text', 'mxql/path', 'promql']);
    expect(calls.every(c => c.stime === STIME && c.etime === ETIME)).toBe(true);
  });

  it('uses the legacy 5m default when neither kind of time argument is given', async () => {
    const { calls, callback } = fixture();
    const before = Date.now();
    await callback({ projectCode: 55, path: 'v2/container/kube_pod_stat', limit: 100 });
    const after = Date.now();
    expect(calls).toHaveLength(1);
    expect(calls[0].etime).toBeGreaterThanOrEqual(before);
    expect(calls[0].etime).toBeLessThanOrEqual(after);
    expect(calls[0].etime - calls[0].stime).toBe(300_000);
  });

  it('preserves explicit relative timeRange behavior', async () => {
    const { calls, callback } = fixture();
    await callback({ projectCode: 55, query: 'up', timeRange: '1h', limit: 100 });
    expect(calls).toHaveLength(1);
    expect(calls[0].etime - calls[0].stime).toBe(3_600_000);
  });

  it.each([
    { stime: STIME },
    { etime: ETIME },
    { stime: STIME, etime: ETIME, timeRange: '5m' },
    { stime: STIME, etime: STIME },
    { stime: ETIME, etime: STIME },
    { stime: -1, etime: ETIME },
    { stime: STIME, etime: Number.NaN },
    { stime: STIME, etime: Number.POSITIVE_INFINITY },
    { stime: 1.5, etime: ETIME },
    { stime: STIME, etime: Number.MAX_SAFE_INTEGER + 1 },
    { timeRange: 'invalid' },
  ])('rejects invalid/mixed time arguments before contacting the API: %j', async (window) => {
    const { calls, callback } = fixture();
    const result = await callback({ projectCode: 55, path: 'v2/container/kube_pod_stat', ...window });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('**Error**');
    expect(calls).toHaveLength(0);
  });

  it('does not treat params with time-shaped names as request window overrides', async () => {
    const { calls, callback } = fixture();
    await callback({ projectCode: 55, path: 'v2/container/kube_pod_stat', stime: STIME, etime: ETIME,
      params: { stime: '12', etime: '99' } });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ stime: STIME, etime: ETIME });
  });
});

describe('F1-A time resolver is fail-closed', () => {
  it('accepts the UTC Unix epoch boundary as an explicit start', () => {
    expect(resolveQueryTimeRange({ stime: 0, etime: 1 })).toEqual({ stime: 0, etime: 1 });
  });
  it('does not silently convert seconds to milliseconds', () => {
    expect(resolveQueryTimeRange({ stime: 1_600_000_000, etime: 1_600_000_100 }))
      .toEqual({ stime: 1_600_000_000, etime: 1_600_000_100 });
  });
});
