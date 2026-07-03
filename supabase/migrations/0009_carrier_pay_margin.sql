-- Applied live on 2026-07-03 as "carrier_pay_margin".
-- Margin tracking: loads.carrier_pay_usd (what the carrier is paid) and a
-- computed margin_usd (rate_usd - carrier_pay_usd) in loads_enriched.

alter table public.loads add column if not exists carrier_pay_usd numeric(12,2);

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
  l.carrier_pay_usd,
  (case when l.rate_usd is not null and l.carrier_pay_usd is not null
        then l.rate_usd - l.carrier_pay_usd end) as margin_usd,
  c.name as carrier_name, c.mode as carrier_mode, c.scac as carrier_scac,
  ln.origin, ln.destination,
  (ln.origin || ' -> ' || ln.destination) as lane,
  coalesce(l.miles_calc, ln.miles::numeric) as miles,
  cu.name as customer_name
from public.loads l
left join public.carriers c on c.id = l.carrier_id
left join public.lanes ln on ln.id = l.lane_id
left join public.customers cu on cu.id = l.customer_id;
