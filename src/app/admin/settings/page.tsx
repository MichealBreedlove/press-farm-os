import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SignOutButton } from "./SignOutButton";

interface NavCard {
  href: string;
  title: string;
  description: string;
}

const NAV_CARDS: NavCard[] = [
  { href: "/admin/settings/users", title: "User Management", description: "Invite chefs, manage accounts, assign restaurants" },
  { href: "/admin/settings/emails", title: "Email Settings", description: "Configure email addresses for notifications and reminders" },
  { href: "/admin/settings/import", title: "Data Import", description: "Import items and delivery history from Excel" },
];

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="pb-24">
      <header className="page-header">
        <h1 className="page-title">Settings</h1>
      </header>

      <div className="px-4 py-6 space-y-3">
        {NAV_CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="flex items-center justify-between card-interactive px-4 py-4"
          >
            <div>
              <p className="text-sm font-semibold text-farm-dark">{card.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{card.description}</p>
            </div>
            <svg className="w-5 h-5 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}

        <div className="pt-2">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
