# Prova da economia

Régua oficial de balanceamento (constituição §5, spec 003), gerada por `npm run economy:proof -- --write-doc`. Cada escala tem sua seção; rodar a prova numa escala regenera só a seção dela. O detalhe por semente fica no JSON de `test-results/`.

## Como ler

- **Mundo medido:** mundo jogável (`playtest`) criado do zero, só bots, sem jogadores humanos. As sementes variam o capital inicial e os orçamentos dos bots em ±15% e rodam as estratégias.
- **Números:** mediana [mínimo–máximo] entre sementes, nunca média. A janela são os últimos dias da rodada, depois da partida.
- **Resultado dos bots:** caixa operacional da janela (sem imóvel e equipamento, crédito, verba do cenário, educação, caminhões da frota e venda de ativos) mais a variação do estoque a custo médio, dos lotes em curso a custo e das cargas compradas em trânsito. Nenhum preço de referência entra no resultado.
- **Projeto:** lucro por linha instalada da calculadora (`npm run economy:design`) com 70% de utilização e 95% do preço de referência. As receitas que não fecham na própria calculadora estão em `knownBalanceDebt` (`tests/economy-design.test.ts`).
- **Situação:** "Mediana" diz se a mediana atende o alvo; "Pior caso" avalia o extremo do lado do alvo (o mínimo para alvo mínimo, o máximo para alvo máximo). Regra de aceitação de uma mudança de balanceamento: a mediana melhora e o pior caso não piora em todos os KPIs com alvo.
- **Referência sem alvo:** compras de caminhão comparadas à frota da calculadora; não decidem aceitação.

<!-- escala:1 início -->

## Escala 1

`npm run economy:proof -- --days=60 --window=30 --seeds=0,1,2,3,4 --scale=1 --write-doc` (uma semente por processo, juntadas com `--from`). Código `0b1e6bb`; temporada `87c8ecc278c7`. 5 sementes, janela dos últimos 30 dias de 60. Simulação: 0,8 [0,7–0,9] s por dia de jogo por semente.

### KPIs de mundo

| KPI                                                | Alvo                     | Mediana [mín–máx] | Mediana | Pior caso |
| -------------------------------------------------- | ------------------------ | ----------------: | ------- | --------- |
| Dinheiro conservado (diferença em centavos)        | 0                        |           0 [0–0] | dentro  | dentro    |
| Empresas-bot quebradas ou suspensas                | 0                        |           0 [0–2] | dentro  | fora      |
| Procura atendida pelas lojas                       | ≥ 55%                    |     57% [46%–59%] | dentro  | fora      |
| Aço entregue ao governo (t/dia)                    | ≥ 12,8 (80% de 16)       |     7,7 [6,1–9,6] | fora    | fora      |
| Produtos vendidos com estoque fora de 1–7 dias     | 0                        |         12 [9–13] | fora    | fora      |
| Produtos com HHI ≥ 2.500 no atacado                | sem alvo nesta escala    |        13 [10–13] | —       | —         |
| Receitas com utilização fora de 70–95%             | 0                        |        10 [10–12] | fora    | fora      |
| Receitas com lucro/linha ÷ projeto fora de 0,8–1,2 | 0                        |        10 [10–12] | fora    | fora      |
| Caminhões pesados comprados por dia                | referência 0,8, sem alvo |   0,6 [0,37–0,73] | —       | —         |
| Caminhões leves comprados por dia                  | referência 0,2, sem alvo |  0,23 [0,13–0,23] | —       | —         |
| Caminhões importados por dia                       | sem alvo                 |   0,17 [0,03–0,2] | —       | —         |
| Caminhões aposentados por dia                      | sem alvo                 |    1,4 [1,3–1,87] | —       | —         |

Quebras por semente: 0: nenhuma; 1: nenhuma; 2: nenhuma; 3: rival-32 warehouse suspensa, rival-34 warehouse suspensa; 4: rival-32 warehouse suspensa, rival-34 warehouse suspensa.

### Por negócio

Linhas instaladas: equipamento das unidades da especialidade. Linhas de referência: calculadora × escala. Linhas observadas: produção ÷ uma linha a plena capacidade. Utilização: linhas-dia usadas ÷ instaladas (alvo 70–95%). Resultado dos bots: R$/dia da especialidade (fórmula no topo). Lucro/linha: resultado ÷ linhas instaladas, comparado ao lucro de projeto da calculadora (alvo 0,8–1,2). Preço realizado: vendas no atacado dos produtores ÷ preço de referência.

