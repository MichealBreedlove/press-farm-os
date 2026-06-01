-- ============================================================================
-- Press Farm OS — Migration 064: Security advisor fixes
-- ----------------------------------------------------------------------------
-- Clears three Supabase database-linter findings. All three objects are only
-- ever touched server-side via the service-role client (which bypasses RLS and
-- retains EXECUTE), so these changes do NOT affect the app's behavior — they
-- only close access for the anon / authenticated roles and pin search_path.
--
-- Run in the SQL editor: https://supabase.com/dashboard/project/rxdfjaseilmjvcwamqyk/sql/new
-- Requires PostgreSQL 15+ (security_invoker views). The project is on PG15.
-- ============================================================================

-- 1) seeds_with_on_hand was a SECURITY DEFINER view (lint 0010): it ran with
--    the view owner's privileges, bypassing the seeds RLS for any caller.
--    The app reads it only through createAdminClient() (service role), so
--    switching to security_invoker is transparent here and makes a non-admin
--    caller correctly subject to the admin-only seeds RLS instead.
ALTER VIEW public.seeds_with_on_hand SET (security_invoker = on);

-- 2) match_inbound_sender (lint 0028/0029): a SECURITY DEFINER function still
--    executable by anon / authenticated via /rest/v1/rpc. It is called only by
--    the inbound webhook handler through the service-role client, so revoke the
--    PostgREST-exposed roles. (Migration 060 already revoked PUBLIC + granted
--    service_role; Supabase default grants re-added anon/authenticated.)
REVOKE EXECUTE ON FUNCTION public.match_inbound_sender(text) FROM anon, authenticated;

-- 3) slide_recurring_anchor (lint 0011): trigger function with a role-mutable
--    search_path. It references public.items + now() (pg_catalog), so pin the
--    path to public — same pattern match_inbound_sender already uses.
ALTER FUNCTION public.slide_recurring_anchor() SET search_path = public;

-- ----------------------------------------------------------------------------
-- Not addressable in SQL — toggle in the dashboard:
--   Leaked Password Protection (HaveIBeenPwned) — Authentication → Policies →
--   "Leaked password protection" → enable.
--   https://supabase.com/dashboard/project/rxdfjaseilmjvcwamqyk/auth/policies
-- ----------------------------------------------------------------------------

-- Rollback (only if a regression appears):
--   ALTER VIEW public.seeds_with_on_hand SET (security_invoker = off);
--   GRANT EXECUTE ON FUNCTION public.match_inbound_sender(text) TO anon, authenticated;
--   ALTER FUNCTION public.slide_recurring_anchor() RESET search_path;
