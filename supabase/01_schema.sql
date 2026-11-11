-- MORI BONSAI WEB v0.2 — Executar em projeto Supabase NOVO.
-- Ao executar no SQL Editor, use a conta proprietária do projeto.
-- A aplicação não recebe permissões para criar coleções ou adicionar membros.

create extension if not exists pgcrypto;

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now()
);

create table if not exists public.collection_members (
  collection_id uuid not null references public.collections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (collection_id, user_id)
);

create table if not exists public.plants (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  scientific_name text check (scientific_name is null or char_length(scientific_name) <= 160),
  area text not null default 'Jardim' check (area in ('Jardim', 'Área protegida')),
  acquired_on date,
  notes text check (notes is null or char_length(notes) <= 5000),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists plants_collection_active_idx on public.plants (collection_id, created_at desc) where deleted_at is null;
create index if not exists members_user_idx on public.collection_members (user_id, collection_id);

alter table public.collections enable row level security;
alter table public.collection_members enable row level security;
alter table public.plants enable row level security;

-- Evita recursão de políticas ao consultar membros da coleção.
-- A função não concede dados: retorna apenas true/false sobre a própria conta.
create or replace function public.is_collection_member(_collection_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.collection_members cm
    where cm.collection_id = _collection_id
      and cm.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_collection_member(uuid) from public, anon;
grant execute on function public.is_collection_member(uuid) to authenticated;

-- Princípio do menor privilégio; membros são adicionados somente pelo SQL Editor/admin.
revoke all on table public.collections, public.collection_members, public.plants from anon, authenticated;
grant select on public.collections, public.collection_members to authenticated;
grant select, insert on public.plants to authenticated;
grant update (name, scientific_name, area, acquired_on, notes, deleted_at) on public.plants to authenticated;

create policy "member reads collections" on public.collections for select to authenticated
  using (public.is_collection_member(id));
create policy "member reads memberships" on public.collection_members for select to authenticated
  using (public.is_collection_member(collection_id));
create policy "member reads active plants" on public.plants for select to authenticated
  using (public.is_collection_member(collection_id) and deleted_at is null);
create policy "member adds plants" on public.plants for insert to authenticated
  with check (public.is_collection_member(collection_id) and created_by = (select auth.uid()) and deleted_at is null);
create policy "member edits active plants" on public.plants for update to authenticated
  using (public.is_collection_member(collection_id) and deleted_at is null)
  with check (public.is_collection_member(collection_id));

-- Não existe política DELETE nem grant DELETE: a interface faz apenas exclusão lógica.
-- Para rodar novamente, remova manualmente as políticas existentes antes da reexecução.
