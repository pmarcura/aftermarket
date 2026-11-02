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

`npm run economy:proof -- --days=20 --window=10 --seeds=0,1 --scale=20 --write-doc` (uma semente por processo, juntadas com `--from`). Código `6f2774b`; temporada `c28047496501`. 2 sementes, janela dos últimos 10 dias de 20. Simulação: 50,3 [49,3–51,4] s por dia de jogo por semente.

### KPIs de mundo

| KPI                                                | Alvo                    |   Mediana [mín–máx] | Mediana | Pior caso |
| -------------------------------------------------- | ----------------------- | ------------------: | ------- | --------- |
| Dinheiro conservado (diferença em centavos)        | 0                       |             0 [0–0] | dentro  | dentro    |
| Empresas-bot quebradas ou suspensas                | 0                       |             0 [0–0] | dentro  | dentro    |
| Procura atendida pelas lojas                       | ≥ 55%                   |       51% [51%–52%] | fora    | fora      |
| Aço entregue ao governo (t/dia)                    | ≥ 256 (80% de 320)      | 177,2 [166,8–187,5] | fora    | fora      |
| Produtos vendidos com estoque fora de 1–7 dias     | 0                       |           5.5 [5–6] | fora    | fora      |
| Produtos com HHI ≥ 2.500 no atacado                | 0                       |             2 [2–2] | fora    | fora      |
| Receitas com utilização fora de 70–95%             | 0                       |           1.5 [1–2] | fora    | fora      |
| Receitas com lucro/linha ÷ projeto fora de 0,8–1,2 | 0                       |        11.5 [11–12] | fora    | fora      |
| Caminhões pesados comprados por dia                | referência 16, sem alvo |    11,4 [11,2–11,6] | —       | —         |
| Caminhões leves comprados por dia                  | referência 4, sem alvo  |       4,1 [3,7–4,5] | —       | —         |
| Caminhões importados por dia                       | sem alvo                |      2,65 [2,4–2,9] | —       | —         |
| Caminhões aposentados por dia                      | sem alvo                |   21,65 [20,8–22,5] | —       | —         |

Quebras por semente: 0: nenhuma; 1: nenhuma.

### Por negócio

Linhas instaladas: equipamento das unidades da especialidade. Linhas de referência: calculadora × escala. Linhas observadas: produção ÷ uma linha a plena capacidade. Utilização: linhas-dia usadas ÷ instaladas (alvo 70–95%). Resultado dos bots: R$/dia da especialidade (fórmula no topo). Lucro/linha: resultado ÷ linhas instaladas, comparado ao lucro de projeto da calculadora (alvo 0,8–1,2). Preço realizado: vendas no atacado dos produtores ÷ preço de referência.

