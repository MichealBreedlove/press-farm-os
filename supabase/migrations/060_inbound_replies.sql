-- Migration 060: Inbound reply capture
--
-- Renumbered from 047 → 059 → 060 to avoid collisions with three other
-- migrations that shipped on main while this was in flight:
-- 047_fix_nasturtium_leaves_miscategorization, 047_microgreens_units, and
-- 059_items_seasonal_months.
--
-- Also uses `private.is_admin()` (not bare `is_admin()`) — the function was
-- moved to the `private` schema in an intermediate migration and bare calls
-- now fail with "function is_admin() does not exist".
--
-- New table:
--   inbound_messages — raw chef replies captured via Resend Inbound webhook
--                      at replies@pressfarm.io. Idempotent by resend_message_id.
--
-- Extends:
--   suggestions — adds `source` ('manual' | 'email_reply') and `inbound_message_id`
--                 FK so item requests parsed from replies can link back to the
--                 originating email.

CREATE TABLE IF NOT EXISTS inbound_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,

  -- Envelope
  resend_message_id text UNIQUE NOT NULL,
  from_email text NOT NULL,
  from_name text,
  to_email text NOT NULL,
  subject text,
  received_at timestamptz NOT NULL,

  -- Body
  text_body text,
  html_body text,
  in_reply_to text,

  -- Best-effort match by sender email
  matched_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  matched_restaurant_id uuid REFERENCES restaurants(id) ON DELETE SET NULL,

  -- Triage state (independent from extraction state)
  status text NOT NULL DEFAULT 'unread'
    CHECK (status IN ('unread', 'read', 'archived')),

  -- LLM extraction state
  extraction_status text NOT NULL DEFAULT 'pending'
    CHECK (extraction_status IN ('pending', 'done', 'failed', 'skipped')),
  extraction_error text,
  extracted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Inbox list query: farm + status filter ordered by recency
CREATE INDEX IF NOT EXISTS inbound_messages_farm_status_received_idx
  ON inbound_messages(farm_id, status, received_at DESC);

ALTER TABLE inbound_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access to inbound messages" ON inbound_messages;
CREATE POLICY "Admin full access to inbound messages"
  ON inbound_messages FOR ALL
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

DROP TRIGGER IF EXISTS update_inbound_messages_updated_at ON inbound_messages;
CREATE TRIGGER update_inbound_messages_updated_at
  BEFORE UPDATE ON inbound_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Extend suggestions ────────────────────────────────────────────────

ALTER TABLE suggestions
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'email_reply')),
  ADD COLUMN IF NOT EXISTS inbound_message_id uuid
    REFERENCES inbound_messages(id) ON DELETE SET NULL;

-- Partial index so the FK back-link query stays cheap; only ~few suggestions
-- per inbound message and most suggestions are manual so a full index would
-- be mostly empty.
CREATE INDEX IF NOT EXISTS suggestions_inbound_message_idx
  ON suggestions(inbound_message_id)
  WHERE inbound_message_id IS NOT NULL;

-- ─── Sender match RPC ─────────────────────────────────────────────────
--
-- The inbound webhook needs to map a sender email to a (user_id, restaurant_id)
-- pair. Email lives on auth.users (not profiles), which the supabase-js client
-- can't reach via PostgREST. SECURITY DEFINER lets us read auth.users and
-- join restaurant_users for the inbound webhook in one round-trip.
CREATE OR REPLACE FUNCTION match_inbound_sender(p_email text)
RETURNS TABLE(user_id uuid, restaurant_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id AS user_id,
    ru.restaurant_id
  FROM auth.users u
  LEFT JOIN restaurant_users ru ON ru.user_id = u.id
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION match_inbound_sender(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION match_inbound_sender(text) TO service_role;
