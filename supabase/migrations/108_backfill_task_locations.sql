-- 108: DATA — location for the open tasks whose place was only in the text
--
-- The job-list and recurring-sow tasks carried their place inside the
-- description ("Where: Quadrant 1, rows 4-5."). Copied into the location
-- fields (migration 106) for the 11 tasks open on 2026-11-21:
--   - Salanova / romaine "sow in trays" (3)  → Greenhouse
--   - Radish recurring (3)                   → Farm · Q1 · rows 4-5
--   - Turnip recurring (2)                   → Farm · Q1 · rows 6-7
--   - Move the Salanova into the ground      → Farm · Q3 · rows 5-6
--   - Plant the garlic (its quadrant has no number) → Farm · rows 1-14
--   - Frost cloth over the succulent boxes   → Farm
-- Left blank: wild-mushroom foraging (off the farm).
-- Future recurring radish / turnip tasks get theirs from the item's sow
-- notes (parseLocationFromText in src/lib/tasks/location.ts).
-- Applied 2026-11-21 via the Supabase MCP.
-- Rollback: set the three location columns back to NULL for these ids.

UPDATE farm_tasks t SET location_place = v.place, location_quadrant = v.quad, location_rows = v.rows, updated_at = now()
FROM (VALUES
  ('06ad92be-617b-4a42-942f-af9e354118f7'::uuid, 'greenhouse', NULL::smallint, NULL::text),
  ('c6fe631a-5d6d-4619-9850-222086d47fd4'::uuid, 'greenhouse', NULL, NULL),
  ('07abcbea-c4ad-4187-a28e-8c2fcdc0f8e5'::uuid, 'greenhouse', NULL, NULL),
  ('50b04566-7cd4-45cd-b927-a2379a7f6cb1'::uuid, 'farm', 1, '4-5'),
  ('3f2a385f-97bc-4131-92ff-bfc2444e6ef8'::uuid, 'farm', 1, '4-5'),
  ('9efb42b9-09cf-49fe-b1c4-b7d3d74792a3'::uuid, 'farm', 1, '4-5'),
  ('348b9cb7-ba89-4ce0-ba16-433bf72e3dc9'::uuid, 'farm', 1, '6-7'),
  ('f32b7682-c128-4b6e-860c-671b5ab81332'::uuid, 'farm', 1, '6-7'),
  ('352d1319-5bb0-433b-a3cf-0243231f39db'::uuid, 'farm', 3, '5-6'),
  ('d1da31f4-bcc4-40da-b827-b260073aad10'::uuid, 'farm', NULL, '1-14'),
  ('2e816d52-af6b-4e19-aa82-ed3b8a11d37f'::uuid, 'farm', NULL, NULL)
) AS v(id, place, quad, rows)
WHERE t.id = v.id AND t.location_place IS NULL;
