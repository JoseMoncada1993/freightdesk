-- 0026: allow hiding a module from a user (applied live 2026-07-22).
-- user_module_access.level gains 'hidden' — a nav-level visibility control:
-- the module is removed from that user's sidebar and its route redirects home.
-- (Data-level RLS is unchanged; hiding is a UI restriction, so cross-module
-- reads such as Shipments->SKUs keep working.)
alter table public.user_module_access drop constraint if exists user_module_access_level_check;
alter table public.user_module_access
  add constraint user_module_access_level_check check (level in ('write','view','hidden'));
