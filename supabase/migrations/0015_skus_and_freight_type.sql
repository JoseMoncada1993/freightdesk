-- 0015: SKU generator module + editable QTY/Type on shipments.
-- Applied live on 2026-07-06 as "skus_and_freight_type".
--
-- 1) Shipments gain editable QTY (integer) and freight Type (free text) that
--    feed the BOL "CARRIER INFORMATION" QTY/TYPE columns.
-- 2) New `skus` table: a SKU is a supplier/location/program-derived prefix plus
--    a load #, optionally linked to a shipment. RLS mirrors loads
--    (read: all authenticated; write/delete: admin + dispatcher).
-- 3) loads_enriched is recreated to expose qty + freight_type (columns appended
--    at the end so CREATE OR REPLACE VIEW accepts it; security_invoker kept on).

alter table public.loads add column if not exists qty integer;
alter table public.loads add column if not exists freight_type text;

create table if not exists public.skus (
  id bigint generated always as identity primary key,
  sku text not null unique,
  prefix text not null,
  supplier text,
  location text,
  program text,
  load_ref text,
  load_id bigint references public.loads(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.skus enable row level security;

drop policy if exists "skus_select_all" on public.skus;
drop policy if exists "skus_insert_dispatch" on public.skus;
drop policy if exists "skus_update_dispatch" on public.skus;
drop policy if exists "skus_delete_dispatch" on public.skus;

create policy "skus_select_all" on public.skus
  for select to authenticated using (true);
create policy "skus_insert_dispatch" on public.skus
  for insert to authenticated
  with check (public.my_role() in ('admin','dispatcher'));
create policy "skus_update_dispatch" on public.skus
  for update to authenticated
  using (public.my_role() in ('admin','dispatcher'))
  with check (public.my_role() in ('admin','dispatcher'));
create policy "skus_delete_dispatch" on public.skus
  for delete to authenticated
  using (public.my_role() in ('admin','dispatcher'));

create or replace view public.loads_enriched with (security_invoker = on) as
 SELECT l.id,
    l.ref,
    l.carrier_id,
    l.lane_id,
    l.status,
    l.rate_usd,
    l.weight_lbs,
    l.pickup_at,
    l.eta,
    l.delivered_at,
    l.on_time,
    l.created_at,
    l.updated_at,
    l.customer_id,
    l.entity,
    l.equipment_type,
    l.bol_number,
    l.commodity,
    l.rate_per_mile,
    l.miles_calc,
    l.origin_city,
    l.origin_state,
    l.origin_zip,
    l.dest_city,
    l.dest_state,
    l.dest_zip,
    l.shipper_name,
    l.shipper_address1,
    l.shipper_address2,
    l.shipper_city,
    l.shipper_state,
    l.shipper_zip,
    l.shipper_contact,
    l.shipper_phone,
    l.consignee_name,
    l.consignee_address1,
    l.consignee_address2,
    l.consignee_city,
    l.consignee_state,
    l.consignee_zip,
    l.consignee_contact,
    l.consignee_phone,
    l.notes,
    l.scheduled_at,
    l.delivery_at,
    l.archived,
    l.transport_type,
    l.carrier_pay_usd,
        CASE
            WHEN l.rate_usd IS NOT NULL AND l.carrier_pay_usd IS NOT NULL THEN l.rate_usd - l.carrier_pay_usd
            ELSE NULL::numeric
        END AS margin_usd,
    l.invoice_number,
    l.invoiced_at,
    l.invoice_due_date,
    l.paid_at,
    c.name AS carrier_name,
    c.mode AS carrier_mode,
    c.scac AS carrier_scac,
    ln.origin,
    ln.destination,
    (ln.origin || ' -> '::text) || ln.destination AS lane,
    COALESCE(l.miles_calc, ln.miles::numeric) AS miles,
    cu.name AS customer_name,
    l.qty,
    l.freight_type
   FROM loads l
     LEFT JOIN carriers c ON c.id = l.carrier_id
     LEFT JOIN lanes ln ON ln.id = l.lane_id
     LEFT JOIN customers cu ON cu.id = l.customer_id;
