import { vi } from "vitest";

type Row = Record<string, any>;

/**
 * Lightweight Supabase client mock. Supports the subset of the query-builder
 * used by route handlers: from().select().eq().order().single().maybeSingle()
 * and from().insert().select().single() / .update() / .delete().
 *
 * Tests pre-seed data with seed(table, rows) and inspect captured calls.
 */
export function makeSupabaseMock(initialData: Record<string, Row[]> = {}) {
  const data: Record<string, Row[]> = JSON.parse(JSON.stringify(initialData));
  const calls: Array<{ table: string; op: string; payload?: any }> = [];

  const builder = (table: string) => {
    let rows = data[table] ?? [];
    let filterFns: Array<(r: Row) => boolean> = [];

    const api: any = {
      select: vi.fn(() => api),
      insert: vi.fn((payload: Row | Row[]) => {
        const list = Array.isArray(payload) ? payload : [payload];
        const inserted = list.map((r) => ({ id: crypto.randomUUID(), ...r }));
        data[table] = [...(data[table] ?? []), ...inserted];
        calls.push({ table, op: "insert", payload: inserted });
        rows = inserted;
        return api;
      }),
      update: vi.fn((payload: Row) => {
        rows = rows.filter((r) => filterFns.every((fn) => fn(r)))
          .map((r) => ({ ...r, ...payload }));
        calls.push({ table, op: "update", payload });
        return api;
      }),
      delete: vi.fn(() => {
        const toDel = rows.filter((r) => filterFns.every((fn) => fn(r)));
        data[table] = (data[table] ?? []).filter((r) => !toDel.includes(r));
        calls.push({ table, op: "delete", payload: toDel });
        return api;
      }),
      eq: vi.fn((col: string, val: any) => {
        filterFns.push((r) => r[col] === val);
        return api;
      }),
      in: vi.fn((col: string, vals: any[]) => {
        filterFns.push((r) => vals.includes(r[col]));
        return api;
      }),
      gte: vi.fn((col: string, val: any) => {
        filterFns.push((r) => r[col] >= val);
        return api;
      }),
      lte: vi.fn((col: string, val: any) => {
        filterFns.push((r) => r[col] <= val);
        return api;
      }),
      order: vi.fn(() => api),
      limit: vi.fn(() => api),
      single: vi.fn(async () => {
        const filtered = rows.filter((r) => filterFns.every((fn) => fn(r)));
        return { data: filtered[0] ?? null, error: filtered[0] ? null : { code: "PGRST116" } };
      }),
      maybeSingle: vi.fn(async () => {
        const filtered = rows.filter((r) => filterFns.every((fn) => fn(r)));
        return { data: filtered[0] ?? null, error: null };
      }),
      then: (resolve: any) => {
        const filtered = rows.filter((r) => filterFns.every((fn) => fn(r)));
        return Promise.resolve({ data: filtered, error: null }).then(resolve);
      },
    };

    return api;
  };

  return {
    from: vi.fn(builder),
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "test-admin" } }, error: null })),
    },
    _data: data,
    _calls: calls,
    _reset: () => {
      Object.keys(data).forEach((k) => delete data[k]);
      Object.assign(data, JSON.parse(JSON.stringify(initialData)));
      calls.length = 0;
    },
  };
}

export type MockSupabase = ReturnType<typeof makeSupabaseMock>;
