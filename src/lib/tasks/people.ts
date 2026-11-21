import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface TaskPerson {
  id: string;
  name: string;
  role: "admin" | "harvester";
}

/**
 * People a farm task can be assigned to: the farm owner (admin) and every
 * active farm hand. Owner first, then farm hands by name.
 */
export async function listTaskPeople(admin: AdminClient): Promise<TaskPerson[]> {
  const { data } = await admin
    .from("profiles")
    .select("id, full_name, role, is_active")
    .in("role", ["admin", "harvester"]);
  return ((data ?? []) as any[])
    .filter((p) => p.is_active !== false)
    .map((p) => ({
      id: p.id as string,
      name: (p.full_name as string | null)?.trim() || (p.role === "admin" ? "Farm owner" : "Farm hand"),
      role: p.role as "admin" | "harvester",
    }))
    .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "admin" ? -1 : 1));
}

/** The farm owner automated tasks default to (the first admin). */
export function ownerOf(people: TaskPerson[]): TaskPerson | null {
  return people.find((p) => p.role === "admin") ?? null;
}

/** Validates an `assigned_to` from a request body: null, or a real assignable person. */
export async function resolveAssignee(
  admin: AdminClient,
  value: unknown,
): Promise<{ ok: true; id: string | null } | { ok: false }> {
  if (value === null || value === undefined || value === "") return { ok: true, id: null };
  if (typeof value !== "string") return { ok: false };
  const people = await listTaskPeople(admin);
  return people.some((p) => p.id === value) ? { ok: true, id: value } : { ok: false };
}
