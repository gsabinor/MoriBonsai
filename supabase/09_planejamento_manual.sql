-- MORI BONSAI WEB v0.8 — PLANEJAMENTO MANUAL
-- Aplicar uma única vez após as migrações 01–08, no projeto Supabase existente.
-- Não remove nem modifica dados anteriores e não altera o Storage.
-- Os planos NÃO são alertas automáticos de rega nem histórico de manejos executados.

begin;

do $$
begin
  if to_regclass('public.collections') is null
    or to_regclass('public.collection_members') is null
    or to_regclass('public.plants') is null
    or to_regclass('public.care_logs') is null
    or to_regclass('public.species_guides') is null
    or to_regclass('public.plant_photos') is null then
    raise exception 'Tabelas anteriores ausentes. Verifique o projeto e as migrações da v0.7.';
  end if;
  if to_regclass('public.care_plans') is not null then
    raise exception 'care_plans já existe. Não execute a migração 09 novamente.';
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.plants'::regclass
                   and conname = 'plants_id_collection_unique') then
    raise exception 'Constraint plants_id_collection_unique ausente. Confira a migração 07.';
  end if;
end $$;

create table public.care_plans (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null,
  plant_id uuid not null,
  category text not null check (category in (
    'Poda estrutural', 'Poda de manutenção', 'Transplante', 'Poda radicular',
    'Aramação', 'Retirada de arame', 'Desfolha', 'Adubação',
    'Tratamento fitossanitário', 'Observação', 'Outro'
  )),
  title text not null check (char_length(btrim(title)) between 1 and 140),
  planned_for date not null,
  notes text check (notes is null or char_length(notes) <= 5000),
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'cancelled')),
  completed_on date,
  constraint plan_completion_consistent
    check ((status = 'completed') = (completed_on is not null)),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint plan_plant_same_collection foreign key (plant_id, collection_id)
    references public.plants(id, collection_id) on delete cascade
);

create index care_plans_collection_status_date_idx
  on public.care_plans (collection_id, status, planned_for, id)
  where deleted_at is null;
create index care_plans_plant_date_idx
  on public.care_plans (plant_id, planned_for, id)
  where deleted_at is null;

-- Testa a participação do usuário e a existência de um exemplar ativo.
-- Função com search_path vazio e referências qualificadas evita recursão de RLS.
create function public.can_access_mori_care_plan(_collection_id uuid, _plant_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.collection_members cm
      join public.plants p on p.collection_id = cm.collection_id
                          and p.id = _plant_id
      where cm.user_id = (select auth.uid())
        and cm.collection_id = _collection_id
        and p.deleted_at is null
    );
$$;
revoke all on function public.can_access_mori_care_plan(uuid, uuid) from public, anon;
grant execute on function public.can_access_mori_care_plan(uuid, uuid) to authenticated;

-- O cliente não pode atribuir created_by nem editar updated_at.
create function public.mori_care_plan_touch()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger mori_care_plan_updated_at
before update on public.care_plans
for each row execute function public.mori_care_plan_touch();

alter table public.care_plans enable row level security;
revoke all on table public.care_plans from public, anon, authenticated;
grant select, insert on table public.care_plans to authenticated;
grant update (category, title, planned_for, notes, status, completed_on, deleted_at)
  on table public.care_plans to authenticated;
-- Sem GRANT DELETE. O aplicativo realiza exclusão lógica.

create policy "mori plan read" on public.care_plans
for select to authenticated
using (deleted_at is null
       and public.can_access_mori_care_plan(collection_id, plant_id));

create policy "mori plan insert" on public.care_plans
for insert to authenticated
with check (
  deleted_at is null
  and created_by = (select auth.uid())
  and public.can_access_mori_care_plan(collection_id, plant_id)
);

create policy "mori plan update" on public.care_plans
for update to authenticated
using (deleted_at is null
       and public.can_access_mori_care_plan(collection_id, plant_id))
with check (public.can_access_mori_care_plan(collection_id, plant_id));

commit;

-- Conferência, SOMENTE leitura (opcional):
-- select column_name, data_type from information_schema.columns
-- where table_schema = 'public' and table_name = 'care_plans' order by ordinal_position;
-- select policyname, cmd, roles from pg_policies
-- where schemaname = 'public' and tablename = 'care_plans' order by policyname;
