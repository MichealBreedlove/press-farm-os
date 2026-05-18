import { describe, it, expect, vi } from "vitest";
import { makeSupabaseMock } from "../../helpers/supabase-mock";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { createAdminClient } = await import("@/lib/supabase/admin");
const { createClient } = await import("@/lib/supabase/server");
const { POST } = await import("@/app/api/microgreens/trays/[id]/advance/route");

describe("POST /api/microgreens/trays/:id/advance", () => {
  it("advances blackout -> light and sets light_start", async () => {
    const sb = makeSupabaseMock({
      microgreen_trays: [{
        id: "t1", batch_id: "b1", status: "blackout",
        sow_date: "2026-05-14", blackout_start: "2026-05-14",
      }],
      microgreen_batches: [{ id: "b1", crop_id: "c1" }],
      microgreen_crops: [{
        id: "c1", name: "Broccoli", keep_in_blackout: false,
        blackout_days: 3, ideal_harvest_day: 10,
      }],
    });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/x", { method: "POST" });
    const res = await POST(req, { params: { id: "t1" } });
    expect(res.status).toBe(200);
    const tray = sb._data.microgreen_trays[0];
    expect(tray.status).toBe("light");
    expect(tray.light_start).toBeTruthy();
  });
});
