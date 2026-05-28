import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseMock } from "../../helpers/supabase-mock";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { createAdminClient } = await import("@/lib/supabase/admin");
const { createClient } = await import("@/lib/supabase/server");
const { GET, POST } = await import("@/app/api/microgreens/demand/route");

describe("POST /api/microgreens/demand", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a demand row", async () => {
    const sb = makeSupabaseMock({
      profiles: [{ id: "test-admin", role: "admin" }],
      microgreen_demand: [],
    });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/demand", {
      method: "POST",
      body: JSON.stringify({
        crop_id: "c1", restaurant_id: "r1",
        day_of_week: 4, target_oz: 16,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(sb._data.microgreen_demand).toHaveLength(1);
  });

  it("rejects out-of-range day_of_week", async () => {
    const sb = makeSupabaseMock({
      profiles: [{ id: "test-admin", role: "admin" }],
    });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/demand", {
      method: "POST",
      body: JSON.stringify({ crop_id: "c1", day_of_week: 9, target_oz: 5 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/microgreens/demand", () => {
  it("returns all demand rows", async () => {
    const sb = makeSupabaseMock({
      profiles: [{ id: "test-admin", role: "admin" }],
      microgreen_demand: [
        { id: "d1", crop_id: "c1", restaurant_id: "r1", day_of_week: 4, target_oz: 8 },
      ],
    });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/demand");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.demand).toHaveLength(1);
  });
});
