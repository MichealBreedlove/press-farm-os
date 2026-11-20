-- 100: Farm Liaison role
--
-- Adds a fifth role 'liaison' — the restaurant-side farm liaison. Their
-- portal is /liaison: a simple dashboard with three pages —
--   - ordering   (the existing chef order form, under Press)
--   - production (what the farm delivered, in quantity and dollars, plus the
--                 microgreens that are ready / growing)
--   - farm tasks (what needs doing, what was accomplished — read-only)
--
-- Only the CHECK constraint changes. No new policies or helpers:
--   - ordering works through the existing chef RLS, which is keyed on
--     restaurant_users membership (private.user_restaurant_ids()), not on
--     the role — the users API links a liaison account to Press;
--   - the liaison pages read through the service-role client behind a
--     server-side role gate (same pattern as /receiver and /harvest).
--
-- Applied 2026-11-20 via the Supabase MCP.
--
-- Rollback (only once no profile has role 'liaison'):
--   ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
--   ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
--     CHECK (role IN ('admin', 'chef', 'receiver', 'harvester'));

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'chef', 'receiver', 'harvester', 'liaison'));
