# Identidade do jogo e redesenho tela a tela

Pedido do Pedro em 28/10/2026: o jogo tinha se afastado da landing (azul-marinho, mapa claro,
cara de painel de gestão). A landing é a fonte da identidade; o jogo passa a falar a mesma língua.

## Regras que valem para todas as telas

| O quê          | Regra                                                                                                                                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fundo          | Grafite esverdeado (`--noite`, `--chapa`, `--chapa-2/3`) com o quadriculado de 48 px da landing. Nada de azul-marinho.                                                                                                                                       |
| Cor tem função | **Lavoura** = agir e resultado bom (botão principal, aba ativa, foco). **Ouro** = dinheiro e preço. **Brasa** = prejuízo e alerta. **Céu** = logística e informação.                                                                                         |
| Letras         | Press Start 2P só no título da página. Geist Pixel em números, botões, abas e rótulos. Archivo no texto corrido.                                                                                                                                             |
| Formas         | Cantos retos, borda de 2 px, sombra dura deslocada. Botões com chanfro que afundam ao clicar.                                                                                                                                                                |
| Gráficos       | `GraficoPixel`: grade de 4 px, linha em degraus, área em xadrez (lavoura acima do zero, brasa abaixo), zero como faixa de estrada e a mira de GPS da landing no ponto lido. Lê pelo mouse, pelo toque e pelas setas do teclado; "Ver valores" abre a tabela. |
| Séries         | Ordem fixa `--serie-1..5` (verde, azul, ouro, lilás, brasa), validada para daltonismo e contraste sobre o grafite. A cor segue a série, nunca a posição.                                                                                                     |
| Mapa           | GPS noturno: chão grafite, água petróleo, rodovias em ouro, demais vias em creme apagado.                                                                                                                                                                    |
| Texto          | Termos de laboratório (HHI, índices, "piloto", "próxima fase", tempo real) saem da tela do jogador e vão para o `/lab`.                                                                                                                                      |

Tokens em `apps/web/src/design/identidade.css`; gráfico em `components/GraficoPixel.tsx` e
`design/grafico.css`. O ECharts fica só para análises avançadas, já com a mesma paleta e fonte.

## Como cada tela é refeita

1. **O trabalho do jogador** numa frase (a pergunta que a tela responde).
2. **Cortar** o que é duplicado ou de laboratório.
3. **Desenhar** com as peças comuns: cabeçalho com cena pixel, um número-chave e uma ação.
4. **Construir** usando só variáveis da identidade; `npm run ui:cores` mostra o placar por arquivo.
5. **Verificar** computador, celular e teclado no navegador; `npm run check`.
6. **Crítica independente** por um agente revisor antes de mostrar ao Pedro.
7. **Pedro aprova**; commit pequeno.

## Ordem das telas

Vinda da auditoria de UX de 28/10 (primeira hora do amigo novo em primeiro lugar).

| #   | Tela                                       | Por quê agora                                                           | Estado          |
| --- | ------------------------------------------ | ----------------------------------------------------------------------- | --------------- |
| 0   | Base: cores, letras, mapa, gráfico próprio | Tudo passa a parecer a landing de uma vez                               | Feita 28/10     |
| 1   | Moldura (topo, menu) e **Início**          | Por onde o amigo começa; troca a janela de primeiros passos por cartões | Aguarda o Pedro |
| 2   | Loja: prateleira, anel de estoque, Repor   | Tela da primeira venda; prova o padrão de página                        | Próxima         |
| 3   | Comprar como gaveta                        | Mesma peça do Repor; fecha os dois cliques                              |                 |
| 4   | Pedidos com Entregas                       | Caminhão andando preenche a espera e tira uma aba                       |                 |
| 5   | Abrir negócio com recibo e painel do mapa  | Segundo objetivo da primeira hora                                       |                 |
| 6   | Fábrica, fazenda e mina                    | Padrão da loja aplicado à produção                                      |                 |
| 7   | Meus Negócios                              | Fica simples com cartões e cabeçalhos prontos                           |                 |
| 8   | Empresa e Finanças                         | Porte da empresa e gráficos com marcos                                  |                 |
| 9   | Cotações com Oportunidades                 | Já está perto; é fundir e cortar a aba                                  |                 |
| 10  | Contratos                                  | Meio de jogo                                                            |                 |
| 11  | Frota                                      | Pouco usada na primeira hora                                            |                 |

