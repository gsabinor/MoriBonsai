# Mori Bonsai v1.1 — Direção artística

## Conceito

**Nossa pequena floresta** — sistema pessoal da Duda e do Gui, sem frases publicitárias. A marca representa um dragão oriental entre bonsais e usa o significado de **森 (mori: floresta)** como inspiração.

## Cores

- Verde-floresta `#13382b`: menu, botões e contrastes
- Verde-pinho `#274d37`: detalhes e títulos secundários
- Verde-musgo `#627b56`: gráficos, ícones e estados discretos
- Creme `#f4f0e6`: fundo das telas
- Dourado suave `#d4b47a`: marca e ornamentos

## Telas atualizadas

- Login: nova identidade, imagem florestal, tom pessoal
- Painel: banner florestal, clima de BH, gráfico real, próximos manejos, destaques fotográficos e cartão de prévia de listas
- Menu: logo clicável e tratamento de floresta
- Coleção e outras telas: ajustes de paleta, tipografia, cards e rodapé
- Planos & desejos: **prévia**, sem persistência até a v1.2

## Critérios de qualidade

Nenhuma estatística demonstrativa deve aparecer no painel conectado. A API do clima não pode impedir o uso do aplicativo em caso de falha. As imagens das plantas continuam privadas. O menu deve ser navegável por teclado e celular. A imagem de dragão não pode prejudicar a leitura dos formulários.

## Ajustes da v1.1.1 (layout aprovado)

- Banner original preservado, **sem alteração de arte**. Altura ampliada para mostrar melhor o dragão e o bonsai.
- Card meteorológico retirado do banner e movido para a linha de resumos.
- Indicadores em **3 + 2 no desktop**: três na linha superior; planejamento e clima na inferior.
- Marcas-d'água SVG botânicas e paisagens ilustradas decoram os cards, sem bloquear a leitura.
- Removida a palavra “Floresta” abaixo do kanji 森 no menu lateral, mantendo o símbolo.
- Layout responsivo: adaptação automática em telas menores.
- Supabase, tabelas, fotos e regras RLS mantidos sem alterações.
