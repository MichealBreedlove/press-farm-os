-- 044_drop_unused_indexes.sql
-- Drop indexes flagged by the perf linter as never-scanned (pg_stat_user_indexes
-- shows 0 idx_scan since stats were last reset).
--
-- Verified safe to drop because each parent table is small enough that the
-- planner correctly prefers a seq scan. Row counts at time of writing:
--   crop_plan_entries 549, farm_expenses 128, items 336, restaurants 4,
--   restaurant_users 4, suggestions 4, planting_tasks 5, farms 1,
--   labor_entries 1, plantings 1, receiver_notify_log 1, farm_notes 0,
--   event_requests 0, notifications 0, price_history 0
--
-- Index rebuild statements are included at the bottom as commented rollback
-- in case a future workload makes one of these useful again.
--
-- NOT dropped (deserve a second look, kept for a follow-up):
--   - idx_availability_items_delivery_date (2316 rows; date-range queries plausible)
--   - idx_order_items_composite (composite suggests intentional optimization)
--   - idx_items_unit_prices (JSONB index on items.unit_prices, 336 rows)
--   - reporting.send_log_target_month_idx (reporting may be cron-driven, low signal)

-- Single-tenant farm_id indexes (every row has farm_id=1)
drop index if exists public.idx_farm_expenses_farm;
drop index if exists public.idx_crop_plan_entries_farm;
drop index if exists public.idx_farm_notes_farm;
drop index if exists public.idx_labor_entries_farm;
drop index if exists public.idx_plantings_farm;
drop index if exists public.idx_restaurants_farm;
drop index if exists public.idx_suggestions_farm;

-- Tiny-cardinality indexes
drop index if exists public.idx_restaurant_users_restaurant;
drop index if exists public.idx_planting_tasks_due;

-- Plantings (1 row)
drop index if exists public.idx_plantings_item;
drop index if exists public.idx_plantings_dates;

-- Price history (0 rows)
drop index if exists public.idx_price_history_set_by;
drop index if exists public.idx_price_history_date;

-- Notifications (0 rows)
drop index if exists public.idx_notifications_type;
drop index if exists public.idx_notifications_sent_at;

-- Receiver notify log (1 row)
drop index if exists public.idx_notify_log_sent_at;
drop index if exists public.idx_receiver_notify_log_sent_by;

-- Event requests (0 rows — Events pseudo-restaurant uses different tables)
drop index if exists public.idx_event_requests_group;
drop index if exists public.idx_event_requests_chef;
drop index if exists public.idx_event_requests_item;
drop index if exists public.idx_event_requests_order_item;
drop index if exists public.idx_event_requests_responded_by;

-- ─────────────────────────────────────────────────────────────────────────────
-- Rollback (uncomment + run if a regression appears):
-- ─────────────────────────────────────────────────────────────────────────────
-- create index idx_farm_expenses_farm           on public.farm_expenses(farm_id);
-- create index idx_crop_plan_entries_farm       on public.crop_plan_entries(farm_id);
-- create index idx_farm_notes_farm              on public.farm_notes(farm_id);
-- create index idx_labor_entries_farm           on public.labor_entries(farm_id);
-- create index idx_plantings_farm               on public.plantings(farm_id);
-- create index idx_restaurants_farm             on public.restaurants(farm_id);
-- create index idx_suggestions_farm             on public.suggestions(farm_id);
-- create index idx_restaurant_users_restaurant  on public.restaurant_users(restaurant_id);
-- create index idx_planting_tasks_due           on public.planting_tasks(due_date);
-- create index idx_plantings_item               on public.plantings(item_id);
-- create index idx_plantings_dates              on public.plantings(planted_date, expected_harvest_date);
-- create index idx_price_history_set_by         on public.price_history(set_by);
-- create index idx_price_history_date           on public.price_history(recorded_at);
-- create index idx_notifications_type           on public.notifications(type);
-- create index idx_notifications_sent_at        on public.notifications(sent_at);
-- create index idx_notify_log_sent_at           on public.receiver_notify_log(sent_at);
-- create index idx_receiver_notify_log_sent_by  on public.receiver_notify_log(sent_by);
-- create index idx_event_requests_group         on public.event_requests(group_id);
-- create index idx_event_requests_chef          on public.event_requests(chef_id);
-- create index idx_event_requests_item          on public.event_requests(item_id);
-- create index idx_event_requests_order_item    on public.event_requests(order_item_id);
-- create index idx_event_requests_responded_by  on public.event_requests(responded_by);