| Negócio                               | Linhas instaladas | Linhas na referência | Linhas observadas |    Utilização | Resultado dos bots/dia (R$) |   Lucro/linha/dia (R$) | Projeto/linha/dia (R$) | Observado ÷ projeto | Preço realizado ÷ referência |
| ------------------------------------- | ----------------: | -------------------: | ----------------: | ------------: | --------------------------: | ---------------------: | ---------------------: | ------------------: | ---------------------------: |
| Extração de minério                   |           5 [5–5] |                  2,7 |     1,5 [1,3–1,6] | 30% [26%–32%] |         3.861 [3.121–4.599] |          772 [624–920] |                  3.268 |    0,24 [0,19–0,28] |             0,92 [0,92–0,92] |
| Extração de carvão                    |           2 [2–2] |                  2,6 |     1,3 [1,1–1,5] | 67% [56%–75%] |        8.052 [5.764–10.252] |    4.026 [2.882–5.126] |                  4.245 |    0,95 [0,68–1,21] |             0,93 [0,92–0,95] |
| Aço em alto-forno (com aço reciclado) |           4 [4–4] |                    5 |       2,9 [2,4–3] | 79% [65%–81%] |      37.397 [29.840–40.530] |   9.349 [7.460–10.132] |                  5.437 |    1,72 [1,37–1,86] |             1,08 [1,03–1,08] |
| Utensílios de aço                     |           5 [5–5] |                  6,2 |     3,1 [2,7–4,3] | 63% [54%–86%] |          2.278 [-660–5.985] |       456 [-132–1.197] |                  1.110 |   0,41 [-0,12–1,08] |             0,95 [0,94–0,97] |
| Montagem de caminhão pesado           |           1 [1–1] |                  0,8 |     0,5 [0,3–0,5] | 47% [30%–47%] |          -33 [-3.121–1.444] |     -33 [-3.121–1.444] |                  6.893 |      0 [-0,45–0,21] |             0,92 [0,92–0,93] |
| Montagem de caminhão leve             |           1 [1–1] |                  0,1 |     0,1 [0,1–0,1] |  12% [5%–12%] |      -4.859 [-5.539–-2.436] | -4.859 [-5.539–-2.436] |                  6.704 | -0,72 [-0,83–-0,36] |             0,94 [0,94–0,95] |
| Colheita de soja                      |           5 [5–5] |                  4,8 |         2 [1,2–2] | 40% [24%–40%] |        4.760 [-1.334–7.148] |       952 [-267–1.430] |                  5.796 |   0,16 [-0,05–0,25] |             0,92 [0,92–0,92] |
| Esmagamento de soja                   |           3 [3–3] |                    3 |     1,1 [0,4–1,2] | 37% [14%–41%] |          -1.067 [-2.993–95] |         -356 [-998–32] |                    613 |  -0,58 [-1,63–0,05] |             1,01 [0,92–1,06] |
| Fábrica de ração                      |           2 [2–2] |                  2,3 |       0,9 [0,4–1] | 44% [21%–52%] |           5.298 [910–5.977] |      2.649 [455–2.989] |                  2.273 |     1,17 [0,2–1,32] |             1,06 [1,06–1,07] |
| Ordenha                               |        13 [13–13] |                 15,9 |     6,2 [4,1–7,2] | 48% [32%–55%] |      86.456 [61.842–98.527] |    6.650 [4.757–7.579] |                  8.264 |     0,8 [0,58–0,92] |                1,01 [1–1,05] |
| Colheita de arroz                     |           7 [7–7] |                  8,9 |       2,5 [0,5–4] |  36% [8%–57%] |        2.575 [-4.561–6.390] |         368 [-652–913] |                    872 |   0,42 [-0,75–1,05] |             0,92 [0,92–0,92] |
| Colheita de feijão                    |        11 [11–11] |                 13,4 |       9 [8,2–9,4] | 82% [75%–85%] |        9.890 [6.879–12.779] |        899 [625–1.162] |                    757 |    1,19 [0,83–1,53] |             0,92 [0,92–0,92] |
| Colheita de cana e açúcar             |           4 [4–4] |                    5 |       2,7 [2–2,7] | 67% [50%–67%] |           49 [-1.148–1.926] |          12 [-287–482] |                    752 |   0,02 [-0,38–0,64] |             0,92 [0,92–0,92] |
| Lojas                                 |                 — |                    — |                 — |             — |      14.883 [10.395–15.733] |                      — |                      — |                   — |                            — |
| Distribuidores                        |                 — |                    — |                 — |             — |       12.824 [5.803–20.550] |                      — |                      — |                   — |                            — |

