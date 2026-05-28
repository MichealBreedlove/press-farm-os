import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseMock } from "../../helpers/supabase-mock";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { createAdminClient } = await import("@/lib/supabase/admin");
const { createClient } = await import("@/lib/supabase/server");
const { DELETE } = await import("@/app/api/microgreens/trays/[id]/route");

describe("DELETE /api/microgreens/trays/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes a tray with no harvests", async () => {
    const sb = makeSupabaseMock({
      profiles: [{ id: "test-admin", role: "admin" }],
      microgreen_trays: [{ id: "t1", status: "blackout" }],
      microgreen_harvests: [],
    });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/trays/t1", { method: "DELETE" });
    const res = await DELETE(req, { params: { id: "t1" } });

    expect(res.status).toBe(200);
    expect(sb._data.microgreen_trays).toHaveLength(0);
  });

  it("refuses delete when tray has harvest events", async () => {
    const sb = makeSupabaseMock({
      profiles: [{ id: "test-admin", role: "admin" }],
      microgreen_trays: [{ id: "t1", status: "harvesting" }],
      microgreen_harvests: [{ id: "h1", tray_id: "t1", yield_oz: 5 }],
    });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/trays/t1", { method: "DELETE" });
    const res = await DELETE(req, { params: { id: "t1" } });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/harvest events/i);
    expect(sb._data.microgreen_trays).toHaveLength(1);
  });

  it("returns 403 when not admin", async () => {
    const sb = makeSupabaseMock({});
    sb.auth.getUser = vi.fn(async () => ({ data: { user: null }, error: null })) as any;
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/trays/t1", { method: "DELETE" });
    const res = await DELETE(req, { params: { id: "t1" } });
    expect(res.status).toBe(403);
  });
});
