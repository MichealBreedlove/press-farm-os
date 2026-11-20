import { LiaisonNav } from "@/components/shared/LiaisonNav";
import { requireLiaisonPage } from "@/lib/liaison/server";

export const dynamic = "force-dynamic";

/**
 * Farm Liaison portal — a deliberately small dashboard for the
 * restaurant-side liaison: Home, Order (the chef order form, under Press),
 * Production (what the farm delivered, in quantity and dollars) and Farm
 * Tasks (to do / accomplished). Read-only apart from ordering.
 */
export default async function LiaisonLayout({ children }: { children: React.ReactNode }) {
  await requireLiaisonPage();
  return (
    <>
      {children}
      <LiaisonNav />
    </>
  );
}
