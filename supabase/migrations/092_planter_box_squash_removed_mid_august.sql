-- 092 — DATA FIX: U16 + U18 Squash ended mid-August (Micheal, 2026-10-11).
--
-- Both restaurant-bed squash plantings were pulled in mid-August but were still
-- `active` through 2026-11-22, so they kept projecting value and kept
-- pre-filling the planter list. Same handling as 085's removals: status
-- 'removed', end_date 2026-08-15, and — because they are annuals whose
-- value_amount spreads over planted..end_date — the total is prorated to the
-- days actually grown ($1,080.00 → $752.02 each; 227 of 326 days).
-- Old value kept in notes. Data-only; re-running is a no-op (matches
-- status = 'active').

UPDATE planter_box_plantings p
SET status       = 'removed',
    end_date     = DATE '2026-08-15',
    value_amount = CASE
      WHEN p.lifecycle = 'annual' AND p.end_date > DATE '2026-08-15'
        THEN round(p.value_amount
                   * ((DATE '2026-08-15' - p.planted_date) + 1)
                   / ((p.end_date - p.planted_date) + 1), 2)
      ELSE p.value_amount
    END,
    notes = concat_ws(E'\n', p.notes,
              'Removed mid-August, recorded 2026-10-11 (migration 092); was $' || p.value_amount
              || ' through ' || coalesce(p.end_date::text, 'open') || '.')
FROM planter_boxes b
WHERE p.box_id = b.id
  AND b.name IN ('U16', 'U18')
  AND p.name = 'Squash'
  AND p.status = 'active';

INSERT INTO planter_box_activity (box_id, logged_at, note)
SELECT b.id, DATE '2026-10-11', 'Squash removed mid-August (migration 092); bed empty'
FROM planter_boxes b
WHERE b.name IN ('U16', 'U18')
  AND NOT EXISTS (
    SELECT 1 FROM planter_box_activity a
    WHERE a.box_id = b.id AND a.note LIKE 'Squash removed mid-August (migration 092)%'
  );