## Feito na base (28/10/2026)

- Paleta da landing em `identidade.css`; 230 cores azuladas espalhadas pelas folhas antigas
  levadas ao grafite por `scripts/retemperar-cores.ts`, mantendo o contraste de cada tela.
- Botão principal, aba ativa, menu e foco em lavoura; títulos de página em Press Start 2P;
  quadriculado atrás das telas.
- Mapa noturno (`lib/map-style.ts`).
- `GraficoPixel` no Fluxo de caixa da Empresa, conferido no computador, celular, teclado e mouse.
- Placar `npm run ui:cores`: 763 cores ainda escritas à mão; cada tela redesenhada zera o seu arquivo.

Limites: os marcadores do mapa, as cenas pixel e as telas em si ainda são os de antes; só mudaram
de temperatura. Cada uma ganha estrutura nova na sua vez.

## Tela 1 · Moldura e Início (29/10/2026)

Pergunta do jogador: o que aconteceu enquanto eu estava fora e o que eu resolvo agora?

- **Menu com 5 itens** (Início, Mapa, Negócios, Comércio, Empresa). O jogo abre no Início.
- **Barra de cima:** caixa livre sem centavos, vendas de hoje, relógio do jogo (`Dia 81 · 14h`)
  e o nome real da empresa no perfil. No celular o caixa continua visível.
- **Início:**
  - **Faixa do período:** "Hoje" ou "Enquanto você esteve fora, N h de jogo". Mostra vendas e
    gastos, separando a parte que virou estoque. Entregas e lotes só aparecem quando acontecem.
  - **Precisa de você:** pendências tiradas do estado do mundo, cada uma com o botão que resolve.
    Exemplos: "Leite esgotou · Repor", proposta recebida · Responder, pagamento atrasado · Resolver.
  - **Seus negócios:** cena pixel e o motivo do estado, como "Produzindo, pronto em ~3 h" ou
    "Leite acaba em ~18 h".
  - **Primeiros passos** em blocos, até terminar. A janela que abria sozinha saiu.
  - **A caminho:** cada carga é um caminhão andando sobre a faixa de estrada.
  - **Vendas por dia** em blocos, a partir de 3 dias com vendas.
- **Sino e Início usam a mesma lista de pendências** (`features/inicio/pendencias.ts`). Saíram
  os textos de teste ("Mundo local · 120×", "piloto").
- **Períodos:** "hoje" é sempre desde a meia-noite do jogo, igual na barra, na faixa e nos cartões.
  A ausência conta desde a última visita, com no mínimo 4 h de jogo fora.
- **Revisão independente:** o agente revisor apontou 10 problemas, todos corrigidos:
  - três números de caixa diferentes;
  - estoque que parecia prejuízo;
  - zeros na faixa;
  - saudação ocupando o topo;
  - "acaba hoje" falso;
  - gráfico vazio;
  - cartões sem motivo;
  - caixa sumindo no celular;
  - histórico lido 11 vezes;
  - contagem repetindo.

Verificado:

- Computador e celular, sem rolagem lateral.
- Gráfico pelo teclado.
- Repor abrindo Comprar já filtrado.
- Cartão abrindo a loja.
- Build e 230 testes.

Limites e próxima ação:

- O resumo ainda não conta o fato mais marcante (rival abriu loja, preço mudou).
- Repor ainda leva à tela Comprar; a gaveta de dois cliques é a tela 3.
- Proposta recebida abre a lista de Pedidos, não a proposta.
