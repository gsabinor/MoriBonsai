-- MORI BONSAI — AUDITORIA PRÉ-PUBLICAÇÃO, SOMENTE LEITURA
-- Pode executar no SQL Editor. NÃO altera tabelas, dados nem permissões.
-- Os resultados exigem revisão humana, especialmente se alguma linha mostrar RLS desligado.

-- 1. RLS nas tabelas do aplicativo.
select n.nspname as esquema, c.relname as tabela,
       c.relrowsecurity as rls_ativo
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname in ('collections','collection_members','plants','plant_photos','species',
                    'species_guides','care_logs','care_plans','wishlist_items')
order by c.relname;

-- 2. Privilégios concedidos ao papel anon (não presume vazamento: RLS também conta).
select c.relname as tabela,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
       has_table_privilege('anon', c.oid, 'INSERT') as anon_insert,
       has_table_privilege('anon', c.oid, 'UPDATE') as anon_update,
       has_table_privilege('anon', c.oid, 'DELETE') as anon_delete
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
  and c.relname in ('collections','collection_members','plants','plant_photos','species',
                    'species_guides','care_logs','care_plans','wishlist_items')
order by c.relname;

-- 3. O bucket deve ter public=false.
select id, name, public from storage.buckets where id='mori-photos';

-- 4. A view de capas deve ter security_invoker=true.
select c.relname as view, c.reloptions
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='mori_plant_cover_photos';

-- 5. Contagem de políticas em tabelas do app (verifique se existem).
select tablename, count(*) as quantidade_politicas
from pg_policies where schemaname='public'
  and tablename in ('collections','collection_members','plants','plant_photos','species',
                    'species_guides','care_logs','care_plans','wishlist_items')
group by tablename order by tablename;
