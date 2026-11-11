-- MORI BONSAI WEB v0.3 — MIGRAÇÃO INCREMENTAL DE FOTOGRAFIAS
-- Executar UMA vez no SQL Editor do MESMO projeto Supabase da v0.2,
-- após 01_schema.sql e a associação dos usuários.
-- NÃO apague tabelas existentes e NÃO execute 01_schema.sql novamente.

create table if not exists public.plant_photos (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  plant_id uuid not null references public.plants(id) on delete cascade,
  storage_path text not null unique,
  uploaded_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  constraint photos_path_matches_plant check (
    storage_path like collection_id::text || '/' || plant_id::text || '/%'
  )
);

create index if not exists plant_photos_by_plant_idx
  on public.plant_photos (plant_id, created_at desc);
create index if not exists plant_photos_by_collection_idx
  on public.plant_photos (collection_id, plant_id);

alter table public.plant_photos enable row level security;
revoke all on public.plant_photos from anon, authenticated;
grant select, insert, delete on public.plant_photos to authenticated;

-- Somente membros da coleção e apenas fotos associadas a plantas ativas.
create policy "photos visible to collection members" on public.plant_photos
  for select to authenticated
  using (
    public.is_collection_member(collection_id)
    and exists (
      select 1 from public.plants p
      where p.id = plant_id
      and p.collection_id = plant_photos.collection_id
      and p.deleted_at is null
    )
  );

create policy "members insert photos for their plants" on public.plant_photos
  for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and public.is_collection_member(collection_id)
    and exists (
      select 1 from public.plants p
      where p.id = plant_id
      and p.collection_id = plant_photos.collection_id
      and p.deleted_at is null
    )
  );

create policy "members delete photos for their plants" on public.plant_photos
  for delete to authenticated
  using (
    public.is_collection_member(collection_id)
    and exists (
      select 1 from public.plants p
      where p.id = plant_id
      and p.collection_id = plant_photos.collection_id
      and p.deleted_at is null
    )
  );

-- Bucket privado, limitado a imagens comuns de até 5 MB por arquivo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mori-photos', 'mori-photos', false, 5242880,
        array['image/jpeg','image/png','image/webp']::text[])
on conflict (id) do nothing;

-- Caminho obrigatório: <collection_uuid>/<plant_uuid>/<image_uuid>.webp
-- Verificação por texto evita erro de conversão UUID para caminhos malformados.
create policy "members view their bonsai photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'mori-photos'
    and exists (
      select 1 from public.plants p
      where p.collection_id::text = (storage.foldername(name))[1]
        and p.id::text = (storage.foldername(name))[2]
        and p.deleted_at is null
        and public.is_collection_member(p.collection_id)
    )
  );

create policy "members upload their bonsai photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'mori-photos'
    and exists (
      select 1 from public.plants p
      where p.collection_id::text = (storage.foldername(name))[1]
        and p.id::text = (storage.foldername(name))[2]
        and p.deleted_at is null
        and public.is_collection_member(p.collection_id)
    )
  );

create policy "members delete their bonsai photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'mori-photos'
    and exists (
      select 1 from public.plants p
      where p.collection_id::text = (storage.foldername(name))[1]
        and p.id::text = (storage.foldername(name))[2]
        and p.deleted_at is null
        and public.is_collection_member(p.collection_id)
    )
  );

-- Verificações administrativas (SQL Editor):
-- select id, public, file_size_limit, allowed_mime_types from storage.buckets where id='mori-photos';
-- select tablename, policyname from pg_policies where schemaname in ('public','storage') and tablename in ('plant_photos','objects');
