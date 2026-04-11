import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
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

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  // Quick stats for the header
  const { count: pendingOrders } = await (admin as any)
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("status", "submitted");

  const { data: nextDate } = await (admin as any)
    .from("delivery_dates")
    .select("date")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(1)
    .single();

  const nextDeliveryDate = nextDate?.date;
  const nextDeliveryLabel = nextDeliveryDate
    ? new Date(nextDeliveryDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : null;

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
      ],
    },
  ];

  return (
    <main className="pb-24">
      <header className="page-header">
        <h1 className="page-title">Dashboard</h1>
        {nextDeliveryLabel && (
          <p className="text-sm text-green-200 mt-1">
            Next delivery: <span className="font-medium text-white">{nextDeliveryLabel}</span>
          </p>
        )}
      </header>

      <div className="px-4 py-5 space-y-6">
        {sections.map((section) => (
          <div key={section.title}>
            <h2 className="font-display text-sm text-gray-500 uppercase tracking-wider mb-3">
              {section.title}
            </h2>
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
