import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseMock } from "../../helpers/supabase-mock";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { createAdminClient } = await import("@/lib/supabase/admin");
const { createClient } = await import("@/lib/supabase/server");
const { POST } = await import("@/app/api/microgreens/trays/bulk-lost/route");

describe("POST /api/microgreens/trays/bulk-lost", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks every listed active tray as lost with the reason", async () => {
    const sb = makeSupabaseMock({
      profiles: [{ id: "test-admin", role: "admin" }],
      microgreen_trays: [
        { id: "t1", status: "blackout", lost_reason: null },
        { id: "t2", status: "light", lost_reason: null },
        { id: "t3", status: "harvesting", lost_reason: null },
      ],
    });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/trays/bulk-lost", {
      method: "POST",
      body: JSON.stringify({ tray_ids: ["t1", "t2", "t3"], lost_reason: "Damping off disease" }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.updated).toBe(3);
    expect(sb._data.microgreen_trays.every((t: any) => t.status === "lost")).toBe(true);
    expect(sb._data.microgreen_trays.every((t: any) => t.lost_reason === "Damping off disease")).toBe(true);
  });

  it("skips trays already in a terminal state", async () => {
    const sb = makeSupabaseMock({
      profiles: [{ id: "test-admin", role: "admin" }],
      microgreen_trays: [
        { id: "t1", status: "blackout", lost_reason: null },
        { id: "t2", status: "terminated", lost_reason: null },
        { id: "t3", status: "lost", lost_reason: "Mold" },
      ],
    });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/trays/bulk-lost", {
      method: "POST",
      body: JSON.stringify({ tray_ids: ["t1", "t2", "t3"], lost_reason: "Damping off" }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(body.updated).toBe(1);
    expect(sb._data.microgreen_trays.find((t: any) => t.id === "t2")!.status).toBe("terminated");
    expect(sb._data.microgreen_trays.find((t: any) => t.id === "t3")!.lost_reason).toBe("Mold");
  });

  it("returns 400 when tray_ids is empty", async () => {
    const sb = makeSupabaseMock({ profiles: [{ id: "test-admin", role: "admin" }] });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/trays/bulk-lost", {
      method: "POST",
      body: JSON.stringify({ tray_ids: [], lost_reason: "X" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when lost_reason is missing", async () => {
    const sb = makeSupabaseMock({ profiles: [{ id: "test-admin", role: "admin" }] });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/trays/bulk-lost", {
      method: "POST",
      body: JSON.stringify({ tray_ids: ["t1"] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when lost_reason is only whitespace", async () => {
    const sb = makeSupabaseMock({ profiles: [{ id: "test-admin", role: "admin" }] });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/trays/bulk-lost", {
      method: "POST",
      body: JSON.stringify({ tray_ids: ["t1"], lost_reason: "   " }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 403 when not admin", async () => {
    const sb = makeSupabaseMock({});
    sb.auth.getUser = vi.fn(async () => ({ data: { user: null }, error: null })) as any;
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/trays/bulk-lost", {
      method: "POST",
      body: JSON.stringify({ tray_ids: ["t1"], lost_reason: "x" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});
