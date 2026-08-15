import { describe, it, expect } from "vitest";
import { reopenSupersededTasks } from "@/lib/tasks/reopen";

/**
 * Minimal chainable stub of the Supabase query builder. Records the filters it
 * was handed so the test can assert we only ever resurrect superseded rows.
 */
function makeAdmin(rows: { id: string }[] | null, error: unknown = null) {
  const calls: {
    table?: string;
    update?: Record<string, unknown>;
    eq: [string, unknown][];
    in?: [string, string[]];
  } = { eq: [] };

  const builder: Record<string, unknown> = {
    update(patch: Record<string, unknown>) {
      calls.update = patch;
      return builder;
    },
    eq(col: string, val: unknown) {
      calls.eq.push([col, val]);
      return builder;
    },
    in(col: string, vals: string[]) {
      calls.in = [col, vals];
      return builder;
    },
    select() {
      return { data: rows, error };
    },
  };

  const admin = {
    from(table: string) {
      calls.table = table;
      return builder;
    },
  };

  return { admin, calls };
}

describe("reopenSupersededTasks", () => {
  it("returns 0 and issues no query when there are no active keys", async () => {
    const { admin, calls } = makeAdmin([{ id: "a" }]);
    const n = await reopenSupersededTasks(admin as never, "microgreens-auto", []);
    expect(n).toBe(0);
    expect(calls.table).toBeUndefined();
  });

  it("reopens matching rows and clears the supersession stamp", async () => {
    const { admin, calls } = makeAdmin([{ id: "a" }, { id: "b" }]);
    const keys = ["mg:sow:crop-1:2026-08-20", "mg:sow:crop-2:2026-08-27"];

    const n = await reopenSupersededTasks(admin as never, "microgreens-auto", keys);

    expect(n).toBe(2);
    expect(calls.table).toBe("farm_tasks");
    expect(calls.update).toEqual({
      status: "open",
      superseded_at: null,
      superseded_reason: null,
    });
    expect(calls.in).toEqual(["generator_key", keys]);
  });

  it("only ever touches superseded rows of the given source", async () => {
    // completed / cancelled are operator decisions — resurrecting them would
    // silently undo work the grower already logged.
    const { admin, calls } = makeAdmin([]);
    await reopenSupersededTasks(admin as never, "recurring-item", ["rec:item-1:2026-08-20"]);

    expect(calls.eq).toContainEqual(["status", "superseded"]);
    expect(calls.eq).toContainEqual(["source", "recurring-item"]);
  });

  it("returns 0 when the update errors", async () => {
    const { admin } = makeAdmin(null, { message: "boom" });
    const n = await reopenSupersededTasks(admin as never, "microgreens-auto", ["k"]);
    expect(n).toBe(0);
  });
});
