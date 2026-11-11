# Mori Bonsai Web v1.4 — Melhorias da coleção, manejo e mídias

Base: v1.3.2 (publicada) + avatar compartilhado. **Não substitua a versão online antes de validar a atualização localmente**. O código ainda exige testes funcionais com o seu Supabase.

## O que mudou

1. Preferência de luz opcional por exemplar (Sol pleno/Meia-sombra/Sombra/Não confirmado) e sugestão de ambiente *informativa*, nunca uma mudança automática. Para meia-sombra ou sombra, o sombrite deve ser adequado à espécie; não é garantia de sombra total. Confirme usando a Biblioteca Técnica.
2. Ordenação: aquisição mais recente/mais antiga; nome A–Z/Z–A. Datas não informadas ficam ao final.
3. Idade estimada em anos, campo opcional (0 a 300, incrementos de 0,5). É uma estimativa informada pelo usuário, não atualizada automaticamente.
4. Ambiente adicional: `Apartamento`, em cadastro e filtro.
5. Exemplo de nome: `Jabuticabeira #1`.
6. Ao salvar um manejo, você pode anexar uma foto ou vídeo que aparece também na galeria do exemplar, com legenda automática do manejo. Históricos mostram anexos. O manejo é salvo antes do upload; se o arquivo falhar, não repita o cadastro.
7. Galeria agora aceita vídeos MP4/WebM de até 20 MB, sem transcodificação. Eles não podem ser selecionados como foto de capa nem na comparação de fotos.
8. O backup ZIP inclui os arquivos do mesmo bucket, agora com extensões `.webp`, `.mp4` e `.webm`; limite total de mídia 160 MB por exportação.

## Instalar e validar (em uma cópia do projeto já publicado)

1. Faça **backup ZIP** pelo site publicado e guarde uma cópia da pasta/repositório Git.
2. Extraia o pacote em uma pasta separada. Copie nela seu `.env.local` existente. **Não publique este arquivo**.
3. No **mesmo projeto Supabase**, execute uma vez o script `supabase/16_colecao_manejos_midias.sql` em SQL Editor. Ele é incremental. **Atenção**: ao executá-lo, as colunas novas ficam disponíveis também para a versão online; o código antigo deve continuar funcionando porque as novas colunas têm valores padrão e são opcionais.
4. No terminal do VS Code, na pasta com `package.json`, rode:

   ```powershell
   npm.cmd install
   npm.cmd run preflight
   npm.cmd run typecheck
   npm.cmd run build
   npm.cmd run dev
   ```

5. No `localhost`, teste: (a) editar bonsai existente e informar idade/luz; (b) adicionar apartamento; (c) ordenar A–Z e por aquisição; (d) salvar novo manejo com foto; (e) verificar foto no histórico e galeria; (f) anexar um MP4 pequeno; (g) exportar backup com vídeos.
6. Se os testes locais passarem, coloque as alterações em uma **branch de desenvolvimento**, abra revisão e só integre a `main` quando estiverem funcionando em ambas as contas. Faça novo backup antes da publicação.

**Limitações:** MP4/WebM apenas, até 20 MB; vídeo grande pode falhar em redes móveis porque esta versão usa upload padrão, não TUS resumível. O limite Free do Supabase é 1 GB para todo o Storage e máximo de 50 MB por arquivo. Arquivos menores que 6 MB são mais confiáveis em upload padrão; não recomendamos longos vídeos. Links privados de mídia expiram após 15 minutos. Se um vídeo não tocar em certo navegador, o formato/codificação pode não ser suportado; não há transcodificação.

**Segurança:** o bucket continua privado e sujeito às políticas de autorização já instaladas. O SQL cria uma validação de integridade para não vincular mídia a manejos de outra coleção. Nenhuma API nova ou chave secreta é necessária. Não reexecute as migrações anteriores.
