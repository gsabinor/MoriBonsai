# Mori Bonsai Web v1.4.2 — Ajuste de enquadramento da capa

Incremental em relação à **v1.4.1**, sem alterar os arquivos originais das fotografias.

## Novidade

- Na Galeria do exemplar, clique na estrela de qualquer foto (ou no botão **Ajustar capa** quando já existe uma capa).
- Arraste a fotografia no quadro para escolher o ponto focal. Também é possível usar os controles horizontal e vertical e o botão **Centralizar**.
- Clique em **Salvar capa** para definir a foto e o enquadramento de forma atômica.
- O recorte escolhido fica sincronizado entre as contas e aparece na coleção e nas fotos do dashboard.
- O arquivo original armazenado no Supabase não é editado. Todos os enquadramentos já existentes começam centralizados (50%, 50%).

## Aplicação segura

1. Faça backup ZIP dos dados e fotografias da coleção.
2. Salve uma cópia do projeto v1.4.1 (de preferência branch separada). Aplique o **patch v1.4.2** nessa cópia, respeitando as pastas.
3. **Somente após aplicar as migrações 16 e 17**, execute `supabase/18_enquadramento_capa.sql` no SQL Editor. Recomenda-se um projeto Supabase de testes. O SQL modifica imediatamente o banco conectado ao site público.
4. Execute `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run dev` na pasta do projeto.
5. Teste: foto vertical e horizontal, mudar a capa, reajustar a capa atual, atualizar a página, abrir a mesma coleção com a segunda conta e conferir o dashboard.
6. Publique somente depois dos testes. Não é necessário alterar o bucket Storage nem o fluxo de login.

## Observações

- O resultado da visualização pode ter pequenas diferenças em cartões com proporções distintas: a **posição focal** é preservada, mas a área visível também depende do formato do cartão.
- Nas dimensões em que a fotografia não excede o quadro, não há deslocamento possível sem ampliar a imagem.
- O nome da nova RPC é `set_mori_plant_cover_frame` e a view `mori_plant_cover_photos` agora inclui `cover_position_x` e `cover_position_y`.
