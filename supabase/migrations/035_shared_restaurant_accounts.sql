-- 035_shared_restaurant_accounts.sql
-- Wires up the 5 shared accounts after the admin creates them in
-- Supabase's Auth dashboard. Idempotent — safe to re-run.
--
-- PREREQUISITE: in Supabase Auth (Dashboard → Authentication → Users
-- → Add user), create these 5 users with email + password:
--
--   press@pressnapavalley.com         → Press kitchen
--   understudy@pressnapavalley.com    → Under-Study kitchen
--   pressbar@pressnapavalley.com      → Press Bar
--   events@pressnapavalley.com        → Events team
--   receiver@pressnapavalley.com      → Receiver (sees all restaurants)
--
-- The handle_new_user trigger from migration 003 auto-creates a
-- profiles row with role='chef' for each new auth user. This migration
-- bumps the receiver's role to 'receiver' and links the 4 restaurant
-- accounts to their respective restaurants via restaurant_users.

-- ── Promote receiver from default 'chef' role ──
UPDATE profiles
SET role = 'receiver',
    full_name = COALESCE(NULLIF(full_name, ''), 'Receiver')
WHERE id = (SELECT id FROM auth.users WHERE email = 'receiver@pressnapavalley.com');

-- ── Link each restaurant account to its restaurant ──
WITH accounts AS (
  SELECT * FROM (VALUES
    ('press@pressnapavalley.com',      'Press'),
    ('understudy@pressnapavalley.com', 'Under-Study'),
    ('pressbar@pressnapavalley.com',   'Press Bar'),
    ('events@pressnapavalley.com',     'Events')
  ) AS t(email, restaurant_name)
),
matched AS (
  SELECT u.id AS user_id, r.id AS restaurant_id
  FROM accounts a
  JOIN auth.users u ON u.email = a.email
  JOIN restaurants r ON LOWER(r.name) = LOWER(a.restaurant_name)
)
INSERT INTO restaurant_users (user_id, restaurant_id)
SELECT user_id, restaurant_id FROM matched
ON CONFLICT (user_id, restaurant_id) DO NOTHING;

-- ── Patch profile display names ──
WITH accounts AS (
  SELECT * FROM (VALUES
    ('press@pressnapavalley.com',      'Press Kitchen'),
    ('understudy@pressnapavalley.com', 'Under-Study Kitchen'),
    ('pressbar@pressnapavalley.com',   'Press Bar'),
    ('events@pressnapavalley.com',     'Events Team')
  ) AS t(email, full_name)
)
UPDATE profiles p
SET full_name = a.full_name
FROM accounts a, auth.users u
WHERE u.email = a.email
  AND p.id = u.id
  AND (p.full_name IS NULL OR p.full_name = '');

-- ── Verification: should return 5 rows after a successful run ──
SELECT
  u.email,
  p.role,
  p.full_name,
  r.name AS assigned_restaurant
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
LEFT JOIN restaurant_users ru ON ru.user_id = u.id
LEFT JOIN restaurants r ON r.id = ru.restaurant_id
WHERE u.email IN (
  'press@pressnapavalley.com',
  'understudy@pressnapavalley.com',
  'pressbar@pressnapavalley.com',
  'events@pressnapavalley.com',
  'receiver@pressnapavalley.com'
)
ORDER BY u.email;
