import { describe, it, expect, vi, afterEach } from "vitest";
import {
  hasSuccessfulWeeklyUpdate,
  readFarmSettings,
  recordWeeklyUpdateAttempt,
  upsertFarmSetting,
} from "@/lib/weekly-update";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The weekly-update bookkeeping that the 2026-08-17 miss exposed: a log row
 * whose insert is rejected must be REPORTED (supabase-js returns the error,
 * it doesn't throw), and the watchdog must accept the sent-week stamp as
 * proof even when the log row never landed.
 *
 * Tiny chainable stub: every terminal `await` resolves the next canned
 * `{data, error}` for its `table:op` key.
 */
function fakeAdmin(script: Record<string, Array<{ data?: unknown; error?: unknown }>>) {
  const calls: Array<{ table: string; op: string; payload?: unknown; opts?: unknown }> = [];
  const next = (key: string) => script[key]?.shift() ?? { data: [], error: null };
  const from = (table: string) => {
    let op = "select";
    let payload: unknown;
    let opts: unknown;
    const chain: any = {};
    for (const m of ["select", "eq", "in", "limit", "order"]) chain[m] = () => chain;
    chain.maybeSingle = () => chain;
    chain.single = () => chain;
    for (const m of ["insert", "upsert", "update"]) {
      chain[m] = (p: unknown, o?: unknown) => {
        op = m;
        payload = p;
        opts = o;
        return chain;
      };
    }
    chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
      calls.push({ table, op, payload, opts });
      return Promise.resolve(next(`${table}:${op}`)).then(resolve, reject);
    };
    return chain;
  };
  return { admin: { from } as unknown as SupabaseClient, calls };
}

const WEEK = "2026-10-26";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("recordWeeklyUpdateAttempt", () => {
  it("returns true and writes the row with the counts and a capped error", async () => {
    const { admin, calls } = fakeAdmin({ "weekly_update_log:insert": [{ error: null }] });
    const ok = await recordWeeklyUpdateAttempt(admin, {
      weekOf: WEEK,
      triggeredBy: "cron",
      status: "partial",
      source: "draft",
      recipientsCount: 3,
      succeededCount: 2,
      failedCount: 1,
      error: "x".repeat(5000),
    });
    expect(ok).toBe(true);
    expect(calls[0]).toMatchObject({ table: "weekly_update_log", op: "insert" });
    const row = calls[0].payload as Record<string, unknown>;
    expect(row).toMatchObject({ week_of: WEEK, triggered_by: "cron", status: "partial", source: "draft", recipients_count: 3, succeeded_count: 2, failed_count: 1 });
    expect((row.error as string).length).toBe(4000);
  });

  it("reads the insert's { error } — a rejected row is logged and reported, never silent", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { admin } = fakeAdmin({
      "weekly_update_log:insert": [{ error: { message: 'relation "weekly_update_log" does not exist' } }],
    });
    const ok = await recordWeeklyUpdateAttempt(admin, { weekOf: WEEK, triggeredBy: "manual", status: "sent" });
    expect(ok).toBe(false);
    expect(err).toHaveBeenCalledTimes(1);
    expect(String(err.mock.calls[0][0])).toContain("weekly_update_log");
  });

  it("never throws into the send path", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const admin = { from: () => { throw new Error("client exploded"); } } as unknown as SupabaseClient;
    await expect(recordWeeklyUpdateAttempt(admin, { weekOf: WEEK, triggeredBy: "cron", status: "failed" })).resolves.toBe(false);
  });
});

describe("hasSuccessfulWeeklyUpdate", () => {
  it("is true on a sent/partial log row", async () => {
    const { admin } = fakeAdmin({
      "weekly_update_log:select": [{ data: [{ id: "row" }] }],
      "farm_settings:select": [{ data: [] }],
    });
    expect(await hasSuccessfulWeeklyUpdate(admin, WEEK)).toBe(true);
  });

  it("ignores the sent-week stamp (it is written BEFORE the sends, so it proves intent, not delivery)", async () => {
    const { admin } = fakeAdmin({
      "weekly_update_log:select": [{ data: [] }],
      "farm_settings:select": [{ data: [{ key: "weekly_update_last_sent_week", value: WEEK }] }],
    });
    expect(await hasSuccessfulWeeklyUpdate(admin, WEEK)).toBe(false);
  });

  it("is false with no row and a stamp for another week", async () => {
    const { admin } = fakeAdmin({
      "weekly_update_log:select": [{ data: [] }],
      "farm_settings:select": [{ data: [{ key: "weekly_update_last_sent_week", value: "2026-10-19" }] }],
    });
    expect(await hasSuccessfulWeeklyUpdate(admin, WEEK)).toBe(false);
  });

  it("assumes success when the log query itself errors (a muted watchdog is worse)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { admin } = fakeAdmin({
      "weekly_update_log:select": [{ data: null, error: { message: "timeout" } }],
      "farm_settings:select": [{ data: [] }],
    });
    expect(await hasSuccessfulWeeklyUpdate(admin, WEEK)).toBe(true);
  });
});

describe("farm_settings helpers", () => {
  it("readFarmSettings maps key → value and treats null as empty", async () => {
    const { admin } = fakeAdmin({
      "farm_settings:select": [{ data: [{ key: "a", value: "1" }, { key: "b", value: null }] }],
    });
    expect(await readFarmSettings(admin, ["a", "b", "c"])).toEqual({ a: "1", b: "" });
  });

  it("upsertFarmSetting resolves the farm id and upserts on (farm_id, key)", async () => {
    const { admin, calls } = fakeAdmin({
      "farms:select": [{ data: { id: "farm-1" } }],
      "farm_settings:upsert": [{ error: null }],
    });
    expect(await upsertFarmSetting(admin, "weekly_digest_last_sent_week", "2026-10-26")).toBe(true);
    const up = calls.find((c) => c.op === "upsert");
    expect(up?.payload).toEqual({ farm_id: "farm-1", key: "weekly_digest_last_sent_week", value: "2026-10-26" });
    expect(up?.opts).toEqual({ onConflict: "farm_id,key" });
  });

  it("upsertFarmSetting reports (not throws) a failed write", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { admin } = fakeAdmin({
      "farms:select": [{ data: { id: "farm-1" } }],
      "farm_settings:upsert": [{ error: { message: "permission denied" } }],
    });
    expect(await upsertFarmSetting(admin, "k", null)).toBe(false);
    const noFarm = fakeAdmin({ "farms:select": [{ data: null }] });
    expect(await upsertFarmSetting(noFarm.admin, "k", "v")).toBe(false);
  });
});
