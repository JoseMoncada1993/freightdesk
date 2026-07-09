-- 0019: Freight route optimizer. Applied live 2026-07-08 as "routes_optimizer".
-- Saved multi-stop routes. stops = ordered jsonb array of
-- { label, zip, city, state, lat, lon }. RLS mirrors shipments.

create table if not exists public.routes (
  id bigint generated always as identity primary key,
  name text not null,
  stops jsonb not null default '[]'::jsonb,
  round_trip boolean not null default false,
  total_miles numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.routes enable row level security;

create policy "routes_select_all" on public.routes
  for select to authenticated using (true);
create policy "routes_insert_dispatch" on public.routes
  for insert to authenticated with check (public.my_role() in ('admin','dispatcher'));
create policy "routes_update_dispatch" on public.routes
  for update to authenticated
  using (public.my_role() in ('admin','dispatcher'))
  with check (public.my_role() in ('admin','dispatcher'));
create policy "routes_delete_dispatch" on public.routes
  for delete to authenticated using (public.my_role() in ('admin','dispatcher'));
