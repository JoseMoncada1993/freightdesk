-- Applied live on 2026-07-03 as "pending_status_transport_type_address_details".
-- loads: 'pending' status added and made the default; transport_type column
-- (FTL/LTL/Container/Direct LTL/Domestic/Direct Domestic/Direct Truckload)
-- with check constraint; loads_enriched rebuilt to include transport_type.
-- customer_addresses: facility_type, business_hours, special_instructions.

alter table public.loads add column if not exists transport_type text;

alter table public.loads drop constraint if exists loads_status_check;
alter table public.loads add constraint loads_status_check check (
  status = any (array['Quoted','Shipment approved','BOL approved','BOL sent','Shipment booked',
                      'pending','quoted','booked','in_transit','delayed','exception','delivered','cancelled'])
);
alter table public.loads alter column status set default 'pending';

alter table public.loads drop constraint if exists loads_transport_type_check;
alter table public.loads add constraint loads_transport_type_check check (
  transport_type is null or transport_type = any (array
    ['FTL','LTL','Container','Direct LTL','Domestic','Direct Domestic','Direct Truckload'])
);

alter table public.customer_addresses add column if not exists facility_type text;
alter table public.customer_addresses add column if not exists business_hours text;
alter table public.customer_addresses add column if not exists special_instructions text;

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
  l.notes, l.scheduled_at, l.delivery_at, l.archived, l.transport_type,
  c.name as carrier_name, c.mode as carrier_mode, c.scac as carrier_scac,
  ln.origin, ln.destination,
  (ln.origin || ' -> ' || ln.destination) as lane,
  coalesce(l.miles_calc, ln.miles::numeric) as miles,
  cu.name as customer_name
from public.loads l
left join public.carriers c on c.id = l.carrier_id
left join public.lanes ln on ln.id = l.lane_id
left join public.customers cu on cu.id = l.customer_id;
