-- 098: Farm-hand task list — photos, Spanish text, who finished it
--
-- The harvester account becomes the "Farm Hand" account (same `harvester`
-- role — no auth / RLS change): its /harvest portal gains a bilingual Tasks
-- tab where the crew sees every open farm task and marks it finished.
--
--   photo_urls      pictures Micheal attaches when creating a task ("this
--                   area, this is what needs doing"). Public URLs in the
--                   item-photos bucket under tasks/.
--   title_es /      Spanish text for the crew. Filled automatically on
--   description_es  create/edit (Claude) and editable; NULL = fall back to
--                   the English text (or the inline "ES:" part older
--                   descriptions carry).
--   completed_by    who marked it finished (admin or farm hand).
--
-- No new policies: farm hands read + complete through role-gated API routes
-- and the server page, both using the service-role client (same pattern as
-- the harvest pick list). Additive only; safe to apply before the code ships.
--
-- Rollback:
--   ALTER TABLE farm_tasks DROP COLUMN photo_urls, DROP COLUMN title_es,
--     DROP COLUMN description_es, DROP COLUMN completed_by;

ALTER TABLE farm_tasks
  ADD COLUMN IF NOT EXISTS photo_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS title_es text,
  ADD COLUMN IF NOT EXISTS description_es text,
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
