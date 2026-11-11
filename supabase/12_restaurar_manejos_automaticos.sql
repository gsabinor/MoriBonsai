-- MORI BONSAI WEB v0.9.1 - RESTAURACAO DE MANEJOS GERADOS POR PLANEJAMENTOS
-- Aplicar no mesmo Supabase que ja recebeu a migracao 11.
-- Corrige a restricao que impedia restaurar care_logs.source_plan_id != NULL.
-- Mantem a validacao de membro, colecao, exemplar ativo e plano concluido.
-- Apenas substitui a funcao mori_restore_trash; NAO remove tabelas, policies ou dados.

begin;

do $$
begin
  if to_regprocedure('public.mori_restore_trash(text,uuid,uuid)') is null then
    raise exception 'Aplique a migracao 11_lixeira_restauracao.sql antes desta.';
  end if;
  if to_regclass('public.care_logs') is null or to_regclass('public.care_plans') is null then
    raise exception 'Estrutura de manejos ausente. Verifique o projeto Supabase.';
  end if;
end $$;

create or replace function public.mori_restore_trash(
  _kind text, _record_id uuid, _collection_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _affected integer;
begin
  -- Nunca aceita chamadas anonimas ou de outra colecao.
  if (select auth.uid()) is null or not exists (
    select 1 from public.collection_members cm
    where cm.collection_id = _collection_id
      and cm.user_id = (select auth.uid())
  ) then
    raise exception 'Acesso nao autorizado a esta colecao.' using errcode = '42501';
  end if;

  if _kind = 'plants' then
    update public.plants p
       set deleted_at = null
     where p.id = _record_id
       and p.collection_id = _collection_id
       and p.deleted_at is not null;

  elsif _kind = 'care_logs' then
    -- Um manejo automatico so pode ser restaurado independentemente se o
    -- planejamento de origem continua ATIVO e CONCLUIDO. Caso o planejamento
    -- esteja na lixeira, restaure o planejamento; seu trigger restaura o manejo.
    -- Caso tenha sido reaberto, conclua-o novamente pelo modulo de planejamento.
    if exists (
      select 1 from public.care_logs cl
      where cl.id = _record_id
        and cl.collection_id = _collection_id
        and cl.deleted_at is not null
        and cl.source_plan_id is not null
        and not exists (
          select 1 from public.care_plans cp
          where cp.id = cl.source_plan_id
            and cp.collection_id = cl.collection_id
            and cp.plant_id = cl.plant_id
            and cp.deleted_at is null
            and cp.status = 'completed'
            and cp.completed_on is not null
        )
    ) then
      raise exception 'O planejamento de origem nao esta ativo e concluido. Restaure o planejamento excluido ou conclua novamente um planejamento reaberto.'
        using errcode = 'P0001';
    end if;

    update public.care_logs cl
       set deleted_at = null
     where cl.id = _record_id
       and cl.collection_id = _collection_id
       and cl.deleted_at is not null
       and exists (
         select 1 from public.plants p
         where p.id = cl.plant_id
           and p.collection_id = cl.collection_id
           and p.deleted_at is null
       )
       and (
         cl.source_plan_id is null
         or exists (
           select 1 from public.care_plans cp
           where cp.id = cl.source_plan_id
             and cp.collection_id = cl.collection_id
             and cp.plant_id = cl.plant_id
             and cp.deleted_at is null
             and cp.status = 'completed'
             and cp.completed_on is not null
         )
       )
       -- Respeita a restricao: apenas um historico ativo por planejamento.
       and (
         cl.source_plan_id is null
         or not exists (
           select 1 from public.care_logs active_log
           where active_log.source_plan_id = cl.source_plan_id
             and active_log.id <> cl.id
             and active_log.deleted_at is null
         )
       );

  elsif _kind = 'care_plans' then
    -- O trigger existente cuida de reativar o historico automatico quando
    -- este planejamento excluido ainda estiver com status 'completed'.
    update public.care_plans cp
       set deleted_at = null
     where cp.id = _record_id
       and cp.collection_id = _collection_id
       and cp.deleted_at is not null
       and exists (
         select 1 from public.plants p
         where p.id = cp.plant_id
           and p.collection_id = cp.collection_id
           and p.deleted_at is null
       );

  else
    raise exception 'Tipo de registro desconhecido.' using errcode = '22023';
  end if;

  get diagnostics _affected = row_count;
  if _affected <> 1 then
    raise exception 'Nao foi possivel restaurar: registro ausente, ja ativo, exemplar na lixeira ou historico automatico duplicado.'
      using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.mori_restore_trash(text,uuid,uuid) from public, anon;
grant execute on function public.mori_restore_trash(text,uuid,uuid) to authenticated;

commit;

-- Conferencia somente leitura (opcional):
-- select id, title, source_plan_id, deleted_at from public.care_logs
-- where source_plan_id is not null order by created_at desc limit 20;
