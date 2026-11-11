-- MORI BONSAI WEB v0.8.1 — PLANEJAMENTO CONCLUIDO -> HISTORICO
-- Executar UMA VEZ no mesmo projeto Supabase em que 07 e 09 foram aplicados.
-- Migracao incremental: nao remove nenhum registro existente nem altera fotos/buckets.
-- Nao retroage sobre planejamentos ja concluidos ANTES desta migracao.
-- Ao concluir: cria um manejo com data completed_on, resultado Ainda nao testado.
-- Ao reabrir: oculta (exclusao logica) SOMENTE o manejo gerado automaticamente.
-- A atualizacao do plano e do historico ocorre na MESMA transacao SQL.

begin;

do $$
begin
  if to_regclass('public.care_plans') is null
     or to_regclass('public.care_logs') is null
     or to_regclass('public.plants') is null then
    raise exception 'Tabelas care_plans, care_logs ou plants ausentes. Confira as migracoes 07 e 09.';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'care_logs'
      and column_name = 'source_plan_id'
  ) then
    raise exception 'A coluna source_plan_id ja existe. Verifique se a migracao 10 ja foi aplicada antes de repetir.';
  end if;
end $$;

-- O vinculo opcional distingue registros manuais dos criados pelo planejamento.
-- A FK preserva a integridade referencial, e o indice evita duplicatas ativas.
alter table public.care_logs
  add column source_plan_id uuid
    references public.care_plans(id) on delete set null;

create unique index mori_one_active_log_per_plan
  on public.care_logs(source_plan_id)
  where source_plan_id is not null and deleted_at is null;

-- SECURITY INVOKER: respeita os GRANTs e as politicas RLS existentes no historico.
-- Importante: nao modificar a tabela de planejamento por duas chamadas do frontend.
-- O gatilho assegura que as duas operacoes ocorram na mesma transacao.
create function public.mori_sync_plan_history()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status is distinct from 'completed'
     and new.status = 'completed'
     and new.deleted_at is null then

    insert into public.care_logs (
      collection_id, plant_id, category, occurred_on, title,
      notes, outcome, outcome_notes, created_by, source_plan_id
    ) values (
      new.collection_id,
      new.plant_id,
      new.category,
      new.completed_on,
      new.title,
      new.notes,
      'not_tested',
      null,
      coalesce((select auth.uid()), new.created_by),
      new.id
    )
    on conflict do nothing;

    -- Se nao foi possivel criar ou recuperar um registro ativo vinculado,
    -- aborta tambem a conclusao do planejamento.
    if not exists (
      select 1 from public.care_logs
      where source_plan_id = new.id and deleted_at is null
    ) then
      raise exception 'Nao foi possivel vincular o manejo concluido ao historico.';
    end if;

  elsif old.status = 'completed' and new.status is distinct from 'completed' then
    -- Reabertura invalida SOMENTE o registro automatico associado.
    -- Outros registros de manejo feitos manualmente permanecem no historico.
    update public.care_logs
      set deleted_at = now()
      where source_plan_id = new.id and deleted_at is null;
  end if;

  return new;
end;
$$;

-- Funcao de gatilho nao e uma API publica.
revoke all on function public.mori_sync_plan_history() from public, anon, authenticated;

create trigger mori_plan_history_after_status
  after update of status on public.care_plans
  for each row
  when (old.status is distinct from new.status)
  execute function public.mori_sync_plan_history();

commit;

-- CONSULTA OPCIONAL (somente leitura) PARA CONFERIR A INSTALACAO:
-- select trigger_name from information_schema.triggers
--   where event_object_schema = 'public'
--     and event_object_table = 'care_plans'
--     and trigger_name = 'mori_plan_history_after_status';
-- select id, plant_id, title, occurred_on, outcome, source_plan_id
--   from public.care_logs
--   where source_plan_id is not null and deleted_at is null;
