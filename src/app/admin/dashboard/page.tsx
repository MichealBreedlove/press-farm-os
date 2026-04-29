import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { SendDigestButton } from "./SendDigestButton";
import { RefreshButton } from "./RefreshButton";
import {
  ClipboardList,
  CalendarDays,
  PackageOpen,
  BarChart3,
  Leaf,
  Clock,
  DollarSign,
  FileText,
  Users,
  Upload,
  Settings,
  Sprout,
} from "lucide-react";

interface DashCard {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];
  const currentMonth = today.slice(0, 7);
  const monthStart = `${currentMonth}-01`;
  const [y, m] = currentMonth.split("-").map(Number);
  const monthEnd = `${currentMonth}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;

  // Parallel data fetches for stats
  const [
    { count: pendingOrders },
    { data: nextDate },
    { data: monthDeliveries },
    { data: monthExpenses },
    { data: weekLabor },
  ] = await Promise.all([
    (admin as any).from("orders").select("*", { count: "exact", head: true }).eq("status", "submitted"),
    (admin as any).from("delivery_dates").select("date").gte("date", today).order("date", { ascending: true }).limit(1).single(),
    (admin as any).from("deliveries").select("total_value").gte("delivery_date", monthStart).lte("delivery_date", monthEnd),
    (admin as any).from("farm_expenses").select("amount").gte("date", monthStart).lte("date", monthEnd),
    (admin as any).from("labor_entries").select("hours").gte("date", (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split("T")[0]; })()),
  ]);

  const nextDeliveryDate = nextDate?.date;
  const nextDeliveryLabel = nextDeliveryDate
    ? new Date(nextDeliveryDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : null;

  const monthRevenue = (monthDeliveries ?? []).reduce((s: number, d: any) => s + (d.total_value ?? 0), 0);
  const monthExpenseTotal = (monthExpenses ?? []).reduce((s: number, e: any) => s + (e.amount ?? 0), 0);
  const weekLaborHours = (weekLabor ?? []).reduce((s: number, l: any) => s + (l.hours ?? 0), 0);

  const sections: { title: string; cards: DashCard[] }[] = [
    {
      title: "Daily Operations",
      cards: [
        { href: "/admin/orders", title: "Orders", description: `${pendingOrders ?? 0} pending`, icon: <ClipboardList className="w-5 h-5" />, color: "bg-blue-500" },
        { href: "/admin/availability", title: "Availability", description: "Set what's available", icon: <CalendarDays className="w-5 h-5" />, color: "bg-farm-green" },
        { href: "/admin/deliveries", title: "Deliveries", description: "Log & calendar", icon: <PackageOpen className="w-5 h-5" />, color: "bg-amber-500" },
      ],
    },
    {
      title: "Farm Management",
      cards: [
        { href: "/admin/items", title: "Items", description: "Catalog & photos", icon: <Leaf className="w-5 h-5" />, color: "bg-green-600" },
        { href: "/admin/crop-plan", title: "Crop Plan", description: "Seasonal schedule", icon: <Sprout className="w-5 h-5" />, color: "bg-lime-600" },
        { href: "/admin/labor", title: "Labor", description: "Track hours", icon: <Clock className="w-5 h-5" />, color: "bg-purple-500" },
        { href: "/admin/expenses", title: "Expenses", description: "Track costs", icon: <DollarSign className="w-5 h-5" />, color: "bg-red-500" },
        { href: "/admin/notes", title: "Notes", description: "Field observations", icon: <FileText className="w-5 h-5" />, color: "bg-cyan-500" },
        { href: "/admin/packs", title: "Pack Manager", description: "Container inventory", icon: <PackageOpen className="w-5 h-5" />, color: "bg-orange-500" },
        { href: "/admin/forecast", title: "Forecast", description: "Predict next harvest", icon: <BarChart3 className="w-5 h-5" />, color: "bg-blue-500" },
      ],
    },
    {
      title: "Reports & Analytics",
      cards: [
        { href: "/admin/reports", title: "Reports", description: "Revenue & P&L", icon: <BarChart3 className="w-5 h-5" />, color: "bg-farm-green" },
        { href: "/admin/reports/executive", title: "Executive", description: "Print summary", icon: <BarChart3 className="w-5 h-5" />, color: "bg-gray-800" },
      ],
    },
    {
      title: "Settings",
      cards: [
        { href: "/admin/settings/users", title: "Users", description: "Manage accounts", icon: <Users className="w-5 h-5" />, color: "bg-gray-500" },
        { href: "/admin/settings/import", title: "Import", description: "Excel data", icon: <Upload className="w-5 h-5" />, color: "bg-gray-500" },
        { href: "/admin/settings", title: "Settings", description: "App config", icon: <Settings className="w-5 h-5" />, color: "bg-gray-500" },
        { href: "/admin/ui-kit", title: "UI Kit", description: "Brand reference", icon: <Leaf className="w-5 h-5" />, color: "bg-gray-500" },
      ],
    },
  ];

  const monthName = new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long" });

  return (
    <main className="pb-24">
      <header className="page-header">
        <h1 className="page-title">Dashboard</h1>
        {nextDeliveryLabel && (
          <p className="text-sm text-green-200 mt-0.5">
            Next delivery: <span className="font-medium text-white">{nextDeliveryLabel}</span>
          </p>
        )}
      </header>

      <div className="px-4 py-5 space-y-6">
        {/* Live stats */}
        <div className="flex items-center justify-between">
          <p className="section-eyebrow with-flower text-farm-muted">{monthName} Overview</p>
          <RefreshButton />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link href={`/admin/deliveries?month=${currentMonth}`} className="card-interactive p-4 relative overflow-hidden">
            <img src="/assets/pressfarm/flowers/calendula.png" alt="" aria-hidden="true" className="absolute -top-3 -right-3 w-20 h-20 opacity-25 pointer-events-none" />
            <p className="text-xs text-gray-400 relative">{monthName} Revenue</p>
            <p className="text-2xl font-bold text-farm-green mt-1 relative">{formatCurrency(monthRevenue)}</p>
            <p className="text-[10px] text-gray-400 mt-1 relative">{(monthDeliveries ?? []).length} deliveries</p>
          </Link>
          <Link href={`/admin/expenses?month=${currentMonth}`} className="card-interactive p-4 relative overflow-hidden">
            <img src="/assets/pressfarm/flowers/thyme.png" alt="" aria-hidden="true" className="absolute -top-3 -right-3 w-20 h-20 opacity-25 pointer-events-none" />
            <p className="text-xs text-gray-400 relative">{monthName} Expenses</p>
            <p className="text-2xl font-bold text-red-500 mt-1 relative">{formatCurrency(monthExpenseTotal)}</p>
            <p className="text-[10px] text-gray-400 mt-1 relative">{(monthExpenses ?? []).length} entries</p>
          </Link>
          <Link href="/admin/orders?status=submitted" className="card-interactive p-4 relative overflow-hidden">
            <img src="/assets/pressfarm/flowers/borage.png" alt="" aria-hidden="true" className="absolute -top-3 -right-3 w-20 h-20 opacity-25 pointer-events-none" />
            <p className="text-xs text-gray-400 relative">Pending Orders</p>
            <p className="text-2xl font-bold text-blue-600 mt-1 relative">{pendingOrders ?? 0}</p>
            <p className="text-[10px] text-gray-400 mt-1 relative">awaiting fulfillment</p>
          </Link>
          <Link href="/admin/labor" className="card-interactive p-4 relative overflow-hidden">
            <img src="/assets/pressfarm/flowers/lavender.png" alt="" aria-hidden="true" className="absolute -top-3 -right-3 w-20 h-20 opacity-25 pointer-events-none" />
            <p className="text-xs text-gray-400 relative">Labor (7 days)</p>
            <p className="text-2xl font-bold text-purple-600 mt-1 relative">{weekLaborHours.toFixed(1)}h</p>
            <p className="text-[10px] text-gray-400 mt-1 relative">this week</p>
          </Link>
        </div>

        {/* Quick actions */}
        <SendDigestButton />

        {sections.map((section) => (
          <div key={section.title}>
            <p className="section-eyebrow text-farm-muted mb-3">{section.title}</p>
            <div className="grid grid-cols-2 gap-3">
              {section.cards.map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  className="card-interactive p-4 flex flex-col gap-3"
                >
                  <div className={`w-9 h-9 rounded-lg ${card.color} text-white flex items-center justify-center`}>
                    {card.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-farm-dark">{card.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{card.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
