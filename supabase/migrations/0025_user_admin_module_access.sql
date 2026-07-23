-- 0025: Admin-managed users & per-user module access (applied live 2026-07-22).
-- - profiles readable by all authenticated users (so "added by" names and the
--   Tasks auto-assignee resolve for everyone; writes stay admin-only).
-- - loads.created_by (default auth.uid()) + loads_enriched exposes
--   created_by / created_by_name for the Shipments "Added by" column.
-- - user_module_access: admin grants a user extra module access beyond their
--   role (level 'write' or 'view'). has_module_write() feeds the RLS write
--   policies below so write grants are enforced server-side, not just in UI.

-- 1. Everyone signed in can read teammate names/emails.
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated on public.profiles
  for select to authenticated using (true);

-- 2. Track who created each shipment.
alter table public.loads add column if not exists created_by uuid default auth.uid();

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
    coalesce(p.full_name, p.email) as created_by_name
   from public.loads l
     left join public.carriers c on c.id = l.carrier_id
     left join public.lanes ln on ln.id = l.lane_id
     left join public.customers cu on cu.id = l.customer_id
     left join public.profiles p on p.id = l.created_by;

-- 3. Per-user module grants.
create table if not exists public.user_module_access (
  user_id uuid not null references public.profiles(id) on delete cascade,
  module text not null,
  level text not null default 'write' check (level in ('write','view')),
  created_at timestamptz not null default now(),
  primary key (user_id, module)
);
alter table public.user_module_access enable row level security;

create policy uma_select_own_or_admin on public.user_module_access
  for select to authenticated using (user_id = auth.uid() or public.my_role() = 'admin');
create policy uma_insert_admin on public.user_module_access
  for insert to authenticated with check (public.my_role() = 'admin');
create policy uma_update_admin on public.user_module_access
  for update to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');
create policy uma_delete_admin on public.user_module_access
  for delete to authenticated using (public.my_role() = 'admin');

create or replace function public.has_module_write(m text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_module_access
    where user_id = auth.uid() and module = m and level = 'write'
  );
$$;
grant execute on function public.has_module_write(text) to authenticated;

-- 4. Extend the write policies so a 'write' grant works like the role would.
--    (Admin-only hard-delete policies are left untouched.)

-- shipments / billing -> loads, lanes
alter policy loads_insert_dispatch on public.loads
  with check (public.my_role() in ('admin','dispatcher') or public.has_module_write('shipments') or public.has_module_write('billing'));
alter policy loads_update_dispatch on public.loads
  using (public.my_role() in ('admin','dispatcher') or public.has_module_write('shipments') or public.has_module_write('billing'))
  with check (public.my_role() in ('admin','dispatcher') or public.has_module_write('shipments') or public.has_module_write('billing'));
alter policy lanes_insert_dispatch on public.lanes
  with check (public.my_role() in ('admin','dispatcher') or public.has_module_write('shipments'));
alter policy lanes_update_dispatch on public.lanes
  using (public.my_role() in ('admin','dispatcher') or public.has_module_write('shipments'))
  with check (public.my_role() in ('admin','dispatcher') or public.has_module_write('shipments'));

-- trailers -> yard_trailers
alter policy yard_trailers_insert_ops on public.yard_trailers
  with check (public.my_role() in ('admin','dispatcher','warehouse') or public.has_module_write('trailers'));
alter policy yard_trailers_update_ops on public.yard_trailers
  using (public.my_role() in ('admin','dispatcher','warehouse') or public.has_module_write('trailers'))
  with check (public.my_role() in ('admin','dispatcher','warehouse') or public.has_module_write('trailers'));

-- inventory -> warehouses + inventory tables
alter policy warehouses_insert_wh on public.warehouses
  with check (public.my_role() in ('admin','warehouse') or public.has_module_write('inventory'));
alter policy warehouses_update_wh on public.warehouses
  using (public.my_role() in ('admin','warehouse') or public.has_module_write('inventory'))
  with check (public.my_role() in ('admin','warehouse') or public.has_module_write('inventory'));
alter policy inventory_items_insert_wh on public.inventory_items
  with check (public.my_role() in ('admin','warehouse') or public.has_module_write('inventory'));
alter policy inventory_items_update_wh on public.inventory_items
  using (public.my_role() in ('admin','warehouse') or public.has_module_write('inventory'))
  with check (public.my_role() in ('admin','warehouse') or public.has_module_write('inventory'));
