-- 0022: Per-manifest Store value (applied live 2026-07-15).
-- Fills the "Store" column of the manifest template export; editable per
-- manifest (falls back to the linked SKU convention's store when null).
alter table public.manifests add column if not exists store text;
