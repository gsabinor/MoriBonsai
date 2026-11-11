-- MORI BONSAI WEB v0.7 - CAPA E EVOLUCAO FOTOGRAFICA
-- MIGRACAO INCREMENTAL; executar apenas apos as migracoes 01..07 e a correcao 05.
-- Mantem o bucket mori-photos privado e as politicas existentes em storage.objects.
-- Nao apaga fotos nem exemplares. Requer PostgreSQL 15+ (security_invoker).

begin;

do $$
begin
  if to_regclass('public.plant_photos') is null then
    raise exception 'Tabela plant_photos nao encontrada. Execute as migracoes anteriores no projeto correto.';
  end if;
end;
$$;

alter table public.plant_photos
  add column if not exists captured_on date,
  add column if not exists caption text,
  add column if not exists is_cover boolean not null default false;

-- Pequena anotacao por foto; nao modifica dados antigos.
alter table public.plant_photos
  drop constraint if exists mori_photo_caption_length;
alter table public.plant_photos
  add constraint mori_photo_caption_length check (caption is null or char_length(caption) <= 500);

-- Uma capa explicitamente selecionada por planta; se nenhuma foi escolhida,
-- a interface utiliza a fotografia mais recente como capa provisoria.
create unique index if not exists mori_photo_one_cover_per_plant
  on public.plant_photos (plant_id) where is_cover;
create index if not exists mori_photo_by_date
  on public.plant_photos (collection_id, plant_id, captured_on desc, created_at desc);

-- Somente estas duas colunas podem ser editadas diretamente pelo aplicativo;
-- selecionar a capa exige a funcao autorizada abaixo.
grant update (captured_on, caption) on public.plant_photos to authenticated;

drop policy if exists "members edit their photo details" on public.plant_photos;
create policy "members edit their photo details"
on public.plant_photos for update to authenticated
using (
  public.is_collection_member(collection_id)
  and exists (
    select 1 from public.plants p
    where p.id = plant_id and p.collection_id = plant_photos.collection_id
      and p.deleted_at is null
  )
)
with check (
  public.is_collection_member(collection_id)
  and exists (
    select 1 from public.plants p
    where p.id = plant_id and p.collection_id = plant_photos.collection_id
      and p.deleted_at is null
  )
);

-- A chamada executa a troca de capa de forma atomica, inclusive com dois
-- usuarios conectados ao mesmo tempo. A planta e bloqueada na transacao.
create or replace function public.set_mori_plant_cover(p_plant_id uuid, p_photo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_collection_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Autenticacao obrigatoria' using errcode = '42501';
  end if;

  select p.collection_id into v_collection_id
  from public.plants p
  join public.collection_members cm
    on cm.collection_id = p.collection_id
  where p.id = p_plant_id and p.deleted_at is null
    and cm.user_id = (select auth.uid())
  for update of p;

  if v_collection_id is null then
    raise exception 'Exemplar inexistente ou acesso nao autorizado' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.plant_photos ph
    where ph.id = p_photo_id and ph.plant_id = p_plant_id
      and ph.collection_id = v_collection_id
  ) then
    raise exception 'Foto nao pertence ao exemplar informado' using errcode = '42501';
  end if;

  update public.plant_photos ph set is_cover = false
  where ph.plant_id = p_plant_id and ph.collection_id = v_collection_id and ph.is_cover;
  update public.plant_photos ph set is_cover = true
  where ph.id = p_photo_id and ph.plant_id = p_plant_id and ph.collection_id = v_collection_id;
end;
$$;
revoke all on function public.set_mori_plant_cover(uuid,uuid) from public, anon;
grant execute on function public.set_mori_plant_cover(uuid,uuid) to authenticated;

-- Consulta leve: somente uma fotografia por exemplar, RLS aplicado na tabela base.
create or replace view public.mori_plant_cover_photos
with (security_invoker = true)
as
select distinct on (ph.plant_id)
  ph.plant_id, ph.collection_id, ph.id as photo_id,
  ph.storage_path, ph.captured_on, ph.created_at
from public.plant_photos ph
order by ph.plant_id, ph.is_cover desc,
  ph.captured_on desc nulls last, ph.created_at desc, ph.id desc;
revoke all on public.mori_plant_cover_photos from public, anon;
grant select on public.mori_plant_cover_photos to authenticated;

commit;

-- Conferencia (somente leitura):
-- select column_name from information_schema.columns where table_schema='public' and table_name='plant_photos';
-- select viewname from pg_views where schemaname='public' and viewname='mori_plant_cover_photos';
-- select policyname from pg_policies where schemaname='public' and tablename='plant_photos';
