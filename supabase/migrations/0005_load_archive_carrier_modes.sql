-- Applied live on 2026-07-03 as "load_archive_and_carrier_modes".
-- loads.archived flag, broader carrier modes, loads_enriched rebuilt with
-- archived + carrier_scac columns.

alter table public.loads add column if not exists archived boolean not null default false;
create index if not exists idx_loads_archived on public.loads(archived);

alter table public.carriers drop constraint if exists carriers_mode_check;
alter table public.carriers add constraint carriers_mode_check check (
  mode = any (array['truckload','ltl','intermodal','parcel','freight_forwarder','customs_broker'])
);

drop view public.loads_enriched;
create view public.loads_enriched
with (security_invoker = on) as
select
  l.id, l.ref, l.carrier_id, l.lane_id, l.status, l.rate_usd, l.weight_lbs,
  l.pickup_at, l.eta, l.delivered_at, l.on_time, l.created_at, l.updated_at,
  l.customer_id, l.entity, l.equipment_type, l.bol_number, l.commodity,
  l.rate_per_mile, l.miles_calc,
  l.origin_city, l.origin_state, l.origin_zip, l.dest_city, l.dest_state, l.dest_zip,
  l.shipper_name, l.shipper_address1, l.shipper_address2, l.shipper_city, l.shipper_state, l.shipper_zip, l.shipper_contact, l.shipper_phone,
  l.consignee_name, l.consignee_address1, l.consignee_address2, l.consignee_city, l.consignee_state, l.consignee_zip, l.consignee_contact, l.consignee_phone,
  l.notes, l.scheduled_at, l.delivery_at, l.archived,
  c.name as carrier_name, c.mode as carrier_mode, c.scac as carrier_scac,
  ln.origin, ln.destination,
  (ln.origin || ' -> ' || ln.destination) as lane,
  coalesce(l.miles_calc, ln.miles::numeric) as miles,
  cu.name as customer_name
from public.loads l
left join public.carriers c on c.id = l.carrier_id
left join public.lanes ln on ln.id = l.lane_id
left join public.customers cu on cu.id = l.customer_id;
