# Mori Bonsai — Checklist antes da publicação (v1.3.2)

## Objetivo
Esta atualização é de preparação e diagnóstico. **Não publica o site nem altera o Supabase.** O dashboard, a biblioteca, a galeria e os formulários permanecem iguais à versão 1.3.1.

## Ambiente local (Windows / VS Code)
1. Copie seu `.env.local` de uma versão funcional. Não compartilhe nem publique o arquivo.
2. Rode `npm.cmd install` para gerar/atualizar `package-lock.json` (commite esse arquivo).
3. Execute `npm.cmd run preflight`, `npm.cmd run typecheck` e `npm.cmd run build`.
4. Execute `npm.cmd run dev` para testar no navegador.
5. Se `esbuild` não puder executar um script de instalação no seu npm, trate esse aviso ou erro *separadamente*, sem desativar proteções de forma indiscriminada.

## Segurança
- Rode `supabase/15_auditoria_somente_leitura.sql` no SQL Editor. O script somente consulta metadados.
- Confirme RLS ativo nas nove tabelas; bucket `mori-photos` privado; view de capas com `security_invoker=true`.
- Teste acesso com duas contas autorizadas e, quando possível, uma conta não membro. **Login por si só não substitui RLS.**
- Confirme que uma conta deslogada não consegue ver fotos ou registros.
- Antes do `git commit`, rode `git status --short` e `git check-ignore .env.local`.
- Se houver dados privados acidentalmente rastreados, remova-os do índice e considere revogar credenciais já expostas.

## Testes de regressão no browser
- Dashboard: banner inteiro, cards 3+2, clima e gráfico sem dados inventados.
- Coleção: criar, editar, excluir e recuperar exemplar; conferir foto de capa.
- Biblioteca: aprovar rascunho e abrir ficha aprovada (40 campos).
- Histórico e planejamento: concluir plano, conferir histórico automático, reabrir e restaurar registros sem duplicar.
- Galeria: upload privado, comparação, data e exclusão (com confirmação).
- Planos & Desejos: criar, editar, marcar adquirido, arquivar e recuperar com a segunda conta.
- Backup: abrir o ZIP baixado e `dados.json`; confirmar fotos incluídas. Não confundir download iniciado com arquivo salvo.
- Mobile: larguras 390 e 768 px, menus e modais acessíveis, sem rolagem horizontal inesperada.
- Performance: DevTools > Network (Disable cache) para medir abertura e tamanho de cada módulo. Anote gargalos antes de otimizar.

## GitHub Pages
- Crie repositório `mori-bonsai-web` (ou ajuste conforme seu nome escolhido).
- Configure `Settings > Secrets and variables > Actions > Variables`:
  `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Em `Settings > Pages`, escolha `Source = GitHub Actions`.
- Inclua `package-lock.json` no Git. O workflow agora usa `npm ci` (versões reproduzíveis), confere credenciais publicáveis e evita publicar sem uma configuração do Supabase.
- O Vite utiliza `GITHUB_REPOSITORY` para gerar automaticamente o caminho-base `/<nome-do-repositório>/`.
- Para domínio customizado no futuro, revisar `vite.config.ts` e as URL Configuration do Supabase.
- Faça login no HTTPS publicado e repita os testes de privacidade e backup.

## Limitações honestas
- A checagem automatizada não substitui uma auditoria de segurança independente.
- Os resultados de SQL precisam ser vistos no Supabase real; o script não modifica nada.
- O backup em ZIP ainda **não possui importação/restauração automática**.
- Sem instalação npm, não é possível garantir a compilação final neste ambiente. O build no seu Windows e no GitHub Actions será a prova.
