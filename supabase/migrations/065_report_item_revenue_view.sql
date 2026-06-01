-- ============================================================================
-- Press Farm OS — Migration 065: report_item_revenue view
-- ----------------------------------------------------------------------------
-- /admin/reports and /admin/reports/executive each fetched the ENTIRE
-- delivery_items table (joined to items) and rolled up per-item revenue/qty in
-- JavaScript. delivery_items is the largest, fastest-growing table (~3 rows ×
-- every delivery line, forever), so those pages transferred and CPU-summed the
-- full line-item history on every view.
--
-- This view does the GROUP BY in Postgres. The pages now read one row per item
-- (~hundreds) instead of every line item (thousands+). The aggregation is
-- identical to the old JS: SUM(line_total) and SUM(quantity) per item, inner-
-- joined to items (rows with no matching item were skipped in JS via the
-- `if (!di.items) continue` guard — the inner JOIN matches that exactly).
--
-- security_invoker = on so the view respects the caller's RLS (matches the
-- migration-064 hardening). The reports pages read it via the service-role
-- client, which is unaffected.
--
-- Run in the SQL editor BEFORE merging the paired code change, or the reports
-- pages will 500 with "relation report_item_revenue does not exist":
--   https://supabase.com/dashboard/project/rxdfjaseilmjvcwamqyk/sql/new
-- ============================================================================

CREATE OR REPLACE VIEW public.report_item_revenue
WITH (security_invoker = on) AS
SELECT
  di.item_id,
  i.name,
  i.category,
  i.unit_type,
  SUM(di.line_total) AS total_revenue,
  SUM(di.quantity)   AS total_qty
FROM public.delivery_items di
JOIN public.items i ON i.id = di.item_id
GROUP BY di.item_id, i.name, i.category, i.unit_type;

-- Rollback:
--   DROP VIEW IF EXISTS public.report_item_revenue;
