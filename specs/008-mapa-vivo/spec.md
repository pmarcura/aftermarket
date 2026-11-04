# Spec 008 · Mapa vivo (jogabilidade no mapa)

Estado: **rascunho** (aguarda ok do John). Depende de 006 (economia estável). Antes da arte pixelada (D-042): esta spec muda o que o jogador **faz** no mapa; a arte vem por cima depois.

## Problema (levantamento de 03/11/2026, `apps/web/src/components/WorldMap.tsx`)

O mapa funciona (estradas reais, caminhões animados, lotes, filtro, camadas), mas é um **visualizador**, não um lugar de decisão:

- Pinos não dizem nada: sem tooltip, sem estado (estoque parado, prejuízo, sem insumo), só "meu / rival / à venda". Os "pontos vermelhos que pedem sua atenção" do `tabuleiro-vivo` não existem.
- Cidades não são clicáveis: não há painel de cidade (população, procura por produto, quem vende lá, preço de prateleira).
- A economia é invisível no mapa: a camada "calor de consumo" soma tudo em R$, sem produto, sem escala, sem legenda. O modo de bolhas por região (preço, estoque, cobertura) já existe no código (`WorldMap.tsx:920-1029`) e **ninguém chama** (código morto).
- Caminhões: ícone genérico, sem dono/produto, sem clique, só aparecem com a camada "cargas" (desligada por padrão); 150 remessas de bots no máximo e só com rota confirmada — o tráfego dos bots praticamente não aparece.
- Fluxos de abastecimento não existem: nada liga as unidades do jogador aos fornecedores/clientes.
- Legenda estática, não explica rotas, calor, zoneamento, "SEU", linha verde percorrida.
- Recentralizar cai sempre em Campinas.

## Requisitos (ordem de valor para o jogador)

- **R1 Pino com estado.** Cada unidade do jogador mostra um selo: 🔴 problema (parada, sem insumo, caixa < 3 dias, estoque > 7 dias), 🟡 atenção (pedido pendente, caminhão atrasado), nenhum = ok. Hover/toque abre cartão curto (nome, especialidade, estoque, resultado do dia, 1 ação). Rivais: nome da empresa e o que vendem.
- **R2 Cidade clicável.** Painel da cidade: população, procura/dia por produto, atendida %, preço médio de prateleira, lojas presentes, lotes à venda. Botão "ver ofertas aqui".
- **R3 Camada econômica por produto.** Seletor de produto + métrica (preço, procura atendida, estoque em dias) reaproveitando o modo de bolhas existente; legenda com escala. Substitui o "calor de consumo" agregado.
- **R4 Minha cadeia.** Com uma unidade selecionada, linhas de origem→destino dos últimos 7 dias (fornecedores e clientes), espessura por volume; caminhões do jogador sempre visíveis, com cor da empresa e clique → pedido.
- **R5 Legenda viva e recentralizar nos meus negócios.** Legenda reflete as camadas ligadas; "recentralizar" enquadra as unidades do jogador (Campinas só se não tiver nenhuma).
- **R6 Sem rede externa nos testes.** Tudo coberto por e2e com tiles vazios (fixture atual); desktop, celular, teclado.

## Fora desta spec

Arte pixelada do mapa e dos marcadores (spec própria, D-042); tiles próprios/PMTiles (spec 007, servidor); tráfego completo dos bots (custo de payload; só o que toca o jogador).

## Critérios de aceite

- **A1** Jogador novo consegue, só pelo mapa: escolher cidade com procura não atendida → ver lote à venda → comprar → ver o pino com estado depois de operar (teste e2e `mapa-vivo.spec.ts`).
- **A2** Unidade com problema recebe 🔴 em até uma rodada econômica; sem falso positivo no mundo `baseline` saudável.
- **A3** Payload de `/api/world` não cresce mais de 10% (fluxos agregados no servidor, 7 dias).
- **A4** Acessibilidade: cartões e painel com nome acessível; `.map-access` continua cobrindo cidades e unidades.
