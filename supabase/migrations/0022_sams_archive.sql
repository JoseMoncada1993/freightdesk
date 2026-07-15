-- 0022: Sam's Club pallet archiving.
-- Adds an archived flag so delivered pallets can be moved out of the working
-- view (single or bulk archive/unarchive in the UI) without losing history.

alter table public.sams_pallets
  add column if not exists archived boolean not null default false;

create index if not exists sams_pallets_archived_idx on public.sams_pallets (archived);