alter policy inventory_levels_insert_wh on public.inventory_levels
  with check (public.my_role() in ('admin','warehouse') or public.has_module_write('inventory'));
alter policy inventory_levels_update_wh on public.inventory_levels
  using (public.my_role() in ('admin','warehouse') or public.has_module_write('inventory'))
  with check (public.my_role() in ('admin','warehouse') or public.has_module_write('inventory'));
alter policy inventory_movements_insert_wh on public.inventory_movements
  with check (public.my_role() in ('admin','warehouse') or public.has_module_write('inventory'));
alter policy inventory_movements_update_wh on public.inventory_movements
  using (public.my_role() in ('admin','warehouse') or public.has_module_write('inventory'))
  with check (public.my_role() in ('admin','warehouse') or public.has_module_write('inventory'));

-- customers -> customers, customer_addresses
alter policy customers_insert_dispatch on public.customers
  with check (public.my_role() in ('admin','dispatcher') or public.has_module_write('customers'));
alter policy customers_update_dispatch on public.customers
  using (public.my_role() in ('admin','dispatcher') or public.has_module_write('customers'))
  with check (public.my_role() in ('admin','dispatcher') or public.has_module_write('customers'));
alter policy customer_addresses_insert_dispatch on public.customer_addresses
  with check (public.my_role() in ('admin','dispatcher') or public.has_module_write('customers'));
alter policy customer_addresses_update_dispatch on public.customer_addresses
  using (public.my_role() in ('admin','dispatcher') or public.has_module_write('customers'))
  with check (public.my_role() in ('admin','dispatcher') or public.has_module_write('customers'));
alter policy customer_addresses_delete_dispatch on public.customer_addresses
  using (public.my_role() in ('admin','dispatcher') or public.has_module_write('customers'));

-- carriers
alter policy carriers_insert_dispatch on public.carriers
  with check (public.my_role() in ('admin','dispatcher') or public.has_module_write('carriers'));
alter policy carriers_update_dispatch on public.carriers
  using (public.my_role() in ('admin','dispatcher') or public.has_module_write('carriers'))
  with check (public.my_role() in ('admin','dispatcher') or public.has_module_write('carriers'));

-- documents
alter policy documents_insert_ops on public.documents
  with check (public.my_role() in ('admin','dispatcher','warehouse') or public.has_module_write('documents'));
alter policy documents_update_ops on public.documents
  using (public.my_role() in ('admin','dispatcher','warehouse') or public.has_module_write('documents'))
  with check (public.my_role() in ('admin','dispatcher','warehouse') or public.has_module_write('documents'));
alter policy documents_delete_dispatch on public.documents
  using (public.my_role() in ('admin','dispatcher') or public.has_module_write('documents'));

-- tasks
alter policy tasks_insert_ops on public.tasks
  with check (public.my_role() in ('admin','dispatcher','warehouse') or public.has_module_write('tasks'));
alter policy tasks_update_ops on public.tasks
  using (public.my_role() in ('admin','dispatcher','warehouse') or public.has_module_write('tasks'))
  with check (public.my_role() in ('admin','dispatcher','warehouse') or public.has_module_write('tasks'));
alter policy tasks_delete_dispatch on public.tasks
  using (public.my_role() in ('admin','dispatcher') or public.has_module_write('tasks'));

-- skus + conventions
alter policy skus_insert_dispatch on public.skus
  with check (public.my_role() in ('admin','dispatcher') or public.has_module_write('skus'));
alter policy skus_update_dispatch on public.skus
  using (public.my_role() in ('admin','dispatcher') or public.has_module_write('skus'))
  with check (public.my_role() in ('admin','dispatcher') or public.has_module_write('skus'));
alter policy skus_delete_dispatch on public.skus
  using (public.my_role() in ('admin','dispatcher') or public.has_module_write('skus'));
alter policy sku_conventions_insert_dispatch on public.sku_conventions
  with check (public.my_role() in ('admin','dispatcher') or public.has_module_write('skus'));
alter policy sku_conventions_update_dispatch on public.sku_conventions
  using (public.my_role() in ('admin','dispatcher') or public.has_module_write('skus'))
  with check (public.my_role() in ('admin','dispatcher') or public.has_module_write('skus'));
alter policy sku_conventions_delete_dispatch on public.sku_conventions
  using (public.my_role() in ('admin','dispatcher') or public.has_module_write('skus'));

-- sams
alter policy sams_pallets_insert_ops on public.sams_pallets
  with check (public.my_role() in ('admin','dispatcher','warehouse') or public.has_module_write('sams'));
