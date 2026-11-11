# Mori Bonsai Web v1.4.3 — correção do recorte das capas

Atualização **incremental sobre a v1.4.2**. Não utilize o patch diretamente sobre uma versão mais antiga.

## Problema corrigido
O editor v1.4.2 só alterava os percentuais de `object-position` enquanto o cartão usava `object-fit: cover`. Quando a fotografia tinha proporção próxima à capa ou o assunto era muito pequeno, não havia sobra suficiente para arrastar: a árvore ainda ficava cortada ou pequena. A prévia também não correspondia exatamente à proporção do cartão da coleção.

## O que mudou
- **Preencher e ajustar:** zoom de 100% a 400% e arraste horizontal/vertical, inclusive quando a foto não tinha sobra no enquadramento original.
- **Mostrar foto inteira:** `contain` mostra a imagem completa; haverá margens quando as proporções forem diferentes.
- **Prévia 3:2:** o cartão da coleção usa a mesma proporção da prévia do editor.
- **Sincronização:** posição, zoom e modo ficam no banco e são usados nos cartões da coleção e no dashboard.
- Os arquivos das fotografias não são modificados.

## Aplicação segura
1. Faça o backup ZIP com mídias. **Não publique alterações nem execute SQL em produção antes de validar a cópia de teste.**
2. Aplique o patch sobre uma cópia da **v1.4.2** (ou extraia o projeto completo). Preserve seu `.env.local` privado; ele não está incluído.
3. No Supabase de testes, após as migrações 16, 17 e 18, execute `supabase/19_capa_zoom_e_encaixe.sql`. Ele só adiciona colunas e uma nova RPC, mantendo a RPC antiga para compatibilidade. Se usar o Supabase de produção, a alteração no banco será imediata.
4. Execute `npm.cmd install`, `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run dev`.
5. Na Galeria, use **Ajustar capa**, selecione **Preencher e ajustar**, aumente o zoom e arraste. Salve e confira o cartão na coleção. Ou escolha **Mostrar foto inteira** para impedir qualquer corte.
6. Atualize a página, teste na outra conta e compare com o dashboard. Publique no GitHub apenas após os testes.

## Observações
O zoom pode reduzir a nitidez de fotos com baixa resolução. O dashboard tem um cartão com proporção diferente da coleção; preservamos o mesmo ponto focal e modo, embora as margens possam variar. A prévia 3:2 corresponde à coleção, que é onde o problema foi relatado.
