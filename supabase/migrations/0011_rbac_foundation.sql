-- Applied live on 2026-07-03 as "rbac_foundation".
-- Role-based access foundation. Roles live on profiles; current policies stay
-- permissive (any authenticated user has full access) so nothing breaks for a
-- one-person company.
--
-- HOW TO ACTIVATE WHEN HIRING:
-- 1. In Supabase dashboard, create the new user (Authentication -> Users).
-- 2. Set their role:  update public.profiles set role='dispatcher' where id='<their-uuid>';
-- 3. Replace the permissive "authenticated_all_*" policy on each table with
--    role-scoped ones, e.g.:
--      drop policy "authenticated_all_loads" on public.loads;
--      create policy "loads_read_all" on public.loads for select
--        to authenticated using (true);
--      create policy "loads_write_dispatch" on public.loads
--        for insert to authenticated with check (public.my_role() in ('admin','dispatcher'));
--      create policy "loads_update_dispatch" on public.loads
--        for update to authenticated using (public.my_role() in ('admin','dispatcher','accounting'));

alter table public.profiles add column if not exists role text not null default 'admin';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (
  role in ('admin','dispatcher','warehouse','accounting','viewer')
);

insert into public.profiles (id)
select u.id from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'viewer');
$$;
