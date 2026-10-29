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
| 1   | Moldura (topo, menu) e **Início**          | Por onde o amigo começa; troca a janela de primeiros passos por cartões | Feita 29/10     |
| 2   | Loja: prateleira, anel de estoque, Repor   | Tela da primeira venda; prova o padrão de página                        | Aguarda o Pedro |
| 3   | Comprar como gaveta                        | Mesma peça do Repor; fecha os dois cliques                              | Próxima         |
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

## Tela 2 · Loja (29/10/2026)

Pergunta do jogador: o que está acabando e o preço está bom?

- **Prateleira em ordem de urgência:** o que acaba primeiro vem primeiro. Cada produto tem o **anel de estoque** em blocos de pixel, que mostra os dias de estoque e muda de cor: brasa abaixo de 1 dia, ouro abaixo de 3 e lavoura daí em diante. O anel acompanha o preço testado.
- **Repor** destaca-se quando esgotou. Se já há carga pedida, vira "Já pedido · repor mais", para não comprar duas vezes.
- **Esgotado** vira linha enxuta: sem estoque não há venda nem lucro, então régua e números de venda ficam escondidos.
- **Uma só dica de preços** no topo, marcada como estimativa, em vez de dois quadros de números. Não aplica sozinha quando o melhor preço está no teto da busca.
- **Conta única** (`contaDaPrateleira`) para cabeçalho, prateleira e avisos do Início. A venda do dia é limitada ao estoque que existe.
- **Fita da caixa:** as últimas 8 vendas no lugar da tabela de 40 linhas.
- **Revisão independente:** 8 problemas; corrigidos o ganho inflado (ignorava o estoque), esgotado apagado, linha esgotada com números falsos, Repor sem saber da carga a caminho, margem sem rótulo de estimativa, legenda repetida e cor do anel.

Limites e próxima ação:

- Repor ainda abre a tela Comprar; a gaveta é a tela 3.
- A linha de preço ainda traz muitos controles; detalhes recolhíveis ficam para uma passada de densidade.
- A conta de preços por produto roda a cada atualização; cache por revisão é uma melhoria de desempenho.

### Ajuste da Loja após o feedback do Pedro (29/10/2026)

Pedro apontou: anel com quadrados desiguais, legendas sem separação entre itens diferentes, abastecimento confuso, Equipe e Finanças ainda no estilo antigo, e gráficos fora da identidade.

- **Anel de estoque** redesenhado numa grade de pixels: um contorno de círculo com células do mesmo tamanho e o mesmo espaço entre elas.
- **Legenda da régua de preço** em dois grupos separados, cada um com título: _Cor da faixa_ (lucro por dia nesse preço) e _Marcos de preço_ (justo, menor da cidade, menor do mapa, seu custo), cada marco com a sua forma.
- **Abastecimento refeito** (`Abastecimento.tsx`): cada produto está em um de dois modos, manual ou automático. Antes havia cinco caminhos espalhados (comprar, pedidos, regras automáticas, conexão fixa e transferência).
  - **Repostos sozinhos:** cartão com a barra de estoque (no armazém, a caminho e pedido feito), os marcos _repor aqui_ e _até aqui_, dois botões − e + e a origem. Mudar a origem, ligar, desligar e parar de automatizar salvam na hora. Os números têm um botão Salvar próprio.
  - **Repor você mesmo:** Comprar, Trazer de outra unidade ou Automatizar, na mesma linha.
  - **A caminho:** cargas com o caminhão andando na estrada e aviso de pedidos esperando resposta.
  - **Regras gerais** recolhidas, em quatro grupos: quanto gastar, de onde comprar, como transportar e forma de compra.
  - Saiu a simulação de cobertura em sete dias: o anel e a barra respondem à mesma pergunta.
- **Equipe refeita** (`Workforce.tsx`, `EquipePecas.tsx`): crachás de pixel por funcionário, medidor de capacidade contra a procura, contratação em dois passos com recibo ao vivo, treinamento em cartão e a fórmula do salário recolhida.
- **Finanças refeita** (`Financas.tsx`): entrou, saiu e caixa em três cartões, 7 ou 30 dias, entrou e saiu por dia, para onde foi o dinheiro em uma barra empilhada com cartões, e quem compra de você. Comprar estoque não aparece como prejuízo.
- **Gráficos:** `GraficoPixel` e `BarrasPixel` em contratos, saúde da economia, oportunidades e atividade dos bots. O ECharts fica só nas Cotações (velas e zoom) e no laboratório.

### Segunda rodada de feedback do Pedro (29/10/2026)

Pedro disse que a prateleira e o abastecimento pareciam "mod de Minecraft e planilha": faltava hierarquia, os visualizadores em blocos de pixel eram ruins, e queria um fluxo de reposição mais de jogo.

