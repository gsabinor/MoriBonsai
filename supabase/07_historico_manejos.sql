-- MORI BONSAI WEB v0.5 — HISTORICO DE MANEJOS
-- Executar UMA VEZ, SOMENTE depois de 06_biblioteca.sql, no mesmo projeto Supabase.
-- Migração incremental: não apaga exemplares, fotografias, fichas nem buckets.
-- Objetivo: registro de eventos realizados (NÃO cria agenda de regas).

begin;

-- Defesa contra execução em um Supabase novo ou no projeto incorreto.
do $$
begin
  if to_regclass('public.collections') is null
    or to_regclass('public.collection_members') is null
    or to_regclass('public.plants') is null
    or to_regclass('public.species_guides') is null
    or to_regclass('public.plant_photos') is null then
    raise exception 'Estrutura da v0.4 não encontrada. Verifique o projeto e execute 06_biblioteca.sql antes.';
  end if;
  if to_regclass('public.care_logs') is not null then
    raise exception 'A tabela care_logs já existe. Não execute a migração 07 novamente.';
  end if;
end $$;

-- FK composta garante que o exemplar pertence à coleção do registro.
-- Uma constraint UNIQUE adicional não remove nem modifica os registros existentes.
alter table public.plants
  add constraint plants_id_collection_unique unique (id, collection_id);

create table public.care_logs (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null,
  plant_id uuid not null,
  category text not null check (category in (
    'Poda estrutural', 'Poda de manutenção', 'Transplante', 'Poda radicular',
    'Aramação', 'Retirada de arame', 'Desfolha', 'Adubação',
    'Tratamento fitossanitário', 'Rega excepcional', 'Observação', 'Outro'
  )),
  occurred_on date not null,
  title text not null check (char_length(btrim(title)) between 1 and 140),
  notes text check (notes is null or char_length(notes) <= 5000),
  outcome text not null default 'not_tested'
    check (outcome in ('yes', 'no', 'not_tested')),
  outcome_notes text check (outcome_notes is null or char_length(outcome_notes) <= 5000),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint care_logs_plant_same_collection
    foreign key (plant_id, collection_id)
    references public.plants (id, collection_id)
    on delete cascade
);

create index care_logs_recent_idx on public.care_logs
  (collection_id, occurred_on desc, created_at desc)
  where deleted_at is null;
create index care_logs_plant_idx on public.care_logs
  (plant_id, occurred_on desc)
  where deleted_at is null;

-- Não expõe linhas do exemplar em si: retorna apenas verdadeiro ou falso
-- ao dono de uma sessão autenticada que faz parte da coleção e cujo exemplar está ativo.
-- Pinned search_path + fully-qualified references evitam dependência das políticas RLS
-- de outras tabelas, que já causaram problemas de upload no projeto anterior.
create function public.can_access_mori_care_log(_collection_id uuid, _plant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.collection_members cm
      join public.plants p
        on p.collection_id = cm.collection_id
       and p.id = _plant_id
      where cm.user_id = (select auth.uid())
        and cm.collection_id = _collection_id
        and p.deleted_at is null
    );
$$;

revoke all on function public.can_access_mori_care_log(uuid, uuid) from public, anon;
grant execute on function public.can_access_mori_care_log(uuid, uuid) to authenticated;

-- A data de alteração é sempre gerada pelo servidor.
create function public.mori_care_log_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger mori_care_log_updated_at
before update on public.care_logs
for each row execute function public.mori_care_log_touch();

alter table public.care_logs enable row level security;
revoke all on table public.care_logs from public, anon, authenticated;
grant select, insert on public.care_logs to authenticated;
grant update (category, occurred_on, title, notes, outcome, outcome_notes, deleted_at)
  on public.care_logs to authenticated;
-- Sem GRANT DELETE e sem policy DELETE: remoção só por deleted_at.

create policy "mori care read" on public.care_logs
for select to authenticated
using (
  deleted_at is null and
  public.can_access_mori_care_log(collection_id, plant_id)
);

create policy "mori care insert" on public.care_logs
for insert to authenticated
with check (
  deleted_at is null
  and created_by = (select auth.uid())
  and public.can_access_mori_care_log(collection_id, plant_id)
);

create policy "mori care update" on public.care_logs
for update to authenticated
using (
  deleted_at is null
  and public.can_access_mori_care_log(collection_id, plant_id)
)
with check (
  public.can_access_mori_care_log(collection_id, plant_id)
);

commit;

-- Verificação opcional, somente leitura:
-- select table_name from information_schema.tables
-- where table_schema = 'public' and table_name = 'care_logs';
-- select policyname, cmd, roles from pg_policies
-- where schemaname = 'public' and tablename = 'care_logs' order by policyname;
