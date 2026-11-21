import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SetPasswordForm } from "./SetPasswordForm";

export const dynamic = "force-dynamic";

/**
 * /set-password — where an account flagged `must_change_password` lands
 * after signing in with its starter password. Anyone not flagged is sent
 * on to their portal.
 */
export default async function SetPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role, must_change_password")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.must_change_password) redirect("/");

  return <SetPasswordForm defaultLang={profile.role === "harvester" ? "es" : "en"} />;
}
