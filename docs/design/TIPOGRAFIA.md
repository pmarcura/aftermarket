# Tipografia · Geist Pixel Square

Registro histórico de 28/10/2026. A interface atual segue a direção
[Livro-caixa](IDENTIDADE-JOGO.md#direção-aprovada-livro-caixa-29102026), com Archivo,
IBM Plex Mono e Caveat Brush. A evidência abaixo descreve a revisão anterior.

Pedido do Pedro em 28/10/2026: melhorar a leitura dos números e textos que usavam
Pixelify Sans. Ajuste pontual de UX-03 na etapa E; não conclui a etapa.

## Escopo e critério de saída

Substituir a voz pixel na implementação canônica (`--pixel`), carregar a fonte
localmente e conservar Archivo nos textos corridos e legendas pequenas. Valores,
acentos, botões e campos precisam continuar visíveis em desktop e celular, com o
fluxo de preço acessível pelo teclado. Saldo, estoque e regras econômicas não mudam.

## Implementação

- Geist Pixel Square oficial, `geist@1.8.2`, WOFF2 de 28,54 kB, com licença OFL
  preservada em `apps/web/src/assets/fonts`. Fonte e proveniência no README local.
- `@font-face` em `apps/web/src/design/identidade.css`, com `font-display: swap`.
  Nenhuma nova dependência de execução; Pixelify removida da instalação.
- Legenda pequena do ponto de equilíbrio em Archivo; os três indicadores da loja
  ficam em uma coluna até 600 px para evitar valores apertados.
- Alterações de interface que já estavam no diretório foram preservadas.

## Evidência

- `npm run build`: aprovado, incluindo TypeScript e fonte empacotada pelo Vite.
- Prettier nos arquivos de estilo alterados e README: aprovado.
- Revisão com Edge/Playwright sobre o build, usando cenário em memória: dez telas
  em 1440×1000 e 390×844, fonte efetivamente carregada e sem rolagem horizontal
  da página. Telas: negócios, indústria, loja, mercado, entregas, transportadora,
  cotações, pedidos, contratos e finanças.
- Loja, mercado e finanças inspecionados por capturas. Valores e acentos renderizados,
  incluindo `R$ 12.079.193,62`. Indicadores da loja revisados novamente no celular.
- Preço do óleo editado com ArrowUp e salvo com Enter em ambas as larguras,
  executando `setPrice` no motor da fixture. Preço aplicado; saldos e estoques conservados.
- Artefatos locais: `test-results/typography/report.json`, capturas na mesma pasta
  e roteiro de verificação `.runtime/font-review.ts`.

## Limites e próxima ação

O coletor `lab:capture` não concluiu uma coleta integral: mapa/aquisição esperam
um título visível e a navegação por abas da loja encontra o modal de primeiros
passos aberto. Próxima ação do laboratório: revisar essas precondições e tratar
o modal explicitamente antes das abas. Nenhuma referência visual foi aceita.

A revisão isolada não valida estradas, séries históricas ou todas as combinações
de layout. Legibilidade percebida ainda depende do uso pelo Pedro; o pedido de
troca da fonte foi implementado, sem declarar aprovação de playtest humano.
