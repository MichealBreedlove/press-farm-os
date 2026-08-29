/**
 * Paginated fetch past Supabase's silent 1,000-row response cap.
 *
 * PostgREST truncates any un-ranged select at max-rows (1,000 on our
 * project) WITHOUT an error — the caller just gets the first 1,000 rows.
 * A fully published delivery date now carries ~1,170 availability rows
 * (every catalog item × 4 restaurants), so date-wide reads silently lose
 * the tail (incident 2026-08-28: the availability editor loaded a
 * truncated set, seeded the missing rows "unavailable", and Save wrote
 * Press out with 7 orderable items instead of 29).
 *
 * Callers MUST give the query a stable ORDER BY (e.g. `.order("id")`) —
 * range pagination over an unordered select can repeat or skip rows.
 */
export async function fetchAllRows<T = any>(
  buildQuery: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
): Promise<{ data: T[]; error: unknown }> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);
    if (error) return { data: all, error };
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) return { data: all, error: null };
  }
}
