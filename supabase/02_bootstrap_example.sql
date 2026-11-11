-- MODELO PARA COPIAR E ADAPTAR NO SQL EDITOR — NÃO EXECUTAR COM VALORES FICTÍCIOS.
-- 1) Crie duas contas em Authentication > Users e confirme-as.
-- 2) Execute 01_schema.sql PRIMEIRO.
-- 3) Verifique os emails cadastrados:
select id, email from auth.users order by created_at;

-- 4) Crie a coleção (salve o UUID retornado):
insert into public.collections (name)
values ('Mori Bonsai')
returning id, name;

-- 5) Substitua OS TRÊS campos abaixo pelo UUID retornado e os dois e-mails reais.
-- Execute a inserção apenas após substituir, na sua conta administradora Supabase.
-- insert into public.collection_members (collection_id, user_id, role)
-- select 'COLE-UUID-AQUI'::uuid, id,
--        case when email = 'EMAIL-DONO@EXEMPLO.COM' then 'owner' else 'member' end
-- from auth.users
-- where email in ('EMAIL-DONO@EXEMPLO.COM', 'EMAIL-SEGUNDO@EXEMPLO.COM');

-- 6) Confira se a coleção ficou com dois membros:
-- select cm.collection_id, au.email, cm.role
-- from public.collection_members cm
-- join auth.users au on au.id = cm.user_id;
