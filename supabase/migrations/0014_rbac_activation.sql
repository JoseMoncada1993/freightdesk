-- Applied live on 2026-07-03 as "rbac_activation".
-- RBAC activation: replaces the permissive "any authenticated user can do
-- anything" policies with role-scoped ones. Roles live on public.profiles.role
-- (admin | dispatcher | warehouse | viewer; 'accounting' allowed but unused).
--
-- Matrix:
--   read everything ........ all authenticated users
--   loads/lanes/carriers/customers/addresses writes ... admin, dispatcher
--   tasks/documents/yard_trailers writes .............. admin, dispatcher, warehouse
--   warehouses/inventory writes ....................... admin, warehouse
--   deletes ........... admin (plus dispatcher for addresses/tasks/documents)
--   profiles .......... users read own; admin reads/updates all
--
-- New auth users now default to role 'viewer'; assign roles on the Team page.

-- 1) profiles: email column for the Team page + safer default for new hires
alter table public.profiles add column if not exists email text;
update public.profiles p set email = u.email
from auth.users u where u.id = p.id and p.email is distinct from u.email;
alter table public.profiles alter column role set default 'viewer';

-- keep the owner on admin
update public.profiles set role = 'admin'
where id in (select id from auth.users where email = 'josemoncada1993@yahoo.com');

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do update set email = excluded.email;
  return new;
end $fn$;

-- 2) profiles policies
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
drop policy if exists "Users can update own profile." on public.profiles;
drop policy if exists "Users can insert their own profile." on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_select_admin on public.profiles
  for select to authenticated using (public.my_role() = 'admin');
create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- 3) drop permissive/legacy policies, create read-for-all
do $do$
declare t text;
begin
  foreach t in array array['lanes','loads','carriers','customers','customer_addresses',
                           'documents','tasks','warehouses','inventory_items',
                           'inventory_levels','inventory_movements','yard_trailers'] loop
    execute format('drop policy if exists "authenticated_all_%1$s" on public.%1$s;', t);
    execute format('drop policy if exists "%1$s_select_all" on public.%1$s;', t);
    execute format('create policy "%1$s_select_all" on public.%1$s for select to authenticated using (true);', t);
  end loop;
end $do$;

drop policy if exists "authenticated insert carriers" on public.carriers;
drop policy if exists "authenticated read carriers" on public.carriers;
drop policy if exists "authenticated update carriers" on public.carriers;
drop policy if exists "read carriers" on public.carriers;
drop policy if exists "read lanes" on public.lanes;
drop policy if exists "read loads" on public.loads;
drop policy if exists "loads_insert_authenticated" on public.loads;
drop policy if exists "loads_update_authenticated" on public.loads;
drop policy if exists "yard_insert_authenticated" on public.yard_trailers;
drop policy if exists "yard_select_authenticated" on public.yard_trailers;
drop policy if exists "yard_update_authenticated" on public.yard_trailers;

-- 4) role-scoped writes
do $do$
declare t text;
begin
  foreach t in array array['lanes','loads','carriers','customers','customer_addresses'] loop
    execute format($f$create policy "%1$s_insert_dispatch" on public.%1$s for insert to authenticated
      with check (public.my_role() in ('admin','dispatcher'));$f$, t);
    execute format($f$create policy "%1$s_update_dispatch" on public.%1$s for update to authenticated
      using (public.my_role() in ('admin','dispatcher'))
      with check (public.my_role() in ('admin','dispatcher'));$f$, t);
  end loop;

  foreach t in array array['tasks','documents','yard_trailers'] loop
    execute format($f$create policy "%1$s_insert_ops" on public.%1$s for insert to authenticated
      with check (public.my_role() in ('admin','dispatcher','warehouse'));$f$, t);
    execute format($f$create policy "%1$s_update_ops" on public.%1$s for update to authenticated
      using (public.my_role() in ('admin','dispatcher','warehouse'))
      with check (public.my_role() in ('admin','dispatcher','warehouse'));$f$, t);
  end loop;

  foreach t in array array['warehouses','inventory_items','inventory_levels','inventory_movements'] loop
    execute format($f$create policy "%1$s_insert_wh" on public.%1$s for insert to authenticated
      with check (public.my_role() in ('admin','warehouse'));$f$, t);
    execute format($f$create policy "%1$s_update_wh" on public.%1$s for update to authenticated
      using (public.my_role() in ('admin','warehouse'))
      with check (public.my_role() in ('admin','warehouse'));$f$, t);
  end loop;

  foreach t in array array['lanes','loads','carriers','customers','yard_trailers',
                           'warehouses','inventory_items','inventory_levels','inventory_movements'] loop
    execute format($f$create policy "%1$s_delete_admin" on public.%1$s for delete to authenticated
      using (public.my_role() = 'admin');$f$, t);
  end loop;

  foreach t in array array['customer_addresses','tasks','documents'] loop
    execute format($f$create policy "%1$s_delete_dispatch" on public.%1$s for delete to authenticated
      using (public.my_role() in ('admin','dispatcher'));$f$, t);
  end loop;
end $do$;

-- 5) storage: role-scoped file access
drop policy if exists "authenticated read carrier-docs" on storage.objects;
drop policy if exists "authenticated update carrier-docs" on storage.objects;
drop policy if exists "authenticated upload carrier-docs" on storage.objects;
drop policy if exists "authenticated_delete_documents" on storage.objects;
drop policy if exists "authenticated_insert_documents" on storage.objects;
drop policy if exists "authenticated_read_documents" on storage.objects;
drop policy if exists "authenticated_update_documents" on storage.objects;
create policy "docs_read_all" on storage.objects for select to authenticated
  using (bucket_id in ('documents','carrier-docs'));
create policy "docs_insert_ops" on storage.objects for insert to authenticated
  with check (bucket_id in ('documents','carrier-docs') and public.my_role() in ('admin','dispatcher','warehouse'));
create policy "docs_update_ops" on storage.objects for update to authenticated
  using (bucket_id in ('documents','carrier-docs') and public.my_role() in ('admin','dispatcher','warehouse'));
create policy "docs_delete_dispatch" on storage.objects for delete to authenticated
  using (bucket_id in ('documents','carrier-docs') and public.my_role() in ('admin','dispatcher'));

-- 6) function grants (applied live as "rbac_function_grants"):
-- recreating handle_new_user reset its ACL; re-harden.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.my_role() from public, anon;
grant execute on function public.my_role() to authenticated;
