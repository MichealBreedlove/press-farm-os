import Link from "next/link";
import { ChevronRight, ClipboardList, ListChecks, Sprout } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { SignOutButton } from "@/components/shared/SignOutButton";
import { PwaInstallPrompt } from "@/components/shared/PwaInstallPrompt";
import { MicrogreensCard } from "@/components/shared/MicrogreensCard";
import {
  loadMicrogreenStatus,
  loadOrderableMicrogreens,
  loadProductionSummary,
  requireLiaisonPage,
} from "@/lib/liaison/server";
import { loadTaskBoard } from "@/lib/tasks/board";
import { formatCurrencyWhole, formatDeliveryDate, todayPacific } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * /liaison — Farm Liaison home. Three doors (Order, Production, Farm
 * Tasks), each with the one number that matters, plus the microgreens that
 * are available right now.
 */
export default async function LiaisonHome() {
  const me = await requireLiaisonPage();
  const admin = createAdminClient();
  const today = todayPacific();

  const [production, board, micro, orderable] = await Promise.all([
    loadProductionSummary(admin, today),
    loadTaskBoard(admin, today, { doneDays: 7 }),
    loadMicrogreenStatus(admin),
    loadOrderableMicrogreens(admin, today),
  ]);

  const doors = [
    {
      href: "/order",
      Icon: ClipboardList,
      title: "Order from the farm",
      line: orderable.date
        ? `Next delivery ${formatDeliveryDate(orderable.date)}${orderable.orderingOpen ? "" : " · ordering closed"}`
        : "No delivery date is open yet",
      sub: "Orders are placed under Press",
    },
    {
      href: "/liaison/production",
      Icon: Sprout,
      title: "Production",
      line: `${formatCurrencyWhole(production.thisMonth.total)} delivered this month`,
      sub: `${production.thisMonth.lines} products across ${production.thisMonth.deliveries} ${
        production.thisMonth.deliveries === 1 ? "delivery" : "deliveries"
      }`,
    },
    {
      href: "/liaison/tasks",
      Icon: ListChecks,
      title: "Farm tasks",
      line: `${board.todo.length} to do · ${board.done.length} accomplished this week`,
      sub: `${board.upcoming.length} coming up in the next two weeks`,
    },
  ];

  return (
    <main id="main" className="min-h-screen pb-28 bg-farm-cream">
      <PwaInstallPrompt />
      <EditorialHero
        eyebrow="Farm Liaison"
        title="Press Farm"
        subtitle={me.fullName ? `Welcome, ${me.fullName}` : "What's happening at the farm"}
        flower="borage"
      />

      <div className="px-4 py-6 max-w-3xl mx-auto space-y-6">
        <nav aria-label="Liaison pages" className="space-y-3">
          {doors.map(({ href, Icon, title, line, sub }) => (
            <Link key={href} href={href} className="card-interactive flex items-center gap-4 p-4 min-h-[88px]">
              <span className="w-12 h-12 rounded-full bg-farm-green/10 text-farm-green flex items-center justify-center flex-shrink-0">
                <Icon className="w-6 h-6" aria-hidden="true" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-display text-xl text-farm-dark leading-tight">{title}</span>
                <span className="block text-sm font-semibold text-farm-dark mt-1">{line}</span>
                <span className="block text-xs text-farm-muted mt-0.5">{sub}</span>
              </span>
              <ChevronRight className="w-5 h-5 text-farm-muted flex-shrink-0" aria-hidden="true" />
            </Link>
          ))}
        </nav>

        <MicrogreensCard status={micro} orderable={orderable} />

        <div>
          <p className="section-eyebrow text-farm-muted mb-2">Account</p>
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
