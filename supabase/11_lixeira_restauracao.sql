-- MORI BONSAI WEB v0.9 — LIXEIRA E RESTAURACAO
-- Aplicar UMA VEZ no projeto Supabase existente, DEPOIS da migracao 10.
-- Antes de executar: faca backup dos dados importantes.
-- Nao apaga arquivos, tabelas, dados ou bucket. DROP POLICY substitui somente
-- tres politicas SELECT, dentro desta transacao.
-- SELECT de registros excluidos e permitido SOMENTE a membros da colecao.
-- UPDATE direto em registro excluido continua bloqueado. Restauracao usa RPC
-- com checagens estritas de membro, colecao e planta relacionada.

begin;

do $$
begin
  if to_regclass('public.plants') is null
    or to_regclass('public.collection_members') is null
    or to_regclass('public.care_logs') is null
    or to_regclass('public.care_plans') is null then
    raise exception 'Estrutura anterior ausente. Confira as migracoes 01, 07 e 09.';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='care_logs' and column_name='source_plan_id'
  ) then
    raise exception 'A migracao 10_conclusao_gera_historico.sql deve ser aplicada primeiro.';
  end if;
end $$;

-- Verificacao de acesso a registros de manejo, inclusive da lixeira, sem
-- exigir que o exemplar esteja ativo. Esta funcao devolve somente boolean.
create or replace function public.mori_can_view_record(_collection_id uuid, _plant_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.collection_members cm
    join public.plants p on p.collection_id=cm.collection_id and p.id=_plant_id
    where cm.user_id=(select auth.uid()) and cm.collection_id=_collection_id
  );
$$;
revoke all on function public.mori_can_view_record(uuid,uuid) from public, anon;
grant execute on function public.mori_can_view_record(uuid,uuid) to authenticated;

-- SELECT de todas as linhas da colecao; as telas normais aplicam filtro
-- deleted_at is null. UPDATE so funciona sobre linhas ATIVAS (politicas antigas).
drop policy if exists "member reads active plants" on public.plants;
create policy "member reads collection plants including trash"
on public.plants for select to authenticated
using (public.is_collection_member(collection_id));

-- Registros ativos exigem planta ativa; os registros da lixeira sao visiveis
-- mesmo se a planta tambem estiver excluida, mas apenas ao membro da colecao.
drop policy if exists "mori care read" on public.care_logs;
create policy "mori care read including trash"
on public.care_logs for select to authenticated
using (
  (deleted_at is null and public.can_access_mori_care_log(collection_id,plant_id))
  or (deleted_at is not null and public.mori_can_view_record(collection_id,plant_id))
);

drop policy if exists "mori plan read" on public.care_plans;
create policy "mori plan read including trash"
on public.care_plans for select to authenticated
using (
  (deleted_at is null and public.can_access_mori_care_plan(collection_id,plant_id))
  or (deleted_at is not null and public.mori_can_view_record(collection_id,plant_id))
);

-- Restauracao atomica, apenas de registros de sua colecao.
-- A funcao nao oferece exclusao permanente nem altera fotos.
-- Historicos automaticos (source_plan_id) permanecem gerenciados pelo planejamento.
create or replace function public.mori_restore_trash(
  _kind text, _record_id uuid, _collection_id uuid
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  _affected integer;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.collection_members cm
    where cm.collection_id = _collection_id and cm.user_id=(select auth.uid())
  ) then
    raise exception 'Acesso nao autorizado a esta colecao.' using errcode = '42501';
  end if;

  if _kind = 'plants' then
    update public.plants p
       set deleted_at=null
     where p.id=_record_id and p.collection_id=_collection_id
       and p.deleted_at is not null;
  elsif _kind = 'care_logs' then
    update public.care_logs cl
       set deleted_at=null
     where cl.id=_record_id and cl.collection_id=_collection_id
       and cl.deleted_at is not null
       and cl.source_plan_id is null
       and exists (
         select 1 from public.plants p
         where p.id=cl.plant_id and p.collection_id=cl.collection_id and p.deleted_at is null
       );
  elsif _kind = 'care_plans' then
    update public.care_plans cp
       set deleted_at=null
     where cp.id=_record_id and cp.collection_id=_collection_id
       and cp.deleted_at is not null
       and exists (
         select 1 from public.plants p
         where p.id=cp.plant_id and p.collection_id=cp.collection_id and p.deleted_at is null
       );
  else
    raise exception 'Tipo de registro desconhecido.' using errcode = '22023';
  end if;

  get diagnostics _affected = row_count;
  if _affected <> 1 then
    raise exception 'Nao foi possivel restaurar: registro ausente, ja ativo ou exemplar ainda na lixeira.'
      using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.mori_restore_trash(text,uuid,uuid) from public, anon;
