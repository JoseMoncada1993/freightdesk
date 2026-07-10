-- 0020: Per-SKU export field overrides (applied live 2026-07-09).
-- skus.export_fields (jsonb): values for the product-template ("blue header")
-- export columns set on an individual SKU. Merged over the supplier
-- convention's product_template at export time (SKU value wins).
alter table public.skus add column if not exists export_fields jsonb;
