import { redirect } from "next/navigation";

/**
 * /admin/orders/explorer — folded into /admin/orders?view=explore.
 * Kept as a redirect so bookmarks and old links keep working.
 */
export default async function OrderExplorerRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  qs.set("view", "explore");
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val) qs.set(k, val);
  }
  redirect(`/admin/orders?${qs.toString()}`);
}
