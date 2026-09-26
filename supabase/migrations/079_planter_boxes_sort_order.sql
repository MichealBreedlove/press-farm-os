-- 079: walking-order sort for planter boxes (applied 2026-09-26 via the Supabase MCP).
-- The list page sorted by name, which put G before ST before U and U10 before U2.
-- Order: U1–U23 (Understudy wooden boxes) → ST1–ST22 (stock tanks) → G1–G4 (grape tanks).
alter table public.planter_boxes add column if not exists sort_order integer;

update public.planter_boxes set sort_order = case
  when name ~ '^U[0-9]+$'  then substring(name from 2)::int
  when name ~ '^ST[0-9]+$' then 100 + substring(name from 3)::int
  when name ~ '^G[0-9]+$'  then 200 + substring(name from 2)::int
end
where sort_order is null;

create index if not exists planter_boxes_sort_order_idx on public.planter_boxes (sort_order);

-- Rollback: drop index planter_boxes_sort_order_idx; alter table public.planter_boxes drop column sort_order;
