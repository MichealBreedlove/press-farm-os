-- 025: Receiver-notify audit log
--
-- Records each time admin fires the "Finish & Send to Receiver" button so we
-- can:
--   - answer "did I already send today's email?" without checking Resend
--   - warn before accidental re-sends within a short window
--   - surface a history of who notified whom on which date
--
-- One row per notify *event* — not per recipient. Recipient details live in
-- the email service (Resend) and don't need to be duplicated here.

CREATE TABLE IF NOT EXISTS receiver_notify_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_date date NOT NULL,
  sent_by uuid NOT NULL REFERENCES profiles(id),
  sent_at timestamptz NOT NULL DEFAULT now(),
  -- How many active receivers the admin fired the email at
  recipients_count integer NOT NULL DEFAULT 0,
  -- How many of those got a Resend "sent" status (the rest may have failed)
  succeeded_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  -- How many orders flipped to 'fulfilled' as part of this send
  fulfilled_orders_count integer NOT NULL DEFAULT 0,
  -- Snapshot of the status counts the email contained
  ready_count integer NOT NULL DEFAULT 0,
  short_count integer NOT NULL DEFAULT 0,
  pending_count integer NOT NULL DEFAULT 0,
  extra_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notify_log_date ON receiver_notify_log(delivery_date);
CREATE INDEX IF NOT EXISTS idx_notify_log_sent_at ON receiver_notify_log(sent_at DESC);

-- RLS — admin sees everything, receivers can read their own delivery-date
-- entries (so the receiver dashboard could show "last notified at HH:MM"
-- in a future iteration).
ALTER TABLE receiver_notify_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin manages receiver_notify_log' AND tablename = 'receiver_notify_log') THEN
    CREATE POLICY "Admin manages receiver_notify_log" ON receiver_notify_log
      FOR ALL USING (is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Receivers can read receiver_notify_log' AND tablename = 'receiver_notify_log') THEN
    CREATE POLICY "Receivers can read receiver_notify_log" ON receiver_notify_log
      FOR SELECT USING (is_receiver());
  END IF;
END $$;
