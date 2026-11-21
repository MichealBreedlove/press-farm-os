-- 103: Force a password change at next sign-in
--
-- `profiles.must_change_password` — when true the account is sent to
-- /set-password after signing in and cannot reach its portal until it has
-- picked a new password (POST /api/account/password clears the flag).
-- Used to hand a farm hand a simple starter password ("Radish") that only
-- works once.
--
-- Additive. Applied 2026-11-21 via the Supabase MCP, with Luis's account
-- flagged. Rollback: ALTER TABLE profiles DROP COLUMN must_change_password;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
