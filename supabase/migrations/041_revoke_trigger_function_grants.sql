-- 041_revoke_trigger_function_grants.sql
-- Trigger functions are owner-executed; they don't need to be RPC-callable.
-- Strip EXECUTE from PUBLIC/anon/authenticated so they're not exposed via PostgREST RPC.
-- Triggers continue to fire normally because they run as the table owner.

REVOKE EXECUTE ON FUNCTION public.update_delivery_total() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at()     FROM PUBLIC, anon, authenticated;

-- Verify: service_role retains EXECUTE; nothing else does.
-- (Run after apply if you want a sanity check:)
-- SELECT grantee, privilege_type FROM information_schema.routine_privileges
-- WHERE routine_schema='public' AND routine_name IN ('update_delivery_total','update_updated_at');
