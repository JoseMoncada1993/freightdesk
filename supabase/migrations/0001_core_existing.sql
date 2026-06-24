-- FreightDesk core schema (pre-existing in the Supabase project).
-- Recorded here for reproducibility. Tables: carriers, lanes, loads,
-- the loads_enriched view, and the add_load() RPC.

create table if not exists public.carriers (
  id bigint generated always as identity primary key,
  name text not null,
  scac text,
  mode text not null default 'OTR',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.lanes (
  id bigint generated always as identity primary key,
  origin text not null,
  destination text not null,
  miles integer,
  created_at timestamptz not null default now()
);

create table if not exists public.loads (
  id bigint generated always as identity primary key,
  ref text not null unique,
  carrier_id bigint references public.carriers(id) on delete set null,
  lane_id bigint references public.lanes(id) on delete set null,
  status text not null default 'quoted',
  rate_usd numeric(12,2),
  weight_lbs integer,
  pickup_at timestamptz,
  eta timestamptz,
  delivered_at timestamptz,
  on_time boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace view public.loads_enriched as
select
  l.id, l.ref, l.status, l.rate_usd, l.weight_lbs,
  l.pickup_at, l.eta, l.delivered_at, l.on_time,
  c.name as carrier_name, c.mode as carrier_mode,
  ln.origin, ln.destination,
  (ln.origin || ' -> ' || ln.destination) as lane,
  ln.miles
from public.loads l
left join public.carriers c on c.id = l.carrier_id
left join public.lanes ln on ln.id = l.lane_id;