### Procura atendida por produto

| Produto                 |      Atendida |
| ----------------------- | ------------: |
| Feijão 1 kg             | 66% [60%–73%] |
| Leite 1 L               | 58% [42%–60%] |
| Óleo de soja 1 L        | 41% [38%–57%] |
| Arroz 5 kg              |  51% [8%–64%] |
| Açúcar 5 kg             | 56% [52%–67%] |
| Utensílios de aço (kit) | 57% [47%–70%] |

### Estoque e concentração

Dias de estoque: quanto o estoque do mundo dura no ritmo de vendas da janela (alvo 1–7). HHI: concentração das vendas no atacado por vendedor (2.500 ou mais é concentrado; 10.000 é um vendedor só; sem alvo nesta escala).

| Produto                 |  Dias de estoque |                    HHI |
| ----------------------- | ---------------: | ---------------------: |
| Feijão 1 kg             | 12,1 [10,5–12,8] |    1.529 [1.418–1.811] |
| Carvão mineral          |    8,3 [2,8–9,3] |  10.000 [7.183–10.000] |
| Ração para gado         |    1,1 [0,8–1,3] |    5.090 [4.244–6.367] |
| Minério de ferro        |   11 [10,5–13,7] |    5.071 [4.833–5.821] |
| Leite 1 L               |    0,4 [0,1–0,7] |    1.927 [1.683–2.011] |
| Óleo de soja 1 L        |   12 [10,9–17,8] |    2.717 [1.988–3.571] |
| Arroz 5 kg              |  12,7 [8,2–78,9] |    2.889 [2.528–4.666] |
| Sucata de aço           |  13,7 [7,3–22,5] |  10.000 [8.237–10.000] |
| Soja em grão            |   33,7 [29,4–72] |    5.096 [5.046–6.005] |
| Farelo de soja          |     7,2 [6–21,2] | 10.000 [10.000–10.000] |
| Aço em barras           |    7,8 [5,9–8,2] |    3.352 [3.046–4.222] |
| Açúcar 5 kg             | 19,2 [16,7–28,5] |    2.767 [2.474–3.184] |
| Caminhão pesado 30 t    |        2,1 [0–3] | 10.000 [10.000–10.000] |
| Caminhão leve 8 t       |      8,6 [6–8,6] | 10.000 [10.000–10.000] |
| Utensílios de aço (kit) |    3,6 [1,5–5,7] |    2.579 [1.973–3.037] |

<!-- escala:1 fim -->

<!-- escala:20 início -->

## Escala 20

`npm run economy:proof -- --days=60 --window=30 --seeds=0,1,2,3,4 --scale=20 --write-doc` (uma semente por processo, juntadas com `--from`). Código `9000604`; temporada `df24bc2fda97`. 5 sementes, janela dos últimos 30 dias de 60. Simulação: 5,1 [3,5–5,9] s por dia de jogo por semente.

### KPIs de mundo

