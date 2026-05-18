import { describe, it, expect, vi } from "vitest";
import { makeSupabaseMock } from "../../helpers/supabase-mock";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { createAdminClient } = await import("@/lib/supabase/admin");
const { createClient } = await import("@/lib/supabase/server");
const { POST } = await import("@/app/api/microgreens/batches/route");

describe("POST /api/microgreens/batches", () => {
  it("creates a batch + N trays", async () => {
    const sb = makeSupabaseMock({
      microgreen_crops: [{
        id: "c1", name: "Broccoli", presoak_hours: 0, presprout_hours: 0,
        blackout_days: 3, ideal_harvest_day: 10, keep_in_blackout: false,
      }],
      microgreen_batches: [],
      microgreen_trays: [],
    });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/batches", {
      method: "POST",
      body: JSON.stringify({
        crop_id: "c1", sow_date: "2026-05-17", tray_count: 4,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(sb._data.microgreen_trays).toHaveLength(4);
    expect(sb._data.microgreen_trays[0].tray_label).toBe("BR-0517-01");
    expect(sb._data.microgreen_trays[3].tray_label).toBe("BR-0517-04");
    expect(sb._data.microgreen_trays[0].status).toBe("blackout"); // no soak
  });

  it("uses 'soaking' status when crop has presoak_hours > 0", async () => {
    const sb = makeSupabaseMock({
      microgreen_crops: [{
        id: "c1", name: "Pea Shoot", presoak_hours: 8, presprout_hours: 18,
        blackout_days: 3, ideal_harvest_day: 10, keep_in_blackout: false,
      }],
    });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/batches", {
      method: "POST",
      body: JSON.stringify({ crop_id: "c1", sow_date: "2026-05-17", tray_count: 2 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(sb._data.microgreen_trays[0].status).toBe("soaking");
  });
});
