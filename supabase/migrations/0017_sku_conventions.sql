-- 0017: SKU convention reference (supplier -> location / program / prefix).
-- Applied live on 2026-07-07 as "sku_conventions" + a data seed from the
-- vendor's "SKU Convention.xlsx". Powers auto-fill in the SKU Generator:
-- pick a supplier and location/program/prefix populate. New suppliers can be
-- added from the UI. RLS mirrors the skus module (read: all; write: admin+dispatcher).

create table if not exists public.sku_conventions (
  id bigint generated always as identity primary key,
  supplier text not null unique,
  location text,
  program text,
  prefix text not null,
  created_at timestamptz not null default now()
);

alter table public.sku_conventions enable row level security;

drop policy if exists "sku_conventions_select_all" on public.sku_conventions;
drop policy if exists "sku_conventions_insert_dispatch" on public.sku_conventions;
drop policy if exists "sku_conventions_update_dispatch" on public.sku_conventions;
drop policy if exists "sku_conventions_delete_dispatch" on public.sku_conventions;

create policy "sku_conventions_select_all" on public.sku_conventions
  for select to authenticated using (true);
create policy "sku_conventions_insert_dispatch" on public.sku_conventions
  for insert to authenticated with check (public.my_role() in ('admin','dispatcher'));
create policy "sku_conventions_update_dispatch" on public.sku_conventions
  for update to authenticated
  using (public.my_role() in ('admin','dispatcher'))
  with check (public.my_role() in ('admin','dispatcher'));
create policy "sku_conventions_delete_dispatch" on public.sku_conventions
  for delete to authenticated using (public.my_role() in ('admin','dispatcher'));

-- Seed (program derived from the supplier descriptor: Salvage/LQ/Aged/QC/HDO/Perigold/Exit).
insert into public.sku_conventions (supplier, location, program, prefix) values
('Liquidity Services Amazon BFL2','Shafter,CA',null,'AMZTL2BFL'),
('Liquidity Services Amazon TUS','Tucson,AZ',null,'AMZTLTUS'),
('Bstock Amazon BFL1','Bakersfield,CA',null,'AMZTBBFL'),
('WayFair Perris Salvage','Perris,CA','Salvage','WYFPRS'),
('WayFair Perris LQ','Perris,CA','LQ','WYFPRLQ'),
('WayFair Perris Aged','Perris,CA','Aged','WYFPRA'),
('WayFair Perris QC','Perris,CA','QC','WYFPRQC'),
('WayFair Aberdeen LQ','Aberdeen,MD','LQ','WYFAMDLQ'),
('WayFair Aberdeen Salvage','Aberdeen,MD','Salvage','WYFAMDS'),
('WayFair Jacksonville LQ','Jacksonville,FL','LQ','WYFJFLLQ'),
('WayFair Jacksonville Salvage','Jacksonville,FL','Salvage','WYFJFLS'),
('Wayfair Lancaster,TX LQ','Lancaster,TX','LQ','WYFLTXLQ'),
('Wayfair Lancaster,TX Salvage','Lancaster,TX','Salvage','WYFLTXS'),
('Wayfair Lathrop,CA','Lathrop,CA',null,'WYFLAA'),
('Wayfair Romeoville,IL LQ','Romeoville,IL','LQ','WYFRILLQ'),
('Wayfair Romeoville,IL Salvage','Romeoville,IL','Salvage','WYFRILS'),
('Wayfair City of Industry,CA HDO','City of Industry','HDO','WYFCIHDO'),
('Wayfair Portland,OR HDO','Portland,OR','HDO','WYFPORHDO'),
('WayFair Aberdeen AGED','Aberdeen,MD','Aged','WYFAMDA'),
('WayFair Erlanger,KY AGED','Erlanger,KY','Aged','WYFEKYA'),
('Wayfair Lancaster,TX Aged','Lancaster,TX','Aged','WYFLTXA'),
('Wayfair Kent,WA LQ','Kent WA','LQ','WYFKWALQ'),
('Wayfair Perigold Houston,TX','Houston,TX','Perigold','WYFHTXPG'),
('WayFair Jacksonville QC','Jacksonville,FL','QC','WYFJFLQC'),
('Wayfair Romeoville,IL QC','Romeoville,IL','QC','WYFRILQC'),
('Walmart Exit Store# 2217','FORT WORTH,TX','Exit','WMCMDETXB'),
('Walmart Exit Store# 7767','FORT WORTH,TX','Exit','WMCMDETXB'),
('Walmart Exit Store# 3006','LANCASTER,TX','Exit','WMCMDETXB'),
('Walmart Exit Store# 3865','FORT WORTH,TX','Exit','WMCMDETXB'),
('Walmart Exit Store# 3559','ELWOOD,IL','Exit','WMCMDEILB'),
('Walmart Exit Store# 6833','JURUPA VALLEY,CA','Exit','WMCMDEJVB'),
('Walmart Exit Store# 9202','EDGERTON,KS','Exit','WMCMDEKSB'),
('Walmart Exit Store# 8103','CHINO,CA','Exit','WMCMDELX1B'),
('Walmart Exit Store# 7049','CHINO,CA','Exit','WMCMDELX2B'),
('Walmart Exit Store# 4034','TOPEKA,KS','Exit','WMCMDEKSB'),
('Walmart Exit Store# 9204','SPARKS,NV','Exit','WMCMDENVB'),
('Walmart Exit Store# 3108','GLENDALE,AZ','Exit','WMCMDEPHXB'),
('Walmart Exit Store# 6749','SALT LAKE CITY,UT','Exit','WMCMDESLCB'),
('Walmart Exit Store# 4027','SACRAMENTO,CA','Exit','WMCMDESAB'),
('Walmart Exit Store# 6029','HURRICANE, UT','Exit','WMDEUTB'),
('Walmart Exit Store# 6009','Mt. Pleasant, IA','Exit','WMDEIAB'),
('Walmart Exit Store# 6012','Plainview, TX','Exit','WMDETXB'),
('Walmart Exit Store# 6019','Loveland, CO','Exit','WMDECOB'),
('Walmart Exit Store# 6021','Porterville, CA','Exit','WMDECAB'),
('Walmart Exit Store# 6025','Menomonie, WI','Exit','WMDEWIB'),
('Walmart Exit Store# 6026','RED BLUFF, CA','Exit','WMDECAB'),
('Walmart Exit Store# 6031','BUCKEYE, AZ','Exit','WMDEAZB'),
('Walmart Exit Store# 6037','HERMISTON, OR','Exit','WMDEORB'),
('Walmart Exit Store# 6561','COLTON, CA','Exit','WMDECAB'),
('Walmart Exit Store# 7026','GRANTSVILLE, UT','Exit','WMDEUTB'),
('Walmart Exit Store# 7033','Apple Valley, CA','Exit','WMDECAB'),
('Walmart Exit Store# 7039','Beaver Dam, WI','Exit','WMDEWIB'),
('Walmart Exit Store# 6060','EASTVALE, CA','Exit','WMDECAB'),
('Walmart Exit Store# 7089','South Gate, CA','Exit','WMDECAB'),
('Walmart Exit Store# 7092','Sumner, WA','Exit','WMDEWAB'),
('Walmart Exit Store# 7853','Davenport,FL','Exit','WMCMDEFLB'),
('Walmart Exit Store# 7552','IND3,IN','Exit','WMCMDEINB')
on conflict (supplier) do update set location=excluded.location, program=excluded.program, prefix=excluded.prefix;