grant execute on function public.mori_restore_trash(text,uuid,uuid) to authenticated;

-- Ao mover um planejamento concluido para a lixeira, oculta seu historico
-- automatico. Ao restaurar, recria o historico ativo se a planta estiver ativa.
-- Essa atualizacao tambem preserva o comportamento original de concluir/reabrir.
create or replace function public.mori_sync_plan_history()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  _was_effective boolean;
  _is_effective boolean;
begin
  _was_effective := old.status = 'completed' and old.deleted_at is null;
  _is_effective  := new.status = 'completed' and new.deleted_at is null;

  if not _was_effective and _is_effective then
    -- Ao RESTAURAR um planejamento concluido, recuperar o manejo automatico
    -- anterior (e seu resultado/observacoes) em vez de criar uma copia.
    -- Restauracao ocorre pelo RPC de administrador da colecao, nao por UPDATE
    -- direto; por isso o gatilho herda o contexto do SECURITY DEFINER do RPC.
    if old.deleted_at is not null and new.deleted_at is null then
      update public.care_logs cl set deleted_at=null
      where cl.id = (
        select h.id from public.care_logs h
        where h.source_plan_id=new.id and h.deleted_at is not null
        order by h.deleted_at desc, h.created_at desc limit 1
      )
      and not exists (
        select 1 from public.care_logs h
        where h.source_plan_id=new.id and h.deleted_at is null
      );
    end if;

    if not exists (
      select 1 from public.care_logs
      where source_plan_id=new.id and deleted_at is null
    ) then
    insert into public.care_logs (
      collection_id,plant_id,category,occurred_on,title,notes,
      outcome,outcome_notes,created_by,source_plan_id
    ) values (
      new.collection_id,new.plant_id,new.category,new.completed_on,
      new.title,new.notes,'not_tested',null,
      coalesce((select auth.uid()),new.created_by),new.id
    ) on conflict do nothing;
    end if;

    if not exists (
      select 1 from public.care_logs
      where source_plan_id=new.id and deleted_at is null
    ) then
      raise exception 'Nao foi possivel vincular o manejo concluido ao historico.';
    end if;

  elsif _was_effective and not _is_effective then
    update public.care_logs set deleted_at=now()
      where source_plan_id=new.id and deleted_at is null;
  end if;
  return new;
end;
$$;
revoke all on function public.mori_sync_plan_history() from public, anon, authenticated;

-- Troca trigger antigo para observar tanto status quanto deleted_at.
drop trigger if exists mori_plan_history_after_status on public.care_plans;
create trigger mori_plan_history_after_status
  after update of status, deleted_at on public.care_plans
  for each row
  when (old.status is distinct from new.status or old.deleted_at is distinct from new.deleted_at)
  execute function public.mori_sync_plan_history();

commit;

-- CONSULTAS DE VERIFICACAO (opcionais, somente leitura):
-- select tablename, policyname, cmd from pg_policies where schemaname='public'
--   and tablename in ('plants','care_logs','care_plans') order by tablename, policyname;
-- select trigger_name from information_schema.triggers where
--   event_object_schema='public' and event_object_table='care_plans';