| KPI                                                | Alvo                    |   Mediana [mín–máx] | Mediana | Pior caso |
| -------------------------------------------------- | ----------------------- | ------------------: | ------- | --------- |
| Dinheiro conservado (diferença em centavos)        | 0                       |             0 [0–0] | dentro  | dentro    |
| Empresas-bot quebradas ou suspensas                | 0                       |             1 [0–1] | fora    | fora      |
| Procura atendida pelas lojas                       | ≥ 55%                   |       56% [56%–57%] | dentro  | dentro    |
| Aço entregue ao governo (t/dia)                    | ≥ 256 (80% de 320)      | 199,3 [189,5–215,2] | fora    | fora      |
| Produtos vendidos com estoque fora de 1–7 dias     | 0                       |             5 [4–5] | fora    | fora      |
| Produtos com HHI ≥ 2.500 no atacado                | 0                       |             2 [2–2] | fora    | fora      |
| Receitas com utilização fora de 70–95%             | 0                       |             3 [3–3] | fora    | fora      |
| Receitas com lucro/linha ÷ projeto fora de 0,8–1,2 | 0                       |          11 [11–12] | fora    | fora      |
| Caminhões pesados comprados por dia                | referência 16, sem alvo |  19,07 [18,6–19,33] | —       | —         |
| Caminhões leves comprados por dia                  | referência 4, sem alvo  |       3,1 [2,9–3,4] | —       | —         |
| Caminhões importados por dia                       | sem alvo                |        7 [6,33–7,5] | —       | —         |
| Caminhões aposentados por dia                      | sem alvo                |    25 [23,87–25,43] | —       | —         |

Quebras por semente: 0: rival-47 coal-extraction suspensa; 1: rival-34 coal-extraction suspensa; 2: nenhuma; 3: rival-47 coal-extraction suspensa; 4: rival-34 coal-extraction suspensa.

### Por negócio

Linhas instaladas: equipamento das unidades da especialidade. Linhas de referência: calculadora × escala. Linhas observadas: produção ÷ uma linha a plena capacidade. Utilização: linhas-dia usadas ÷ instaladas (alvo 70–95%). Resultado dos bots: R$/dia da especialidade (fórmula no topo). Lucro/linha: resultado ÷ linhas instaladas, comparado ao lucro de projeto da calculadora (alvo 0,8–1,2). Preço realizado: vendas no atacado dos produtores ÷ preço de referência.

| Negócio                               | Linhas instaladas | Linhas na referência |   Linhas observadas |       Utilização |     Resultado dos bots/dia (R$) |   Lucro/linha/dia (R$) | Projeto/linha/dia (R$) | Observado ÷ projeto | Preço realizado ÷ referência |
| ------------------------------------- | ----------------: | -------------------: | ------------------: | ---------------: | ------------------------------: | ---------------------: | ---------------------: | ------------------: | ---------------------------: |
| Extração de minério                   |        57 [57–57] |                 53,8 |        42,6 [42–44] |    75% [74%–77%] |       222.970 [215.230–235.571] |    3.912 [3.776–4.133] |                  3.268 |     1,2 [1,16–1,26] |                   1 [1–1,01] |
| Extração de carvão                    |        51 [51–51] |                 51,2 |    41,1 [39,5–41,8] |    81% [77%–82%] |       294.127 [280.363–299.892] |    5.767 [5.497–5.880] |                  4.245 |     1,36 [1,3–1,39] |                   1 [1–1,01] |
| Aço em alto-forno (com aço reciclado) |     101 [101–101] |                100,9 |        80 [78,7–82] |    89% [87%–91%] | 1.146.161 [1.129.795–1.173.594] | 11.348 [11.186–11.620] |                  5.437 |    2,09 [2,06–2,14] |                1,1 [1,1–1,1] |
| Utensílios de aço                     |     124 [124–124] |                124,2 |   116,3 [116,1–117] |    94% [94%–94%] |       779.496 [748.545–807.513] |    6.286 [6.037–6.512] |                  3.790 |    1,66 [1,59–1,72] |             1,01 [1,01–1,02] |
| Montagem de caminhão pesado           |        16 [16–16] |                   16 |      13 [12,3–13,5] |    81% [77%–84%] |       531.814 [519.909–556.481] | 33.238 [32.494–34.780] |                 34.823 |       0,95 [0,93–1] |             0,92 [0,92–0,92] |
| Montagem de caminhão leve             |           2 [2–2] |                    2 |       1,2 [1,1–1,3] |    59% [53%–65%] |          37.846 [31.431–40.040] | 18.923 [15.716–20.020] |                 33.304 |     0,57 [0,47–0,6] |             0,92 [0,92–0,92] |
| Colheita de soja                      |        96 [96–96] |                 95,4 |    85,3 [83,2–86,4] |    89% [87%–90%] |       652.497 [630.006–684.640] |    6.797 [6.563–7.132] |                  4.596 |    1,48 [1,43–1,55] |             0,97 [0,96–0,98] |
| Esmagamento de soja                   |        61 [61–61] |                 59,6 |    56,3 [55,4–57,4] |    92% [91%–94%] |       345.170 [321.982–361.216] |    5.659 [5.278–5.922] |                  4.005 |    1,41 [1,32–1,48] |                   1 [0,97–1] |
| Fábrica de ração                      |        45 [45–45] |                 45,2 |      40,3 [40–41,2] |    89% [89%–91%] |       419.908 [366.966–458.949] |   9.331 [8.155–10.199] |                  5.073 |    1,84 [1,61–2,01] |             1,06 [1,06–1,06] |
| Ordenha                               |     318 [318–318] |                  318 |   281,3 [278–291,2] |    88% [87%–92%] | 3.940.936 [3.898.572–4.066.284] | 12.393 [12.260–12.787] |                  8.273 |     1,5 [1,48–1,55] |             1,06 [1,06–1,07] |
| Colheita de arroz                     |     179 [179–179] |                178,9 | 167,1 [167,1–167,1] |    93% [93%–93%] |       487.266 [471.651–496.182] |    2.722 [2.635–2.772] |                  1.658 |    1,64 [1,59–1,67] |             0,92 [0,92–0,92] |
| Colheita de feijão                    |     268 [268–268] |                268,3 |       268 [268–268] | 100% [100%–100%] |       776.346 [764.291–783.015] |    2.897 [2.852–2.922] |                  1.613 |     1,8 [1,77–1,81] |             0,94 [0,94–0,95] |
| Colheita de cana e açúcar             |        99 [99–99] |                 99,4 |          99 [99–99] | 100% [100%–100%] |       281.453 [280.104–289.789] |    2.843 [2.829–2.927] |                  1.696 |    1,68 [1,67–1,73] |             0,92 [0,92–0,92] |
| Lojas                                 |                 — |                    — |                   — |                — |       645.744 [612.286–654.022] |                      — |                      — |                   — |                            — |
| Distribuidores                        |                 — |                    — |                   — |                — |       858.779 [811.339–884.302] |                      — |                      — |                   — |                            — |

