import { describe, it, expect } from "vitest";
import { makeSupabaseMock } from "./supabase-mock";

describe("supabase-mock", () => {
  it("returns seeded rows", async () => {
    const sb = makeSupabaseMock({ items: [{ id: "1", name: "Broccoli" }] });
    const { data } = await sb.from("items").select("*");
    expect(data).toEqual([{ id: "1", name: "Broccoli" }]);
  });

  it("filters with eq", async () => {
    const sb = makeSupabaseMock({ items: [{ id: "1", name: "A" }, { id: "2", name: "B" }] });
    const { data } = await sb.from("items").select("*").eq("name", "B");
    expect(data).toEqual([{ id: "2", name: "B" }]);
  });
});
