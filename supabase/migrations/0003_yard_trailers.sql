-- Drop trailer / yard management (recorded from the live project for reproducibility).
-- Tables: yard_trailers + yard_trailers_enriched view.

create table if not exists public.yard_trailers (
  id bigint generated always as identity primary key,
  site text not null,
  trailer_no text not null,
  carrier_id bigint references public.carriers(id) on delete set null,
  status text not null default 'Empty'
    check (status in ('Empty','Loaded','Partial','Out of service','Reserved')),
  condition text default 'OK',
  load_ref text,
  spot text,
  seal_no text,
  contents text,
  gate_in_at timestamptz default now(),
  gate_out_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace view public.yard_trailers_enriched as
select
  y.id, y.site, y.trailer_no, y.carrier_id, y.status, y.condition,
  y.load_ref, y.spot, y.seal_no, y.contents,
  y.gate_in_at, y.gate_out_at, y.notes, y.created_at, y.updated_at,
  c.name as carrier_name
from public.yard_trailers y
left join public.carriers c on c.id = y.carrier_id;

alter table public.yard_trailers enable row level security;
do $$
begin
  begin
    create policy "authenticated_all_yard_trailers" on public.yard_trailers
      for all to authenticated using (true) with check (true);
  exception when duplicate_object then null;
  end;
end $$;