alter policy sams_pallets_update_ops on public.sams_pallets
  using (public.my_role() in ('admin','dispatcher','warehouse') or public.has_module_write('sams'))
  with check (public.my_role() in ('admin','dispatcher','warehouse') or public.has_module_write('sams'));
alter policy sams_pallets_delete_dispatch on public.sams_pallets
  using (public.my_role() in ('admin','dispatcher') or public.has_module_write('sams'));

-- routes
alter policy routes_insert_dispatch on public.routes
  with check (public.my_role() in ('admin','dispatcher') or public.has_module_write('routes'));
alter policy routes_update_dispatch on public.routes
  using (public.my_role() in ('admin','dispatcher') or public.has_module_write('routes'))
  with check (public.my_role() in ('admin','dispatcher') or public.has_module_write('routes'));
alter policy routes_delete_dispatch on public.routes
  using (public.my_role() in ('admin','dispatcher') or public.has_module_write('routes'));

-- manifests (+ mappings, pricing rules)
alter policy manifests_insert_dispatch on public.manifests
  with check (public.my_role() in ('admin','dispatcher') or public.has_module_write('manifests'));
alter policy manifests_update_dispatch on public.manifests
  using (public.my_role() in ('admin','dispatcher') or public.has_module_write('manifests'))
  with check (public.my_role() in ('admin','dispatcher') or public.has_module_write('manifests'));
alter policy manifests_delete_dispatch on public.manifests
  using (public.my_role() in ('admin','dispatcher') or public.has_module_write('manifests'));
alter policy manifest_mappings_insert_dispatch on public.manifest_mappings
  with check (public.my_role() in ('admin','dispatcher') or public.has_module_write('manifests'));
alter policy manifest_mappings_update_dispatch on public.manifest_mappings
  using (public.my_role() in ('admin','dispatcher') or public.has_module_write('manifests'))
  with check (public.my_role() in ('admin','dispatcher') or public.has_module_write('manifests'));
alter policy manifest_mappings_delete_dispatch on public.manifest_mappings
  using (public.my_role() in ('admin','dispatcher') or public.has_module_write('manifests'));
alter policy pricing_rules_insert_dispatch on public.pricing_rules
  with check (public.my_role() in ('admin','dispatcher') or public.has_module_write('manifests'));
alter policy pricing_rules_update_dispatch on public.pricing_rules
  using (public.my_role() in ('admin','dispatcher') or public.has_module_write('manifests'))
  with check (public.my_role() in ('admin','dispatcher') or public.has_module_write('manifests'));
alter policy pricing_rules_delete_dispatch on public.pricing_rules
  using (public.my_role() in ('admin','dispatcher') or public.has_module_write('manifests'));

-- forms
alter policy form_templates_insert_dispatch on public.form_templates
  with check (public.my_role() in ('admin','dispatcher') or public.has_module_write('forms'));
alter policy form_templates_update_dispatch on public.form_templates
  using (public.my_role() in ('admin','dispatcher') or public.has_module_write('forms'))
  with check (public.my_role() in ('admin','dispatcher') or public.has_module_write('forms'));
alter policy form_templates_delete_dispatch on public.form_templates
  using (public.my_role() in ('admin','dispatcher') or public.has_module_write('forms'));
alter policy form_responses_delete_dispatch on public.form_responses
  using (public.my_role() in ('admin','dispatcher') or public.has_module_write('forms'));

-- emails
alter policy email_logs_insert_dispatch on public.email_logs
  with check (public.my_role() in ('admin','dispatcher') or public.has_module_write('emails'));
alter policy email_logs_update_dispatch on public.email_logs
  using (public.my_role() in ('admin','dispatcher') or public.has_module_write('emails'))
  with check (public.my_role() in ('admin','dispatcher') or public.has_module_write('emails'));
alter policy email_logs_delete_dispatch on public.email_logs
  using (public.my_role() in ('admin','dispatcher') or public.has_module_write('emails'));
alter policy email_rules_insert_dispatch on public.email_rules
  with check (public.my_role() in ('admin','dispatcher') or public.has_module_write('emails'));
alter policy email_rules_update_dispatch on public.email_rules
  using (public.my_role() in ('admin','dispatcher') or public.has_module_write('emails'))
  with check (public.my_role() in ('admin','dispatcher') or public.has_module_write('emails'));
alter policy email_rules_delete_dispatch on public.email_rules
  using (public.my_role() in ('admin','dispatcher') or public.has_module_write('emails'));
