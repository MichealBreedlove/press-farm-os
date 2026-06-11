import { vi } from "vitest";

type Row = Record<string, any>;

/**
 * Lightweight Supabase client mock. Supports the subset of the query-builder
 * used by route handlers: from().select().eq().order().single().maybeSingle()
 * and from().insert().select().single() / .update() / .delete().
 *
 * Mutations (insert/update/delete) are DEFERRED — they don't run until the
 * chain is awaited (via .single(), .maybeSingle(), or .then) so that
 * `.eq()` filters set after `.update()` are respected, matching real Supabase
 * builder semantics.
 *
 * Tests pre-seed data with `makeSupabaseMock({ table: [...] })` and inspect
 * via `_data`, `_calls`, `_reset`.
 */
export function makeSupabaseMock(initialData: Record<string, Row[]> = {}) {
  const data: Record<string, Row[]> = JSON.parse(JSON.stringify(initialData));
  const calls: Array<{ table: string; op: string; payload?: any }> = [];

  const builder = (table: string) => {
    const filterFns: Array<(r: Row) => boolean> = [];
    let pendingOp: "select" | "insert" | "update" | "delete" | "upsert" = "select";
    let pendingPayload: Row | Row[] | null = null;
    let pendingUpsertOpts: { onConflict?: string; ignoreDuplicates?: boolean } = {};
    let orderBy: { col: string; ascending: boolean } | null = null;
    let limitN: number | null = null;

    function execute(): Row[] {
      if (!data[table]) data[table] = [];

      if (pendingOp === "insert") {
        const list = Array.isArray(pendingPayload) ? pendingPayload : [pendingPayload!];
        const inserted = list.map((r) => ({ id: crypto.randomUUID(), ...r }));
        data[table] = [...data[table], ...inserted];
        calls.push({ table, op: "insert", payload: inserted });
        return inserted;
      }

      if (pendingOp === "upsert") {
        const list = Array.isArray(pendingPayload) ? pendingPayload : [pendingPayload!];
        const conflictCols = (pendingUpsertOpts.onConflict ?? "id").split(",").map((c) => c.trim());
        const results: Row[] = [];
        for (const r of list) {
          const existing = data[table].find((e) => conflictCols.every((c) => e[c] === r[c]));
          if (existing) {
            if (!pendingUpsertOpts.ignoreDuplicates) Object.assign(existing, r);
            results.push(existing);
          } else {
            const inserted = { id: crypto.randomUUID(), ...r };
            data[table].push(inserted);
            results.push(inserted);
          }
        }
        calls.push({ table, op: "upsert", payload: list });
        return results;
      }

      if (pendingOp === "update") {
        const matched = data[table].filter((r) => filterFns.every((fn) => fn(r)));
        const updated = matched.map((r) => Object.assign(r, pendingPayload as Row));
        calls.push({ table, op: "update", payload: pendingPayload });
        return updated;
      }

      if (pendingOp === "delete") {
        const toDel = data[table].filter((r) => filterFns.every((fn) => fn(r)));
        data[table] = data[table].filter((r) => !toDel.includes(r));
        calls.push({ table, op: "delete", payload: toDel });
        return toDel;
      }

      // default: select
      let rows = data[table].filter((r) => filterFns.every((fn) => fn(r)));
      if (orderBy) {
        const { col, ascending } = orderBy;
        rows = [...rows].sort((a, b) => {
          if (a[col] === b[col]) return 0;
          const cmp = a[col] < b[col] ? -1 : 1;
          return ascending ? cmp : -cmp;
        });
      }
      if (limitN !== null) rows = rows.slice(0, limitN);
      return rows;
    }

    const api: any = {
      select: vi.fn(() => api),
      insert: vi.fn((payload: Row | Row[]) => {
        pendingOp = "insert";
        pendingPayload = payload;
        return api;
      }),
      update: vi.fn((payload: Row) => {
        pendingOp = "update";
        pendingPayload = payload;
        return api;
      }),
      delete: vi.fn(() => {
        pendingOp = "delete";
        return api;
      }),
      upsert: vi.fn((payload: Row | Row[], opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}) => {
        pendingOp = "upsert";
        pendingPayload = payload;
        pendingUpsertOpts = opts;
        return api;
      }),
      eq: vi.fn((col: string, val: any) => {
        filterFns.push((r) => r[col] === val);
        return api;
      }),
      neq: vi.fn((col: string, val: any) => {
        filterFns.push((r) => r[col] !== val);
        return api;
      }),
      lt: vi.fn((col: string, val: any) => {
        filterFns.push((r) => r[col] < val);
        return api;
      }),
      gt: vi.fn((col: string, val: any) => {
        filterFns.push((r) => r[col] > val);
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
      order: vi.fn((col: string, opts: { ascending?: boolean } = {}) => {
        orderBy = { col, ascending: opts.ascending !== false };
        return api;
      }),
      limit: vi.fn((n: number) => {
        limitN = n;
        return api;
      }),
      single: vi.fn(async () => {
        const result = execute();
        return { data: result[0] ?? null, error: result[0] ? null : { code: "PGRST116" } };
      }),
      maybeSingle: vi.fn(async () => {
        const result = execute();
        return { data: result[0] ?? null, error: null };
      }),
      then: (resolve: any) => {
        const result = execute();
        return Promise.resolve({ data: result, error: null }).then(resolve);
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
