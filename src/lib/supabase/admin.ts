import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service role (admin) Supabase client.
 * BYPASSES RLS — use only in server-side code for admin operations:
 * - Sending notifications
 * - Excel data imports
 * - Privileged admin actions
 *
 * NEVER expose this client or the service role key to the browser.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
