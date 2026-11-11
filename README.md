# Mori Bonsai Web v1.3.2 — Preparação para publicação

Esta é uma atualização **de qualidade e segurança**, sobre a v1.3.1. **Nenhuma alteração nas telas nem nas tabelas Supabase.** O trabalho é concentrado em verificação automática, arquivo de auditoria somente leitura e configuração reprodutível do GitHub Actions.

## Instalação
1. Extraia o ZIP e abra no VS Code a pasta que contém `package.json`.
2. Copie `.env.local` da v1.3.1 para a nova pasta, sem colocá-lo no Git.
3. Rode os comandos abaixo em PowerShell:

```powershell
npm.cmd install
npm.cmd run preflight
npm.cmd run typecheck
npm.cmd run build
npm.cmd run dev
```

4. O `npm install` gera `package-lock.json`, que **deve ser incluído no repositório Git**. O arquivo não está incluído neste ZIP porque sua resolução de dependências precisa ser feita pelo npm.
5. Confira o guia em `docs/REVISAO_PRE_PUBLICACAO.md`.

## Verificação no Supabase
Abra **SQL Editor** e execute o arquivo `supabase/15_auditoria_somente_leitura.sql`. É uma consulta de diagnóstico: NÃO é uma migração e NÃO altera dados ou políticas. Inspecione o resultado; não execute nenhum comando de alteração por conta própria.

## Publicação
O workflow `.github/workflows/deploy.yml` usa `npm ci`, exige um `package-lock.json` enviado pelo Git e rejeita uma publicação se as duas variáveis do Supabase não estiverem configuradas corretamente. Nunca coloque senha, `sb_secret_` ou `service_role` no frontend.

## O que foi testado aqui
- Estrutura do projeto e integridade do ZIP.
- Execução do preflight com Node e simulação de variáveis ausentes.
- Revisão estática de arquivos de configuração.

Não foi possível acessar o registro npm para a instalação, então a compilação TypeScript/Vite e o funcionamento com seu projeto Supabase precisarão ser testados localmente.
