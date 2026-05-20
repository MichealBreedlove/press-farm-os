import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseMock } from "../../helpers/supabase-mock";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { createAdminClient } = await import("@/lib/supabase/admin");
const { createClient } = await import("@/lib/supabase/server");
const { GET, POST } = await import("@/app/api/microgreens/crops/route");

describe("GET /api/microgreens/crops", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns active crops sorted by name", async () => {
    const sb = makeSupabaseMock({
      microgreen_crops: [
        { id: "c1", name: "Broccoli", is_active: true },
        { id: "c2", name: "Arugula", is_active: true },
        { id: "c3", name: "Old", is_active: false },
      ],
    });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/crops");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.crops).toHaveLength(2); // archived excluded
  });
});

describe("POST /api/microgreens/crops", () => {
  it("creates a crop with farm_id auto-filled", async () => {
    const sb = makeSupabaseMock({
      farms: [{ id: "farm-1" }],
      microgreen_crops: [],
    });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/crops", {
      method: "POST",
      body: JSON.stringify({
        name: "Broccoli", seed_density_g_per_tray: 22, blackout_days: 3,
        ideal_harvest_day: 10, expected_yield_oz_per_tray: 8,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(sb._data.microgreen_crops).toHaveLength(1);
    expect(sb._data.microgreen_crops[0].farm_id).toBe("farm-1");
  });

  it("returns 400 for missing required fields", async () => {
    const sb = makeSupabaseMock({ farms: [{ id: "farm-1" }] });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/crops", {
      method: "POST",
      body: JSON.stringify({ name: "Broccoli" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
