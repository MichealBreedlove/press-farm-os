import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface TaskPerson {
  id: string;
  name: string;
  role: "admin" | "harvester" | "head_farmhand";
}

/**
 * People a farm task can be assigned to: the farm owner (admin), the Head
 * Farm Hand, and every active farm hand. Owner first, then the rest by name.
 */
export async function listTaskPeople(admin: AdminClient): Promise<TaskPerson[]> {
  const { data } = await admin
    .from("profiles")
    .select("id, full_name, role, is_active")
    .in("role", ["admin", "harvester", "head_farmhand"]);
  return ((data ?? []) as any[])
    .filter((p) => p.is_active !== false)
    .map((p) => ({
      id: p.id as string,
      name: (p.full_name as string | null)?.trim() || (p.role === "admin" ? "Farm owner" : "Farm hand"),
      role: p.role as "admin" | "harvester" | "head_farmhand",
    }))
    .sort((a, b) => {
      const aOwner = a.role === "admin";
      const bOwner = b.role === "admin";
      return aOwner === bOwner ? a.name.localeCompare(b.name) : aOwner ? -1 : 1;
    });
}

/** The farm owner automated tasks default to (the first admin). */
export function ownerOf(people: TaskPerson[]): TaskPerson | null {
  return people.find((p) => p.role === "admin") ?? null;
}

/**
 * Validates a list of assignees from a request body. Empty / missing = for
 * anyone (or the owner, for an automated task). Every id must be a real
 * assignable person; `ownerOnly` (microgreen tasks) allows only the owner.
 */
export async function resolveAssignees(
  admin: AdminClient,
  value: unknown,
  opts: { ownerOnly?: boolean } = {},
): Promise<{ ok: true; ids: string[] } | { ok: false }> {
  if (value === null || value === undefined || value === "") return { ok: true, ids: [] };
  const list = Array.isArray(value) ? value : [value];
  if (list.some((v) => typeof v !== "string")) return { ok: false };
  const ids = Array.from(new Set((list as string[]).filter(Boolean)));
  if (ids.length === 0) return { ok: true, ids: [] };
  const people = await listTaskPeople(admin);
  const allowed = new Set((opts.ownerOnly ? people.filter((p) => p.role === "admin") : people).map((p) => p.id));
  return ids.every((id) => allowed.has(id)) ? { ok: true, ids } : { ok: false };
}

/** Validates an `assigned_to` from a request body: null, or a real assignable person. */
export async function resolveAssignee(
  admin: AdminClient,
  value: unknown,
  opts: { ownerOnly?: boolean } = {},
): Promise<{ ok: true; id: string | null } | { ok: false }> {
  if (value === null || value === undefined || value === "") return { ok: true, id: null };
  if (typeof value !== "string") return { ok: false };
  const people = await listTaskPeople(admin);
  // Microgreen tasks (`ownerOnly`) can never go to a farm hand.
  const allowed = opts.ownerOnly ? people.filter((p) => p.role === "admin") : people;
  return allowed.some((p) => p.id === value) ? { ok: true, id: value } : { ok: false };
}
