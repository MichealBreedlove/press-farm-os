-- 072: Tray-termination income distribution
--
-- ALREADY APPLIED to prod via the Supabase MCP (2026-07-05) as migration
-- "tray_termination_value_distribution" — this file documents it in the repo
-- so the schema source of truth stays here. Do NOT re-run blindly; everything
-- is idempotent-ish (IF NOT EXISTS / CREATE OR REPLACE) but the intent is
-- documentation.
--
-- When a tray of a continuous-harvest crop (e.g. Nasturtium) is terminated,
-- its dollar value is distributed as delivery line items spread evenly across
-- ALL deliveries of the crop's farm in a chosen month (e.g. terminate in early
-- July, distribute into June so it counts as June income).
-- deliveries.total_value auto-recalculates via the existing
-- recalc_delivery_total trigger, so only line items are inserted.

-- Provenance/undo: which tray a distributed line item came from.
alter table public.delivery_items
  add column if not exists source_tray_id uuid
    references public.microgreen_trays(id) on delete set null;

create index if not exists delivery_items_source_tray_idx
  on public.delivery_items (source_tray_id)
  where source_tray_id is not null;

-- Terminate a continuous-harvest tray and distribute its value evenly (in
-- cents; the last delivery absorbs rounding) across all deliveries of the
-- crop's farm in the target month. SECURITY INVOKER — RLS makes it admin-only.
create or replace function public.terminate_tray_and_distribute(
  p_tray_id uuid,
  p_target_month date,
  p_value_override numeric default null
) returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_tray public.microgreen_trays%rowtype;
  v_crop public.microgreen_crops%rowtype;
  v_value numeric;
  v_month_start date := date_trunc('month', p_target_month)::date;
  v_month_end date := (date_trunc('month', p_target_month) + interval '1 month')::date;
  v_deliveries uuid[];
  v_n integer;
  v_share numeric;
  v_last_share numeric;
  v_i integer;
begin
  select * into v_tray from public.microgreen_trays where id = p_tray_id for update;
  if not found then
    raise exception 'Tray % not found', p_tray_id;
  end if;

  select c.* into v_crop
  from public.microgreen_batches b
  join public.microgreen_crops c on c.id = b.crop_id
  where b.id = v_tray.batch_id;
  if not found then
    raise exception 'No crop found for tray %', p_tray_id;
  end if;

  if not coalesce(v_crop.is_continuous_harvest, false) then
    raise exception 'Crop "%" is not a continuous-harvest crop; use the normal terminate flow', v_crop.name;
  end if;

  if v_crop.item_id is null then
    raise exception 'Crop "%" has no linked delivery item (items.id); link one before distributing', v_crop.name;
  end if;

  v_value := coalesce(p_value_override, v_crop.value_per_tray);
  if v_value is null or v_value <= 0 then
    raise exception 'No value to distribute: set value_per_tray on crop "%" or pass a value override', v_crop.name;
  end if;

  if exists (select 1 from public.delivery_items where source_tray_id = p_tray_id) then
    raise exception 'Tray % already has a distribution; run undo_tray_distribution first', p_tray_id;
  end if;

  select array_agg(d.id order by d.delivery_date, d.created_at) into v_deliveries
  from public.deliveries d
  join public.restaurants r on r.id = d.restaurant_id
  where r.farm_id = v_crop.farm_id
    and d.delivery_date >= v_month_start
    and d.delivery_date < v_month_end;

  v_n := coalesce(array_length(v_deliveries, 1), 0);
  if v_n = 0 then
    raise exception 'No deliveries found in % to distribute into', to_char(v_month_start, 'FMMonth YYYY');
  end if;

  -- Even split, rounded to cents; the last delivery absorbs the rounding remainder.
  v_share := trunc(v_value / v_n, 2);
  v_last_share := v_value - v_share * (v_n - 1);

  for v_i in 1..v_n loop
    insert into public.delivery_items (delivery_id, item_id, quantity, unit, unit_price, source_tray_id, bonus_note)
    values (
      v_deliveries[v_i],
      v_crop.item_id,
      1,
      'ea',
      case when v_i = v_n then v_last_share else v_share end,
      p_tray_id,
      'Tray termination distribution: ' || coalesce(v_tray.tray_label, p_tray_id::text)
    );
  end loop;

  update public.microgreen_trays
  set status = 'terminated',
      terminated_at = coalesce(terminated_at, now())
  where id = p_tray_id;

  return jsonb_build_object(
    'tray_id', p_tray_id,
    'tray_label', v_tray.tray_label,
    'crop', v_crop.name,
    'distributed_value', v_value,
    'month', to_char(v_month_start, 'YYYY-MM'),
    'deliveries_count', v_n,
    'per_delivery_share', v_share,
    'last_delivery_share', v_last_share
  );
end;
$function$;

-- Undo: delete a tray's distributed line items (delivery totals recalc via
-- trigger). The tray stays terminated; it can be re-distributed afterwards.
create or replace function public.undo_tray_distribution(p_tray_id uuid)
returns integer
language plpgsql
set search_path to 'public'
as $function$
declare
  v_count integer;
begin
  delete from public.delivery_items where source_tray_id = p_tray_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

-- Data fix shipped with the applied migration (documented here, already live):
--   microgreen_crops 'Nasturtium' → item_id = '51465d80-117d-44b3-b833-72e11fafd3cd',
--   value_per_tray = 1000 (corrected to 500 on 2026-07-05 per Micheal — the
--   live June 2026 distributions were redone at $500/tray, $3,000 total).
