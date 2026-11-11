-- MORI BONSAI WEB v1.2 — PLANOS & DESEJOS
-- Executar UMA VEZ, depois das migrações 01 a 13, no projeto Supabase EXISTENTE.
-- Não toca nas plantas, biblioteca, fotos, manejos ou planejamentos.
-- Sem DELETE físico: itens saem da lista para 'Arquivados' e podem ser recuperados.

begin;

do $$
begin
  if to_regclass('public.collections') is null
     or to_regclass('public.collection_members') is null
     or to_regclass('public.plants') is null
     or to_regclass('public.care_plans') is null then
    raise exception 'Projeto Mori Bonsai incompleto. Verifique as migrações anteriores.';
  end if;
  if to_regprocedure('public.is_collection_member(uuid)') is null then
    raise exception 'Função de segurança is_collection_member ausente.';
  end if;
  if to_regclass('public.wishlist_items') is not null then
    raise exception 'wishlist_items já existe. Não execute a migração 14 novamente.';
  end if;
end $$;

create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  category text not null check (category in ('species', 'substrate', 'item')),
  title text not null check (char_length(btrim(title)) between 1 and 140),
  scientific_name text check (scientific_name is null or char_length(scientific_name) <= 160),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  status text not null default 'pending' check (status in ('pending', 'researching', 'done')),
  quantity numeric(10,2) check (quantity is null or (quantity > 0 and quantity <= 999999)),
  unit text check (unit is null or char_length(unit) <= 30),
  estimated_price numeric(12,2) check (estimated_price is null or estimated_price >= 0),
  shop text check (shop is null or char_length(shop) <= 120),
  item_url text check (item_url is null or (char_length(item_url) <= 2048 and item_url ~* '^https?://[^[:space:]]+')),
  notes text check (notes is null or char_length(notes) <= 3000),
  completed_at timestamptz,
  archived_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index wishlist_items_by_collection_category
  on public.wishlist_items(collection_id, category, created_at desc);
create index wishlist_items_active_priority
  on public.wishlist_items(collection_id, priority, created_at desc)
  where archived_at is null;

create function public.mori_wishlist_touch()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.status = 'done' and old.status <> 'done' then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger mori_wishlist_updated
before update on public.wishlist_items
for each row execute function public.mori_wishlist_touch();

alter table public.wishlist_items enable row level security;
revoke all on public.wishlist_items from public, anon, authenticated;
grant select, insert on public.wishlist_items to authenticated;
grant update (title, scientific_name, priority, status, quantity, unit, estimated_price, shop, item_url, notes, archived_at)
  on public.wishlist_items to authenticated;
-- Criador e coleção não podem ser alterados pelo frontend.
-- Nenhum GRANT DELETE.

create policy "mori wishlist select" on public.wishlist_items
for select to authenticated
using (public.is_collection_member(collection_id));

create policy "mori wishlist insert" on public.wishlist_items
for insert to authenticated
with check (
  public.is_collection_member(collection_id)
  and created_by = (select auth.uid())
  and archived_at is null and completed_at is null
  and status = 'pending'
);

create policy "mori wishlist update" on public.wishlist_items
for update to authenticated
using (public.is_collection_member(collection_id))
with check (public.is_collection_member(collection_id));

commit;

-- Conferência opcional, somente leitura:
-- select column_name, data_type from information_schema.columns
-- where table_schema='public' and table_name='wishlist_items' order by ordinal_position;
-- select policyname, cmd, roles from pg_policies
-- where schemaname='public' and tablename='wishlist_items';
