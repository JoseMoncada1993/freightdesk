-- 0027: User activity tracking + shipment internal notes (applied live 2026-07-22).
-- - activity_log: every add / edit / delete on the main tables is recorded by
--   an AFTER trigger (who, what action, which table, which record). Read is
--   admin-only; rows are written by the trigger (security definer), clients
--   cannot insert/modify them directly.
-- - loads.internal_notes: shipment notes that do NOT print on the BOL;
--   exposed through loads_enriched.

-- 1. Internal notes on shipments.
alter table public.loads add column if not exists internal_notes text;

create or replace view public.loads_enriched with (security_invoker = on) as
 select l.id, l.ref, l.carrier_id, l.lane_id, l.status, l.rate_usd, l.weight_lbs,
    l.pickup_at, l.eta, l.delivered_at, l.on_time, l.created_at, l.updated_at,
    l.customer_id, l.entity, l.equipment_type, l.bol_number, l.commodity,
    l.rate_per_mile, l.miles_calc, l.origin_city, l.origin_state, l.origin_zip,
    l.dest_city, l.dest_state, l.dest_zip, l.shipper_name, l.shipper_address1,
    l.shipper_address2, l.shipper_city, l.shipper_state, l.shipper_zip,
    l.shipper_contact, l.shipper_phone, l.consignee_name, l.consignee_address1,
    l.consignee_address2, l.consignee_city, l.consignee_state, l.consignee_zip,
    l.consignee_contact, l.consignee_phone, l.notes, l.scheduled_at,
    l.delivery_at, l.archived, l.transport_type, l.carrier_pay_usd,
    case when l.rate_usd is not null and l.carrier_pay_usd is not null
         then l.rate_usd - l.carrier_pay_usd else null::numeric end as margin_usd,
    l.invoice_number, l.invoiced_at, l.invoice_due_date, l.paid_at,
    c.name as carrier_name, c.mode as carrier_mode, c.scac as carrier_scac,
    ln.origin, ln.destination,
    (ln.origin || ' -> '::text) || ln.destination as lane,
    coalesce(l.miles_calc, ln.miles::numeric) as miles,
    cu.name as customer_name, l.qty, l.freight_type,
    l.created_by,
    coalesce(p.full_name, p.email) as created_by_name,
    l.internal_notes
   from public.loads l
     left join public.carriers c on c.id = l.carrier_id
     left join public.lanes ln on ln.id = l.lane_id
     left join public.customers cu on cu.id = l.customer_id
     left join public.profiles p on p.id = l.created_by;

-- 2. Activity log.
create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  user_id uuid,
  action text not null,          -- INSERT | UPDATE | DELETE
  table_name text not null,
  ref text,                      -- human label of the touched record
  created_at timestamptz not null default now()
);
create index if not exists activity_log_created_at on public.activity_log (created_at desc);

alter table public.activity_log enable row level security;
create policy activity_log_select_admin on public.activity_log
  for select to authenticated using (public.my_role() = 'admin');
-- No insert/update/delete policies: only the trigger below writes rows.

create or replace function public.log_activity()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_ref text;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_ref := coalesce(
    v_row->>'ref', v_row->>'sku', v_row->>'trailer_no', v_row->>'pallet_id',
    v_row->>'title', v_row->>'name', v_row->>'file_name', v_row->>'supplier',
    v_row->>'email', v_row->>'file_path', v_row->>'id');
  insert into public.activity_log (user_id, action, table_name, ref)
  values (auth.uid(), tg_op, tg_table_name, left(v_ref, 200));
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'loads','skus','sku_conventions','manifests','pricing_rules','sams_pallets',
    'tasks','customers','carriers','documents','yard_trailers','routes',
    'inventory_items','inventory_movements','form_templates','email_logs',
    'profiles','user_module_access'
  ] loop
    execute format('drop trigger if exists trg_activity on public.%I', t);
    execute format(
      'create trigger trg_activity after insert or update or delete on public.%I
         for each row execute function public.log_activity()', t);
  end loop;
end $$;
