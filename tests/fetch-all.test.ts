import { describe, it, expect } from "vitest";
import { fetchAllRows } from "@/lib/fetch-all";

/** Simulates PostgREST range paging over a fixed row set. */
function pagedSource(total: number, failAtPage?: number) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  let calls = 0;
  const buildQuery = async (from: number, to: number) => {
    calls++;
    if (failAtPage !== undefined && calls === failAtPage) {
      return { data: null, error: new Error("boom") };
    }
    return { data: rows.slice(from, to + 1), error: null };
  };
  return { buildQuery, callCount: () => calls };
}

describe("fetchAllRows", () => {
  it("returns everything past the 1,000-row page size in one flat list", async () => {
    // The availability-editor incident shape: 4 restaurants × 293 items.
    const src = pagedSource(1172);
    const { data, error } = await fetchAllRows(src.buildQuery);
    expect(error).toBeNull();
    expect(data).toHaveLength(1172);
    expect(data[1171]).toEqual({ id: 1171 });
    expect(src.callCount()).toBe(2);
  });

  it("stops after one call when the first page is short", async () => {
    const src = pagedSource(293);
    const { data } = await fetchAllRows(src.buildQuery);
    expect(data).toHaveLength(293);
    expect(src.callCount()).toBe(1);
  });

  it("makes an extra call when the total is an exact page multiple", async () => {
    const src = pagedSource(2000);
    const { data } = await fetchAllRows(src.buildQuery);
    expect(data).toHaveLength(2000);
    expect(src.callCount()).toBe(3);
  });

  it("returns an empty list for an empty source", async () => {
    const src = pagedSource(0);
    const { data, error } = await fetchAllRows(src.buildQuery);
    expect(data).toEqual([]);
    expect(error).toBeNull();
  });

  it("surfaces a page error instead of silently returning a partial set as complete", async () => {
    const src = pagedSource(1500, 2);
    const { data, error } = await fetchAllRows(src.buildQuery);
    expect(error).toBeInstanceOf(Error);
    expect(data).toHaveLength(1000);
  });

  it("respects a custom page size", async () => {
    const src = pagedSource(25);
    const { data } = await fetchAllRows(src.buildQuery, 10);
    expect(data).toHaveLength(25);
    expect(src.callCount()).toBe(3);
  });
});
