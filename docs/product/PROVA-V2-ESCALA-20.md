# Prova da economia versão 2

Gerado por `npm run economy:proof -- --days=20 --window=10 --scale=20 --seeds=0,1 --write-doc`, escala 20 do mundo de referência. Médias de 2 sementes nos últimos 10 dias de 20. As sementes variam o capital inicial e os orçamentos dos bots em ±15% e rodam as estratégias; não há jogadores humanos. Detalhe por semente em `test-results/economy-proof.json`.

## Resumo

| Critério                        | Alvo                    | Observado                        |
| ------------------------------- | ----------------------- | -------------------------------- |
| Dinheiro conservado             | diferença 0             | sim, em todas as sementes        |
| Empresas quebradas ou suspensas | nenhuma                 | 0 / 0                            |
| Procura atendida pelas lojas    | 70%                     | 51%                              |
| Aço ao governo                  | 320 t/dia               | 177,2 t/dia                      |
| Caminhões comprados             | 16 pesado + 16 leve/dia | 11,4 + 4,1/dia (2,65 importados) |
| Caminhões aposentados           | reposição               | 21,65/dia                        |
| Tempo de simulação              | —                       | 14,3 s por dia de jogo           |

## Desvios explicados

- **Procura atendida abaixo de 70%:** as lojas-bot contratam equipe para 60% da procura da cidade (D-031). O resto fica para as lojas dos jogadores; sem humanos, a prova mede só os bots.
- **Linhas abaixo da referência:** os bots abrem com 60% a 90% das linhas da calculadora; a diferença é espaço para os jogadores.
- **Montadoras com pouca procura:** a frota cresce pouco depois de cheia, e a reposição depende do desgaste (vida útil comprimida, D-033). Uma montadora de jogador concorre com a de bot pela mesma procura.
- **Aço ao governo abaixo da meta:** cada edital pede de 6 a 24 t de uma só usina; as fábricas compram o aço assim que sai do forno, as usinas raramente juntam 24 t e os editais maiores expiram sem lance (D-038).
- **Tempo de simulação:** as sementes rodam em paralelo no mesmo computador; o tempo por dia é maior do que numa rodada isolada.

## Produção por negócio

"Linhas" é a produção diária dividida pela de uma linha a plena capacidade. Resultado é o lucro operacional diário dos bots da especialidade: entradas menos saídas mais o estoque formado a preço de referência, sem imóveis, crédito, caminhões e educação da equipe.

| Negócio                     | Linhas na referência | Linhas observadas |   % | Resultado dos bots/dia (R$) |
| --------------------------- | -------------------: | ----------------: | --: | --------------------------: |
| Extração de minério         |                 53,8 |              34,2 | 64% |                     173.889 |
| Extração de carvão          |                 51,2 |                32 | 63% |                      91.065 |
| Aço em alto-forno           |                100,9 |              63,6 | 63% |                     414.041 |
| Aço reciclado               |                 15,6 |               8,2 | 53% |                           0 |
| Utensílios de aço           |                124,2 |              91,5 | 74% |                      37.957 |
| Montagem de caminhão pesado |                   16 |              10,1 | 63% |                          25 |
| Montagem de caminhão leve   |                    2 |               1,4 | 68% |                      -1.778 |
| Colheita de soja            |                 95,4 |              60,8 | 64% |                     471.865 |
| Esmagamento de soja         |                 59,6 |              42,8 | 72% |                     -83.612 |
| Fábrica de ração            |                 45,2 |              32,1 | 71% |                     -51.402 |
| Ordenha                     |                  318 |             216,2 | 68% |                   2.527.418 |
| Colheita de arroz           |                178,9 |             114,4 | 64% |                     -90.142 |
| Colheita de feijão          |                268,3 |             193,5 | 72% |                    -129.410 |
| Colheita de cana e açúcar   |                 99,4 |                80 | 80% |                      66.198 |
| Lojas                       |                    — |                 — |   — |                     423.248 |
| Distribuidores              |                    — |                 — |   — |                   1.621.149 |

## Procura atendida por produto

| Produto  | Atendida |
| -------- | -------: |
| beans    |      58% |
| milk     |      49% |
| oil      |      59% |
| rice     |      58% |
| sugar    |      57% |
| utensils |      54% |

## Estoque parado e concentração

Dias de estoque: quanto o estoque do mundo duraria no ritmo de vendas recente. Concentração: índice HHI das vendas no atacado (acima de 2.500 é concentrado; 10.000 é um só vendedor).

| Produto      | Dias de estoque | Concentração |
| ------------ | --------------: | -----------: |
| beanSeed     |               0 |            0 |
| beans        |               1 |          449 |
| caneSeedling |               0 |            0 |
| coal         |               3 |          466 |
| cow          |               0 |            0 |
| feed         |               1 |          164 |
| iron         |               4 |          387 |
| milk         |               1 |          376 |
| oil          |               2 |          423 |
| rice         |               1 |        1.051 |
| riceSeed     |               0 |            0 |
| scrap        |               2 |        2.724 |
| soy          |               2 |          382 |
| soySeed      |               0 |            0 |
| soymeal      |               1 |          363 |
| steel        |               2 |          163 |
| sugar        |               2 |          502 |
| truckHeavy   |               0 |          788 |
| truckLight   |               0 |        5.058 |
| utensils     |               1 |          213 |
