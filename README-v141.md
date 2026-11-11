# Mori Bonsai Web v1.4.1 — correção de vídeo e referência visual

**Compatível com o patch da v1.4; não substitua o site online antes de testar localmente.**

## Problema de RLS encontrado
A migração 05 limitava `public.can_access_mori_photo_path` a arquivos `*.webp`. A migração 16 passou a aceitar MP4/WebM no bucket, mas não atualizou a função. A migração 17 amplia a lista para `webp`, `mp4` e `webm`, ainda exigindo autenticação, participação na coleção e caminho com UUIDs corretos. Não desativa políticas nem publica o bucket.

## Funcionalidades
1. **Galeria** substitui "Fotos" no cartão do exemplar.
2. **Referência visual**: pode enviar **uma imagem de outro bonsai da mesma espécie** para inspirar a formação do exemplar. Inclui descrição e campo opcional de fonte/autor/link. É armazenada no mesmo bucket privado, mas separada cronologicamente do álbum; não pode ser capa nem anexo de manejo. Permite editar descrição/fonte e excluir.
3. O álbum continua aceitando fotografias e vídeos do próprio exemplar.
4. O backup já exporta todas as mídias da tabela `plant_photos`, inclusive a nova referência, via `select *` (limite anterior de 160 MB).

## Instalação segura
1. Exporte **backup ZIP** e guarde-o fora do GitHub. Se possível, faça também backup do banco pelo Supabase.
2. Use uma **cópia do projeto v1.4** e extraia o patch nela, mantendo os caminhos. Não substitua o `.env.local`.
3. No Supabase, abra **SQL Editor** e execute **somente** `supabase/17_storage_video_e_referencia_visual.sql`. Pressupõe que `16_colecao_manejos_midias.sql` foi aplicado. O SQL é incremental e verifica o bucket privado.
   **Atenção:** o SQL modifica o banco compartilhado com o site publicado, mesmo sem deploy. O código antigo deve continuar funcionando: novas colunas têm valores padrão.
4. Na pasta da cópia, execute `npm.cmd run typecheck`, `npm.cmd run build` e `npm.cmd run dev`.
5. Teste: (a) enviar MP4 curto e WebM se disponível; (b) visualizar vídeo no histórico/galeria; (c) enviar imagem de referência com observação e fonte; (d) editar os dados; (e) conferir que não vira capa nem aparece na linha do tempo; (f) excluir e substituir referência; (g) criar backup e verificar imagem de referência e vídeo no ZIP; (h) validar com ambas as contas.
6. Após os testes, `git add src/LiveApp.tsx src/lib/mediaUpload.ts src/components/PhotoGallery.tsx src/interior-v131.css supabase/17_storage_video_e_referencia_visual.sql package.json`, seguido de commit/push conforme seu fluxo de branches.

**Não** reexecute todos os scripts antigos, altere RLS para `true`, torne o bucket público ou exponha chave `service_role` no navegador.

**Limites**: vídeos MP4/WebM até 20 MB; imagem original até 15 MB, com conversão para WebP de até 5 MB. Uma referência visual por exemplar.