- **Fim dos blocos e do anel.** Estoque virou uma palavra de estado (_Esgotado_, _Acaba em ~3 h_, _Em dia: 8 dias_) com um medidor liso (`EstadoEstoque`). A barra de estoque do abastecimento (`BarraEstoque`) é lisa, com etiquetas _repor aqui_ e _encher até_. Os gráficos (`GraficoPixel`, `BarrasPixel`) têm curvas suaves, barras arredondadas e preenchimento em degradê.
- **Cartão de produto** (`design/item.css`): faixa colorida por produto com a imagem grande, o nome em tamanho de título e o estado do estoque; embaixo, o corpo com a decisão. É o mesmo cartão na prateleira, nos produtos automáticos e nos manuais (versão compacta).
- **Trilho de preço:** degradê contínuo do prejuízo ao maior lucro, com a moeda que se arrasta e marcos ilustrados (balança = preço justo, lojinha = menor da cidade, marcador = menor do mapa, etiqueta = seu custo). Marcos no mesmo preço sobem em fileiras.
- **Ilustrações em vez de formas** (`IconePixel`): caixa, caminhão, prancheta, relógio, moeda, estrela e os quatro marcos, desenhados em código com contorno automático. Usar nas legendas novas; só os gráficos antigos ainda têm chaves em forma geométrica.
- **Mandar buscar** (`ReporGaveta`, `design/gaveta.css`): a reposição virou uma gaveta única, aberta por qualquer botão de repor (prateleira, abastecimento, Início). Passos: _Quanto você quer?_ (três tamanhos prontos e uma régua), _Quem leva?_ (até três fornecedores com selos _mais barato / mais rápido / mais perto_), total em destaque e _Despachar caminhão_. Depois, o caminhão atravessa a estrada. Começa com o que o caixa aguenta e com o que cabe nos caminhões; se ninguém tem estoque, diz isso. Usa as mesmas contas e o mesmo comando (`trade`) da tela de compra.
- **Abastecimento:** produto pausado aparece apagado e avisa que nada será comprado; automatizar o segundo produto não liga a chave geral; o rascunho de um cartão renova depois de salvar; preço e frete aceitam centavos; produtores só listam insumos como manuais.

### Cor e tipografia com função

**Texto.** A fonte pixel (Geist Pixel e Press Start) só vale **a partir de 18 px**, em títulos e números grandes. Texto menor, legendas, selos, botões, abas e menu usam **Archivo semibold, mínimo de 13 px**. Pixel em letra pequena e sobre fundo colorido não é legível.

**Cor.** Cada cor tem um trabalho; não se usa uma cor só porque combina. Contrastes medidos por `npm run ui:contraste` (WCAG 2.2, texto normal ≥ 4,5:1, interface e gráficos ≥ 3:1):

| Cor             | Papel                                     | Contraste sobre `--chapa` | Texto escuro (`--noite`) sobre ela |
| --------------- | ----------------------------------------- | ------------------------- | ---------------------------------- |
| `--lavoura`     | agir, resultado bom, estoque em dia, foco | 10,9:1                    | 11,9:1                             |
| `--ouro`        | dinheiro, preço, alerta médio             | 9,8:1                     | 10,7:1                             |
| `--brasa`       | prejuízo, esgotado, erro                  | 6,3:1                     | 6,9:1                              |
| `--ceu`         | logística, carga a caminho, informação    | 7,8:1                     | 8,5:1                              |
| `--serie-4`     | pedidos e negociação (lilás)              | 5,0:1                     | —                                  |
| `--creme`       | texto principal                           | 13,9:1                    | —                                  |
| `--apagado`     | texto secundário                          | 6,8:1                     | —                                  |
| `--borda-forte` | contorno de controle                      | 3,7:1                     | —                                  |

Cores decorativas (o matiz de cada produto no fundo do cartão) nunca carregam significado e nunca ficam atrás de texto pequeno sem escurecer o fundo.

### Para o projeto do mapa e da identidade (próxima conversa)

O que existe e pode ser reaproveitado:

- Tokens de cor e tipografia em `apps/web/src/design/identidade.css`; placar de cores soltas com `npm run ui:cores` (hoje 727); contraste com `npm run ui:contraste`.
- Peças: `item.css` (cartão de produto), `IconePixel` (ilustrações), `ReporGaveta`, `GraficoPixel`/`BarrasPixel`, `CargaCaminho`, `EstadoEstoque`.
- O mapa noturno está em `lib/map-style.ts` (paleta grafite) e os marcadores em `components/WorldMap.tsx`, ainda com cores soltas (16 em `WorldMap.tsx`, 13 em `map-style.ts`). É o primeiro ponto a revisar, junto com o painel do imóvel e a compra de imóvel.
- Pendências que a identidade nova deve resolver: telas ainda no estilo antigo (Comprar, Cotações, Pedidos, Contratos, Frota, Fábrica, Meus Negócios, Empresa), `landing.css` com sua própria paleta, e a revisão das chaves em forma geométrica dos gráficos antigos.
