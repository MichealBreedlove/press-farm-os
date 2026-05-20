import { describe, it, expect, vi } from "vitest";
import { makeSupabaseMock } from "../../helpers/supabase-mock";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { createAdminClient } = await import("@/lib/supabase/admin");
const { createClient } = await import("@/lib/supabase/server");
const { GET } = await import("@/app/api/microgreens/sow-plan/route");

describe("GET /api/microgreens/sow-plan", () => {
  it("returns a plan with sow_today/advance_today/harvest_today buckets", async () => {
    const sb = makeSupabaseMock({
      microgreen_crops: [],
      microgreen_demand: [],
      microgreen_batches: [],
      microgreen_trays: [],
      delivery_dates: [],
      delivery_items: [],
    });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/sow-plan");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.plan).toHaveProperty("sow_today");
    expect(body.plan).toHaveProperty("advance_today");
    expect(body.plan).toHaveProperty("harvest_today");
    expect(body.plan).toHaveProperty("overdue");
    expect(body.plan).toHaveProperty("warnings");
  });
});
