-- MORI BONSAI WEB - CORRECAO PONTUAL DE POLITICAS DE FOTOGRAFIAS
-- Usar somente no MESMO projeto Supabase onde a v0.3.2 esta conectada.
-- Nao recria tabelas, nao altera buckets e nao apaga arquivos nem registros.
-- A funcao consulta as tabelas de membros e plantas com permissoes do proprietario,
-- MAS so retorna TRUE quando o usuario autenticado pertence a colecao e a planta esta ativa.
-- O caminho exigido e: <collection_uuid>/<plant_uuid>/<photo_uuid>.webp.

begin;

-- Evita a aplicacao silenciosa no projeto errado/sem migracao de fotografias.
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'mori-photos') then
    raise exception 'Bucket mori-photos inexistente. Confira o projeto e a migracao 03_photos.sql.';
  end if;
  if to_regclass('public.collection_members') is null or to_regclass('public.plants') is null then
    raise exception 'Tabelas da colecao nao encontradas. Confira o projeto Supabase.';
  end if;
end;
$$;

create or replace function public.can_access_mori_photo_path(_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and _path ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.webp$'
    and exists (
      select 1
      from public.plants p
      join public.collection_members cm
        on cm.collection_id = p.collection_id
      where p.collection_id::text = split_part(_path, '/', 1)
        and p.id::text = split_part(_path, '/', 2)
        and p.deleted_at is null
        and cm.user_id = (select auth.uid())
    );
$$;

revoke all on function public.can_access_mori_photo_path(text) from public, anon;
grant execute on function public.can_access_mori_photo_path(text) to authenticated;

-- Substitui SOMENTE as tres politicas nomeadas do Mori Bonsai no storage.objects.
drop policy if exists "members view their bonsai photos" on storage.objects;
drop policy if exists "members upload their bonsai photos" on storage.objects;
drop policy if exists "members delete their bonsai photos" on storage.objects;

create policy "members view their bonsai photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'mori-photos'
  and public.can_access_mori_photo_path(name)
);

create policy "members upload their bonsai photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'mori-photos'
  and public.can_access_mori_photo_path(name)
);

create policy "members delete their bonsai photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'mori-photos'
  and public.can_access_mori_photo_path(name)
);

commit;

-- Verificacao somente leitura (executar apos a migracao):
-- select policyname, cmd, roles from pg_policies
-- where schemaname = 'storage' and tablename = 'objects'
--   and policyname like 'members % bonsai photos'
-- order by policyname;