### Procura atendida por produto

| Produto                 |      Atendida |
| ----------------------- | ------------: |
| Feijão 1 kg             | 63% [63%–64%] |
| Leite 1 L               | 54% [53%–56%] |
| Óleo de soja 1 L        | 64% [64%–66%] |
| Arroz 5 kg              | 62% [62%–64%] |
| Açúcar 5 kg             | 64% [64%–65%] |
| Utensílios de aço (kit) | 59% [58%–59%] |

### Estoque e concentração

Dias de estoque: quanto o estoque do mundo dura no ritmo de vendas da janela (alvo 1–7). HHI: concentração das vendas no atacado por vendedor (2.500 ou mais é concentrado; 10.000 é um vendedor só).

| Produto                 | Dias de estoque |                 HHI |
| ----------------------- | --------------: | ------------------: |
| Feijão 1 kg             |   0,9 [0,7–1,1] |       533 [484–548] |
| Carvão mineral          |     4,1 [4–4,7] |       374 [348–383] |
| Ração para gado         |   1,5 [1,2–1,5] |       132 [128–133] |
| Minério de ferro        |     4,1 [4–4,2] |       331 [314–342] |
| Leite 1 L               |   0,8 [0,8–0,9] |       344 [333–366] |
| Óleo de soja 1 L        |     2 [1,7–2,1] |       416 [346–507] |
| Arroz 5 kg              |     1,8 [1,7–2] |       349 [339–386] |
| Sucata de aço           |     2,3 [2–2,7] | 4.222 [2.637–4.583] |
| Soja em grão            |   1,9 [1,8–2,5] |       344 [326–344] |
| Farelo de soja          |     3 [2,5–3,6] |       223 [220–237] |
| Aço em barras           |   2,1 [1,7–2,2] |       130 [123–134] |
| Açúcar 5 kg             |   0,9 [0,8–1,1] |       386 [342–418] |
| Caminhão pesado 30 t    |         0 [0–0] |       628 [627–634] |
| Caminhão leve 8 t       |         0 [0–1] | 5.044 [5.003–5.189] |
| Utensílios de aço (kit) |   1,5 [1,4–1,7] |       215 [193–223] |

<!-- escala:20 fim -->
