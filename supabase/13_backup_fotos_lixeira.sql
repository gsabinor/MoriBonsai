-- MORI BONSAI WEB v1.0 — Leitura privada de fotografias de exemplares na Lixeira.
-- EXECUTAR UMA VEZ no mesmo Supabase após migração 12.
-- Não remove tabelas, registros ou arquivos. NÃO concede permissões de escrita.
-- Necessária para que o backup da coleção inclua imagens de plantas na lixeira.
begin;
do $$
begin
  if to_regclass('public.plant_photos') is null or to_regclass('public.plants') is null
    or to_regclass('public.collection_members') is null then
    raise exception 'Tabelas do Mori Bonsai não encontradas: confira o projeto Supabase.';
  end if;
  if not exists (select 1 from storage.buckets where id='mori-photos') then
    raise exception 'Bucket privado mori-photos não encontrado.';
  end if;
end $$;

-- Políticas adicionais de SELECT são combinadas com as já existentes (OR).
-- Como a foto pertence a um exemplar excluído logicamente, só membros
-- autenticados da própria coleção podem consultar os metadados.
do $$
begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='plant_photos' and policyname='mori backup read trashed photo metadata') then
  execute $pol$create policy "mori backup read trashed photo metadata"
    on public.plant_photos for select to authenticated
    using (public.is_collection_member(collection_id) and exists (
      select 1 from public.plants p where p.id=plant_id
        and p.collection_id=plant_photos.collection_id and p.deleted_at is not null
    ))$pol$;
 end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='mori backup read trashed photo files') then
  execute $pol$create policy "mori backup read trashed photo files"
    on storage.objects for select to authenticated
    using (bucket_id='mori-photos' and exists (
      select 1 from public.plants p
      join public.collection_members m on m.collection_id=p.collection_id
      where p.collection_id::text=split_part(name,'/',1)
        and p.id::text=split_part(name,'/',2)
        and p.deleted_at is not null and m.user_id=(select auth.uid())
    ))$pol$;
 end if;
end $$;
commit;

-- Checagem administrativa:
-- select policyname, cmd from pg_policies
-- where (schemaname='public' and tablename='plant_photos')
--    or (schemaname='storage' and tablename='objects');
