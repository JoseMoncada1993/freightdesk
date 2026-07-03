-- Applied live on 2026-07-03 as "function_hardening".
-- Security advisor fixes: pin search_path on all functions (prevents
-- search-path hijacking) and stop internal functions from being callable
-- through the public REST API.

alter function public.set_updated_at() set search_path = public;
alter function public.add_load(text,text,text,text,text,numeric,integer,timestamptz,timestamptz) set search_path = public;
alter function public.record_inventory_movement(bigint,bigint,text,numeric,text,text) set search_path = public;
alter function public.handle_new_user() set search_path = public;

revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.my_role() from anon;

-- Remaining advisor WARNs are intentional at this stage:
--  * "RLS policy always true" on operational tables — a one-person company
--    where every authenticated user is the owner. Tighten with my_role()
--    per 0011 when hiring.
--  * "Leaked password protection disabled" — enable in the Supabase
--    dashboard: Authentication -> Providers -> Password -> enable
--    leaked-password protection (one click, no code change).
