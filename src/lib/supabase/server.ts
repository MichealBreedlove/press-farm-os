import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Server-side Supabase client using anon key.
 * Use in Server Components, Server Actions, and Route Handlers.
 * Respects RLS — user's session is read from cookies.
 *
 * Explicit return type annotation required to resolve TypeScript generic
 * inference issue between @supabase/ssr and @supabase/supabase-js versions.
 */
export async function createClient(): Promise<SupabaseClient<Database, "public", Database["public"]>> {
  const cookieStore = await cookies();

  return createServerClient<Database, "public", Database["public"]>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method is called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
}
