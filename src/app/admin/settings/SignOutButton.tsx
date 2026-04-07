"use client";

import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <button
      onClick={handleSignOut}
      className="flex items-center justify-between w-full card-interactive px-4 py-4 text-left"
    >
      <div>
        <p className="text-sm font-semibold text-red-600">Sign Out</p>
        <p className="text-xs text-gray-400 mt-0.5">Sign out of Press Farm OS</p>
      </div>
      <LogOut className="w-5 h-5 text-red-400 flex-shrink-0" />
    </button>
  );
}
