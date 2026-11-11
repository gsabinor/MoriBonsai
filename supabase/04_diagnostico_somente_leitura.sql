-- MORI BONSAI WEB v0.3.2 — DIAGNÓSTICO DE RLS (SOMENTE LEITURA)
-- Execute no SQL Editor do Supabase onde estão as plantas.
-- Não modifica políticas, fotos, usuários ou registros.
-- Atenção: o SQL Editor tem privilégios administrativos e não reproduz automaticamente
-- as permissões RLS do navegador. Esses SELECTs verificam a CONFIGURAÇÃO.

-- 1) Bucket privado esperado:
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'mori-photos';

-- 2) Políticas relacionadas às fotos (espera-se SELECT/INSERT/DELETE para cada tabela):
select schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check
from pg_policies
where (schemaname = 'storage' and tablename = 'objects')
   or (schemaname = 'public' and tablename = 'plant_photos')
order by schemaname, tablename, policyname;

-- 3) Quantos usuários cada coleção possui:
select c.name as collection_name, c.id as collection_id,
       count(cm.user_id) as member_count
from public.collections c
left join public.collection_members cm on cm.collection_id = c.id
group by c.id, c.name
order by c.name;

-- 4) Quais plantas estão ativas e a qual coleção pertencem:
select id as plant_id, collection_id, name as plant_name, deleted_at
from public.plants
order by created_at desc
limit 30;

-- 5) Confirme se existe o registro de alguma foto (se upload e insert foram concluídos):
select plant_id, collection_id, created_at
from public.plant_photos
order by created_at desc
limit 20;
