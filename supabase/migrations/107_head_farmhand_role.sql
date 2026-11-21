-- 107: Head Farm Hand role
--
-- 'head_farmhand' — a read-only farm task board (/farm-tasks): what the
-- farm hands are working on, one step at a time, English + Spanish — the
-- same board the receiver sees, with nothing else around it. First account:
-- Peter Jacobsen (created 2026-11-21).
--
-- Only the CHECK constraint changes; the page reads through the
-- service-role client behind a server-side role gate.
-- Applied 2026-11-21 via the Supabase MCP.

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'chef', 'receiver', 'harvester', 'liaison', 'head_farmhand'));