| Negócio                               | Linhas instaladas | Linhas na referência |   Linhas observadas |       Utilização |     Resultado dos bots/dia (R$) |   Lucro/linha/dia (R$) | Projeto/linha/dia (R$) | Observado ÷ projeto | Preço realizado ÷ referência |
| ------------------------------------- | ----------------: | -------------------: | ------------------: | ---------------: | ------------------------------: | ---------------------: | ---------------------: | ------------------: | ---------------------------: |
| Extração de minério                   |        46 [46–46] |                 53,8 |      34,2 [33,4–35] |    74% [73%–76%] |       180.151 [178.148–182.153] |    3.916 [3.873–3.960] |                  3.268 |     1,2 [1,18–1,21] |             1,01 [1,01–1,01] |
| Extração de carvão                    |        41 [41–41] |                 51,2 |      32 [31,9–32,1] |    78% [78%–78%] |       231.508 [229.626–233.391] |    5.647 [5.601–5.692] |                  4.245 |    1,33 [1,32–1,34] |                      1 [1–1] |
| Aço em alto-forno (com aço reciclado) |        81 [81–81] |                100,9 |      63,6 [63–64,1] |    89% [88%–89%] |       913.717 [898.806–928.627] | 11.280 [11.096–11.465] |                  5.437 |    2,07 [2,04–2,11] |              1,11 [1,1–1,11] |
| Utensílios de aço                     |        99 [99–99] |                124,2 |    91,5 [90,7–92,4] |    92% [92%–93%] |       310.512 [300.438–320.585] |    3.136 [3.035–3.238] |                  1.110 |    2,83 [2,73–2,92] |             1,05 [1,05–1,06] |
| Montagem de caminhão pesado           |        13 [13–13] |                   16 |     10,1 [9,9–10,2] |    77% [76%–78%] |          93.339 [88.822–97.857] |    7.180 [6.832–7.527] |                  6.893 |    1,04 [0,99–1,09] |             0,94 [0,94–0,95] |
| Montagem de caminhão leve             |           2 [2–2] |                    2 |       1,4 [1,3–1,4] |    68% [65%–70%] |                  807 [45–1.568] |           403 [23–784] |                  6.704 |       0,06 [0–0,12] |             0,94 [0,94–0,94] |
| Colheita de soja                      |        77 [77–77] |                 95,4 |      60,8 [60–61,6] |    79% [78%–80%] |       604.569 [604.049–605.088] |    7.852 [7.845–7.858] |                  5.796 |    1,35 [1,35–1,36] |             0,96 [0,96–0,96] |
| Esmagamento de soja                   |        49 [49–49] |                 59,6 |      42,8 [42,5–43] |    87% [87%–88%] |       263.310 [251.578–275.042] |    5.374 [5.134–5.613] |                    613 |    8,77 [8,38–9,16] |              1,23 [1,2–1,26] |
| Fábrica de ração                      |        36 [36–36] |                 45,2 |      32,1 [32–32,2] |    89% [89%–89%] |       135.867 [131.498–140.236] |    3.774 [3.653–3.895] |                  2.273 |    1,66 [1,61–1,71] |             1,07 [1,07–1,07] |
| Ordenha                               |     254 [254–254] |                  318 | 216,2 [214,6–217,8] |    85% [84%–86%] | 2.879.681 [2.877.816–2.881.546] | 11.337 [11.330–11.345] |                  8.264 |    1,37 [1,37–1,37] |             1,04 [1,04–1,04] |
| Colheita de arroz                     |     143 [143–143] |                178,9 | 114,4 [114,4–114,4] |    80% [80%–80%] |       183.482 [180.626–186.339] |    1.283 [1.263–1.303] |                    872 |    1,47 [1,45–1,49] |             0,94 [0,93–0,94] |
| Colheita de feijão                    |     215 [215–215] |                268,3 | 193,5 [193,5–193,5] |    90% [90%–90%] |       403.133 [393.400–412.867] |    1.875 [1.830–1.920] |                    757 |    2,48 [2,42–2,54] |             0,97 [0,96–0,97] |
| Colheita de cana e açúcar             |        80 [80–80] |                 99,4 |          80 [80–80] | 100% [100%–100%] |       110.815 [110.057–111.572] |    1.385 [1.376–1.395] |                    752 |    1,84 [1,83–1,86] |             0,92 [0,92–0,92] |
| Lojas                                 |                 — |                    — |                   — |                — |       570.321 [555.300–585.342] |                      — |                      — |                   — |                            — |
| Distribuidores                        |                 — |                    — |                   — |                — |     996.128 [975.637–1.016.619] |                      — |                      — |                   — |                            — |

### Procura atendida por produto

| Produto                 |      Atendida |
| ----------------------- | ------------: |
| Feijão 1 kg             | 58% [58%–58%] |
| Leite 1 L               | 49% [49%–50%] |
| Óleo de soja 1 L        | 59% [57%–60%] |
| Arroz 5 kg              | 58% [58%–58%] |
| Açúcar 5 kg             | 57% [56%–57%] |
| Utensílios de aço (kit) | 54% [54%–54%] |

### Estoque e concentração

Dias de estoque: quanto o estoque do mundo dura no ritmo de vendas da janela (alvo 1–7). HHI: concentração das vendas no atacado por vendedor (2.500 ou mais é concentrado; 10.000 é um vendedor só).

| Produto                 | Dias de estoque |                 HHI |
| ----------------------- | --------------: | ------------------: |
| Feijão 1 kg             |   0,8 [0,7–0,9] |       449 [443–455] |
| Carvão mineral          |   3,5 [3,5–3,5] |       466 [453–478] |
| Ração para gado         |   1,2 [1,1–1,3] |       164 [161–167] |
| Minério de ferro        |     3,9 [3,8–4] |       387 [369–405] |
| Leite 1 L               |   0,6 [0,6–0,7] |       376 [372–381] |
| Óleo de soja 1 L        |   2,2 [2,2–2,2] |       423 [400–445] |
| Arroz 5 kg              |     0,9 [0,7–1] |   1.051 [972–1.130] |
| Sucata de aço           |   1,7 [1,3–2,1] | 2.724 [2.722–2.725] |
| Soja em grão            |   1,7 [1,6–1,8] |       382 [379–384] |
| Farelo de soja          |   1,2 [1,1–1,3] |       363 [341–384] |
| Aço em barras           |     1,9 [1,8–2] |       163 [158–169] |
| Açúcar 5 kg             |     1,5 [1–2,1] |       502 [326–679] |
| Caminhão pesado 30 t    |         0 [0–0] |       788 [785–792] |
| Caminhão leve 8 t       |         0 [0–0] | 5.058 [5.007–5.109] |
| Utensílios de aço (kit) |     0,9 [0,8–1] |       213 [210–216] |

<!-- escala:20 fim -->
