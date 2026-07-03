-- Warehouse & inventory management (WMS core) + fixes.
-- Applied to the live project on 2026-07-02 as migration "warehouse_inventory_and_fixes".
-- Tables: warehouses, inventory_items, inventory_levels, inventory_movements.
-- RPC: record_inventory_movement (atomic ledger write + level upsert).
-- Views: inventory_levels_enriched, inventory_movements_enriched.
-- Also: loads_enriched gains customer_name; loads.status check gains
-- 'quoted' and 'cancelled'; private 'documents' storage bucket + policies.

create table if not exists public.warehouses (
  id bigint generated always as identity primary key,
  code text not null unique,
  name text not null,
  address1 text,
  city text,
  state text,
  zip_code text,
  dock_doors integer,
  trailer_spots integer,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id bigint generated always as identity primary key,
  sku text not null unique,
  description text not null,
  customer_id bigint references public.customers(id) on delete set null,
  uom text not null default 'pallet',
  unit_weight_lbs numeric(10,2),
  unit_value_usd numeric(12,2),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_levels (
  id bigint generated always as identity primary key,
  warehouse_id bigint not null references public.warehouses(id) on delete cascade,
  item_id bigint not null references public.inventory_items(id) on delete cascade,
  qty_on_hand numeric(14,2) not null default 0,
  qty_allocated numeric(14,2) not null default 0,
  reorder_point numeric(14,2),
  updated_at timestamptz not null default now(),
  unique (warehouse_id, item_id)
);

create table if not exists public.inventory_movements (
  id bigint generated always as identity primary key,
  warehouse_id bigint not null references public.warehouses(id) on delete cascade,
  item_id bigint not null references public.inventory_items(id) on delete cascade,
  movement_type text not null check (movement_type in ('inbound','outbound','adjustment')),
  qty numeric(14,2) not null,
  load_ref text,
  notes text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_inv_movements_item on public.inventory_movements(item_id);
create index if not exists idx_inv_movements_wh on public.inventory_movements(warehouse_id);

create or replace function public.record_inventory_movement(
  p_warehouse_id bigint,
  p_item_id bigint,
  p_movement_type text,
  p_qty numeric,
  p_load_ref text default null,
  p_notes text default null
) returns bigint
language plpgsql
security invoker
as $$
declare
  v_id bigint;
  v_delta numeric;
begin
  if p_movement_type not in ('inbound','outbound','adjustment') then
    raise exception 'movement_type must be inbound, outbound, or adjustment';
  end if;
  v_delta := case
    when p_movement_type = 'inbound' then abs(p_qty)
    when p_movement_type = 'outbound' then -abs(p_qty)
    else p_qty
  end;

  insert into public.inventory_movements (warehouse_id, item_id, movement_type, qty, load_ref, notes)
  values (p_warehouse_id, p_item_id, p_movement_type, v_delta, p_load_ref, p_notes)
  returning id into v_id;

  insert into public.inventory_levels (warehouse_id, item_id, qty_on_hand)
  values (p_warehouse_id, p_item_id, v_delta)
  on conflict (warehouse_id, item_id)
  do update set qty_on_hand = public.inventory_levels.qty_on_hand + v_delta, updated_at = now();

  return v_id;
end;
$$;

create or replace view public.inventory_levels_enriched as
select
  lv.id, lv.warehouse_id, lv.item_id,
  lv.qty_on_hand, lv.qty_allocated, lv.reorder_point, lv.updated_at,
  (lv.qty_on_hand - lv.qty_allocated) as qty_available,
  (lv.reorder_point is not null and lv.qty_on_hand <= lv.reorder_point) as low_stock,
  i.sku, i.description, i.uom, i.unit_weight_lbs,
  w.code as warehouse_code, w.name as warehouse_name,
  cu.name as customer_name
from public.inventory_levels lv
join public.inventory_items i on i.id = lv.item_id
join public.warehouses w on w.id = lv.warehouse_id
left join public.customers cu on cu.id = i.customer_id;

create or replace view public.inventory_movements_enriched as
select
  m.id, m.warehouse_id, m.item_id, m.movement_type, m.qty, m.load_ref, m.notes, m.occurred_at,
  i.sku, i.description, w.code as warehouse_code
from public.inventory_movements m
join public.inventory_items i on i.id = m.item_id
join public.warehouses w on w.id = m.warehouse_id;

create or replace view public.loads_enriched as
select
  l.id, l.ref, l.carrier_id, l.lane_id, l.status, l.rate_usd, l.weight_lbs,
  l.pickup_at, l.eta, l.delivered_at, l.on_time, l.created_at, l.updated_at,
  l.customer_id, l.entity, l.equipment_type, l.bol_number, l.commodity,
  l.rate_per_mile, l.miles_calc,
  l.origin_city, l.origin_state, l.origin_zip, l.dest_city, l.dest_state, l.dest_zip,
  l.shipper_name, l.shipper_address1, l.shipper_address2, l.shipper_city, l.shipper_state, l.shipper_zip, l.shipper_contact, l.shipper_phone,
  l.consignee_name, l.consignee_address1, l.consignee_address2, l.consignee_city, l.consignee_state, l.consignee_zip, l.consignee_contact, l.consignee_phone,
  l.notes, l.scheduled_at, l.delivery_at,
  c.name as carrier_name, c.mode as carrier_mode,
  ln.origin, ln.destination,
  (ln.origin || ' -> ' || ln.destination) as lane,
  coalesce(l.miles_calc, ln.miles::numeric) as miles,
  cu.name as customer_name
from public.loads l
left join public.carriers c on c.id = l.carrier_id
left join public.lanes ln on ln.id = l.lane_id
left join public.customers cu on cu.id = l.customer_id;

alter table public.loads drop constraint if exists loads_status_check;
alter table public.loads add constraint loads_status_check check (
  status = any (array['Quoted','Shipment approved','BOL approved','BOL sent','Shipment booked',
                      'quoted','booked','in_transit','delayed','exception','delivered','cancelled'])
);

alter table public.warehouses enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_levels enable row level security;
alter table public.inventory_movements enable row level security;

do $$
declare t text;
begin
  foreach t in array array['warehouses','inventory_items','inventory_levels','inventory_movements'] loop
    begin
      execute format('create policy "authenticated_all_%1$s" on public.%1$s for all to authenticated using (true) with check (true);', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

do $$
begin
  begin
    create policy "authenticated_read_documents" on storage.objects
      for select to authenticated using (bucket_id = 'documents');
  exception when duplicate_object then null; end;
  begin
    create policy "authenticated_insert_documents" on storage.objects
      for insert to authenticated with check (bucket_id = 'documents');
  exception when duplicate_object then null; end;
  begin
    create policy "authenticated_update_documents" on storage.objects
      for update to authenticated using (bucket_id = 'documents');
  exception when duplicate_object then null; end;
  begin
    create policy "authenticated_delete_documents" on storage.objects
      for delete to authenticated using (bucket_id = 'documents');
  exception when duplicate_object then null; end;
end $$;

-- Views must run with the caller's privileges so RLS on base tables applies
-- (otherwise the anon key could read through the views without logging in).
alter view public.loads_enriched set (security_invoker = on);
alter view public.yard_trailers_enriched set (security_invoker = on);
alter view public.inventory_levels_enriched set (security_invoker = on);
alter view public.inventory_movements_enriched set (security_invoker = on);
