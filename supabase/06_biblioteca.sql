-- MORI BONSAI WEB v0.4 — BIBLIOTECA TECNICA (migração incremental)
-- Executar UMA vez no mesmo Supabase da v0.3.2, após 05_corrigir_storage_rls.sql.
-- Não executa DROP, não apaga fotos, não modifica o bucket nem recria as tabelas antigas.
-- A biblioteca e por colecao, e os vinculos com exemplares são SEMPRE manuais.

begin;

-- Interrompe a migração se o projeto errado estiver aberto.
do $$
begin
  if to_regclass('public.collections') is null or to_regclass('public.plants') is null
     or to_regclass('public.collection_members') is null or to_regclass('public.plant_photos') is null then
    raise exception 'Mori Bonsai v0.3 não encontrado neste projeto. Confira o Supabase selecionado.';
  end if;
end $$;

create table public.species (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  popular_name text not null check (char_length(trim(popular_name)) between 1 and 160),
  scientific_name text check (scientific_name is null or char_length(scientific_name) <= 200),
  family text check (family is null or char_length(family) <= 160),
  context text check (context is null or char_length(context) <= 10000),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint species_collection_pair unique (id, collection_id)
);

-- Nomes cientificos iguais na MESMA colecao nao podem criar duas fichas.
-- Nomes nao identificados podem existir sem assumir identidade botanica.
create unique index species_scientific_per_collection_idx
  on public.species (collection_id, lower(btrim(scientific_name)))
  where scientific_name is not null and btrim(scientific_name) <> '';
create index species_collection_idx on public.species (collection_id, popular_name);

-- Confere formato do importador antigo, incluindo a ordem exata dos 40 campos.
create function public.mori_guide_is_valid(_doc jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  item jsonb;
  i integer;
  key_name text;
begin
  if _doc is null or jsonb_typeof(_doc) <> 'object' or length(_doc::text) > 240000 then return false; end if;
  foreach key_name in array array['nomePopular','nomeCientifico','familia','contexto'] loop
    if jsonb_typeof(_doc -> key_name) is distinct from 'string' then return false; end if;
    if length(_doc ->> key_name) > 10000 then return false; end if;
  end loop;
  if jsonb_typeof(_doc -> 'campos') is distinct from 'array' then return false; end if;
  if jsonb_array_length(_doc -> 'campos') <> 40 then return false; end if;
  for i in 0..39 loop
    item := (_doc -> 'campos') -> i;
    if jsonb_typeof(item) is distinct from 'object' or (item ->> 'numero') is distinct from (i+1)::text then return false; end if;
    foreach key_name in array array['orientacao','condicoes','bh','fontes'] loop
      if jsonb_typeof(item -> key_name) is distinct from 'string' then return false; end if;
      if length(item ->> key_name) > 15000 then return false; end if;
    end loop;
    if (item ->> 'evidencia') not in ('Não Confirmado','Evidência indireta','Confirmado para a espécie') then return false; end if;
    if (item ->> 'evidencia') <> 'Não Confirmado' and btrim(item ->> 'fontes') = '' then return false; end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;

revoke all on function public.mori_guide_is_valid(jsonb) from public, anon;
grant execute on function public.mori_guide_is_valid(jsonb) to authenticated;

create table public.species_guides (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null,
  species_id uuid not null,
  status text not null default 'draft' check (status in ('draft','approved')),
  content jsonb not null check (public.mori_guide_is_valid(content)),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  foreign key (species_id, collection_id) references public.species(id, collection_id) on delete cascade,
  constraint approval_date_consistent check ((status='draft' and approved_at is null) or (status='approved' and approved_at is not null))
);

create unique index species_one_draft_idx on public.species_guides(species_id) where status = 'draft';
create index species_guides_versions_idx on public.species_guides(species_id, created_at desc);

-- Impede que um guia aprovado seja sobrescrito ou que se publique uma ficha vazia.
-- A data da aprovação é estabelecida pelo banco, e não pelo navegador.
create function public.mori_guide_guard()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' or new.approved_at is not null then
      raise exception 'Novas fichas só podem ser criadas como rascunho.';
    end if;
    return new;
  end if;
  if old.status = 'approved' then
    raise exception 'Uma ficha aprovada é imutável. Crie um novo rascunho para revisá-la.';
  end if;
  if new.status = 'approved' then
    if new.content is distinct from old.content then
      raise exception 'Salve o rascunho antes de aprovar.';
    end if;
    if not exists (
      select 1 from jsonb_array_elements(new.content -> 'campos') as el(value)
      where btrim(el.value ->> 'orientacao') <> ''
    ) then
      raise exception 'Não é possível aprovar uma ficha com todos os campos vazios.';
    end if;
    new.approved_at := now();
  elsif new.status <> 'draft' then
    raise exception 'Transição inválida de status.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger mori_guide_write_guard before insert or update on public.species_guides
for each row execute function public.mori_guide_guard();

-- Vinculo opcional: uma ficha de espécie compartilhada por N exemplares.
-- A chave composta impede que se associe exemplar e especie de colecoes diferentes.
alter table public.plants add column species_id uuid;
alter table public.plants add constraint plants_species_in_same_collection
  foreign key (species_id, collection_id) references public.species(id, collection_id);
create index plants_species_idx on public.plants(species_id) where species_id is not null and deleted_at is null;

-- Segurança: leitura e escrita só para membros autenticados da mesma coleção.
alter table public.species enable row level security;
alter table public.species_guides enable row level security;
revoke all on public.species, public.species_guides from public, anon, authenticated;
grant select, insert on public.species to authenticated;
grant update (popular_name, scientific_name, family, context) on public.species to authenticated;
grant select, insert on public.species_guides to authenticated;
grant update (content, status) on public.species_guides to authenticated;
grant update (species_id) on public.plants to authenticated;

create policy "mori species read" on public.species for select to authenticated
using (public.is_collection_member(collection_id));
create policy "mori species insert" on public.species for insert to authenticated
with check (public.is_collection_member(collection_id) and created_by = (select auth.uid()));
create policy "mori species edit" on public.species for update to authenticated
using (public.is_collection_member(collection_id))
with check (public.is_collection_member(collection_id));

create policy "mori guides read" on public.species_guides for select to authenticated
using (public.is_collection_member(collection_id));
create policy "mori guides insert" on public.species_guides for insert to authenticated
with check (public.is_collection_member(collection_id) and created_by = (select auth.uid()));
create policy "mori guides edit draft" on public.species_guides for update to authenticated
using (public.is_collection_member(collection_id) and status='draft')
with check (public.is_collection_member(collection_id));

commit;

-- Conferência somente leitura após execução:
-- select table_name from information_schema.tables
--   where table_schema='public' and table_name in ('species','species_guides');
-- select column_name from information_schema.columns
--   where table_schema='public' and table_name='plants' and column_name='species_id';
