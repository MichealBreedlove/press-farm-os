import { describe, it, expect, vi } from "vitest";
import { makeSupabaseMock } from "../../helpers/supabase-mock";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { createAdminClient } = await import("@/lib/supabase/admin");
const { createClient } = await import("@/lib/supabase/server");
const { POST } = await import("@/app/api/microgreens/harvests/route");

describe("POST /api/microgreens/harvests", () => {
  it("creates a harvest event and moves single-cut tray to terminated", async () => {
    const sb = makeSupabaseMock({
      profiles: [{ id: "test-admin", role: "admin" }],
      microgreen_trays: [{ id: "t1", batch_id: "b1", status: "light", sow_date: "2026-05-07" }],
      microgreen_batches: [{ id: "b1", crop_id: "c1" }],
      microgreen_crops: [{ id: "c1", is_continuous_harvest: false }],
      microgreen_harvests: [],
    });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/x", {
      method: "POST",
      body: JSON.stringify({ tray_id: "t1", yield_oz: 8 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(sb._data.microgreen_harvests).toHaveLength(1);
    expect(sb._data.microgreen_trays[0].status).toBe("terminated");
  });

  it("for continuous-harvest, leaves tray in 'harvesting'", async () => {
    const sb = makeSupabaseMock({
      profiles: [{ id: "test-admin", role: "admin" }],
      microgreen_trays: [{ id: "t1", batch_id: "b1", status: "light", sow_date: "2026-04-20" }],
      microgreen_batches: [{ id: "b1", crop_id: "c1" }],
      microgreen_crops: [{ id: "c1", is_continuous_harvest: true, productive_life_days: 30 }],
      microgreen_harvests: [],
    });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/x", {
      method: "POST",
      body: JSON.stringify({ tray_id: "t1", yield_oz: 3 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(sb._data.microgreen_trays[0].status).toBe("harvesting");
  });
});
