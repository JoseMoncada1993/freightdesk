-- 0016: Sam's Club vendor inventory tracker.
-- Applied live on 2026-07-07 as "sams_club_pallets".
--
-- Mirrors the vendor's "Pallet Id tracker" spreadsheet: one row per physical
-- pallet, keyed by pallet_id (unique), with SKU, club (store location), status,
-- delivery date and notes/tracking. CSV imports upsert on pallet_id.
-- RLS: read = all authenticated; write = admin/dispatcher/warehouse;
-- delete = admin/dispatcher (mirrors the ops-module matrix in 0014).

create table if not exists public.sams_pallets (
  id bigint generated always as identity primary key,
  pallet_id text not null unique,
  sku text,
  club text,
  status text,            -- Need to Schedule | Pending | Scheduled | Delivered
  delivery_date date,
  notes text,             -- Notes/Tracking #
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sams_pallets_status_idx on public.sams_pallets (status);
create index if not exists sams_pallets_club_idx on public.sams_pallets (club);

alter table public.sams_pallets enable row level security;

drop policy if exists "sams_pallets_select_all" on public.sams_pallets;
drop policy if exists "sams_pallets_insert_ops" on public.sams_pallets;
drop policy if exists "sams_pallets_update_ops" on public.sams_pallets;
drop policy if exists "sams_pallets_delete_dispatch" on public.sams_pallets;

create policy "sams_pallets_select_all" on public.sams_pallets
  for select to authenticated using (true);
create policy "sams_pallets_insert_ops" on public.sams_pallets
  for insert to authenticated
  with check (public.my_role() in ('admin','dispatcher','warehouse'));
create policy "sams_pallets_update_ops" on public.sams_pallets
  for update to authenticated
  using (public.my_role() in ('admin','dispatcher','warehouse'))
  with check (public.my_role() in ('admin','dispatcher','warehouse'));
create policy "sams_pallets_delete_dispatch" on public.sams_pallets
  for delete to authenticated
  using (public.my_role() in ('admin','dispatcher'));
