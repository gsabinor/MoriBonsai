# Mori Bonsai Web v1.0 — roteiro de testes antes de publicar

## Verificações no navegador (login e privacidade)

1. Entre com a primeira conta autorizada em `http://localhost:5173`.
2. Teste cadastro, alteração e recuperação de um exemplar fictício; foto de capa, criação de manejo e planejamento concluído com histórico automático.
3. Entre com a segunda conta no modo anônimo/outro computador; confirme que aparecem os mesmos dados.
4. Saia da conta e confira que a coleção não fica visível.
5. Se possível, confirme que uma terceira conta **não autorizada** não consegue ler os registros pelo Supabase (sem cadastrar essa conta na coleção).
6. Em Supabase → Storage, confirme que `mori-photos` permanece **Private**.

## Teste de exportação

1. Abra Configurações → Gerar e baixar backup ZIP; com imagens se o total for menor que 160 MB.
2. Abra o ZIP pelo Explorador do Windows; confira `dados.json`, `LEIA-ME.txt` e a pasta `fotos/` (se marcou a opção).
3. Verifique os nomes e contagens no `manifest`, inclusive registros com `deleted_at`.
4. Extraia uma imagem e abra-a. **Não assuma que um download iniciado é um backup validado.**
5. Guarde o arquivo **fora** da pasta que será enviada para o GitHub.

## Desempenho: como medir

1. No Chrome/Edge, pressione `F12` → guia Network, selecione `Disable cache`.
2. Recarregue a visão geral e anote a duração total e o volume transferido.
3. Abra Coleção, Biblioteca Técnica, Calendário, Planejamento e Galeria separadamente, anotando tempo de abertura, erros de rede e quantidade de requisições.
4. Use outra aba de perfil para simular a segunda conta, sem extrapolar os resultados de um único computador.
5. Compare com a v0.9.1 usando o mesmo navegador, rede e número de exemplares.
6. Se a biblioteca, fotos ou consultas parecerem lentas, compartilhe as requisições e durações da aba Network **sem tokens/chaves** para otimização orientada por dados.

## Antes de publicar no GitHub Pages

- Em `git status`, certifique-se de que `.env.local`, ZIPs de backup e arquivos SQL de dump com dados **não** estão na lista de commit.
- Em GitHub Settings → Secrets and variables → Actions → Variables, configure os dois `VITE_...` da aplicação. Somente **publishable key**.
- Em Settings → Pages, selecione **GitHub Actions** e aguarde a publicação do workflow.
- Confirme que o site abre em `https://SEU_USUARIO.github.io/NOME_REPOSITORIO/`, sem modo demonstração.
- Teste também o login, o upload de foto de teste e a abertura do calendário pelo endereço HTTPS.
- O endereço Supabase permanece separado do URL público da interface.

## Recuperação de desastre

O ZIP do aplicativo contém código, e o ZIP de exportação contém dados legíveis e imagens, mas nenhum dos dois, sozinho, restaura integralmente os serviços Supabase. Mantenha cópias externas dos scripts SQL e backup oficial via Supabase CLI. Em novembro/2026, a CLI v3 direciona os comandos para o ambiente local por padrão: para `db dump`, utilize explicitamente `--remote` com o projeto vinculado. Consulte a documentação vigente antes de seguir um procedimento de restauração.
