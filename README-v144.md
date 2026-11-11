# Mori Bonsai v1.4.4 — correção do arraste de capas

**Aplicar sobre a v1.4.3.** Esta atualização corrige apenas o enquadramento das capas; não muda fotografias, registros nem o banco de dados.

## Problema identificado

A v1.4.3 aplicava `transform: scale()` à imagem e combinava o efeito com `object-position`. O tamanho ampliava, mas o deslocamento não correspondia a toda a região visível da fotografia, causando capas presas na parte de cima.

## Correção

- `src/lib/coverFrame.ts`: posiciona a imagem de modo absoluto, dimensionada pelo zoom, sem `transform`; `x=0/y=0` mostram o começo e `x=100/y=100` mostram o final da fotografia.
- `src/components/CoverPositionEditor.tsx`: cálculo de arraste baseado no espaço excedente real, porcentagens exibidas durante o ajuste, e atalhos **Topo**, **Meio**, **Base da foto**.
- `src/redesign.css`: garante enquadramento correto também nos cartões do dashboard.
- A mesma função de enquadramento é usada pelo editor, pela coleção e pelo dashboard. A foto original é preservada.

**Nenhum SQL novo é necessário.** A versão pressupõe que o SQL 19 já tenha sido executado para gravar x, y, zoom e modo no Supabase.

## Aplicação

1. Faça backup e trabalhe em uma cópia local da v1.4.3.
2. Extraia os arquivos do patch sobre a cópia, preservando as pastas.
3. Execute `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run dev`.
4. Abra a Galeria do Acer palmatum → Ajustar capa → **Preencher e ajustar** → **Base da foto**. Verifique que a região inferior apareceu na prévia; ajuste zoom e arraste se necessário.
5. Salve. Confirme a posição na coleção e no dashboard. Atualize a página e teste na segunda conta.
6. Publique no GitHub apenas depois dos testes locais.

## Verificações desta entrega

- Sintaxe das alterações TypeScript checada com transpileModule do TypeScript.
- Geometria testada no Chromium com uma fotografia artificial cuja região inferior é colorida: com y=0 ela não aparecia; y=100 mostrava a parte inferior, inclusive com zoom de 200% e 400%.
- Arraste simulado no Chromium modificou a posição vertical de 50% para 78%.
- A compilação completa de React/Vite não pôde ser realizada neste ambiente: npm install não concluiu.
