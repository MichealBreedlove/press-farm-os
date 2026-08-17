-- 075: Weekly update send log
--
-- Until now the chef-facing Monday update left NO durable trace when it
-- failed. `weekly_update_last_sent_week` is only stamped on success, so a
-- failed send and a cron that never fired are indistinguishable after the
-- fact — the only record was a console.error line in the Vercel runtime
-- log, which ages out and nobody reads. That is exactly how the
-- 2026-08-17 miss went unnoticed until a human asked.
--
-- This table records EVERY attempt (cron or manual), including the ones
-- that send nothing, so "did Monday's update go out?" is answerable from
-- the database alone.
--
-- Written by the service-role client only. RLS mirrors receiver_notify_log:
-- admins read, nobody else sees it. Service role bypasses RLS entirely.

CREATE TABLE IF NOT EXISTS weekly_update_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The Monday the update covers (same anchor as weekly_update_last_sent_week).
  week_of date NOT NULL,
  -- 'cron' = Vercel schedule, 'manual' = Send Now on /admin/weekly-update.
  triggered_by text NOT NULL CHECK (triggered_by IN ('cron', 'manual')),
  -- sent    = every recipient accepted
  -- partial = at least one accepted, at least one failed
  -- failed  = zero accepted (Resend rejected all, or the send threw)
  -- skipped = deliberately did nothing (already sent this week, no recipients)
  status text NOT NULL CHECK (status IN ('sent', 'partial', 'failed', 'skipped')),
  -- Which content won: an explicit admin edit, this week's saved draft, or a
  -- fresh live build. NULL when the run skipped before resolving content.
  source text CHECK (source IN ('edited', 'draft', 'live')),
  recipients_count integer NOT NULL DEFAULT 0,
  succeeded_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  -- Failure detail, or the reason a run skipped. NULL on a clean send.
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The watchdog asks "is there a successful row for this week's Monday?" on
-- every run, and the admin UI reads the newest rows first.
CREATE INDEX IF NOT EXISTS weekly_update_log_week_of_idx
  ON weekly_update_log (week_of DESC, created_at DESC);

ALTER TABLE weekly_update_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS weekly_update_log_admin_select ON weekly_update_log;
CREATE POLICY weekly_update_log_admin_select ON weekly_update_log
  FOR SELECT TO authenticated
  USING (private.is_admin());
