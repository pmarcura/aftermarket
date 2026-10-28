# Prova da economia versão 2

Gerado por `npm run economy:proof -- --days=20 --window=10 --scale=20 --seeds=0,1 --write-doc`, escala 20 do mundo de referência. Médias de 2 sementes nos últimos 10 dias de 20. As sementes variam o capital inicial e os orçamentos dos bots em ±15% e rodam as estratégias; não há jogadores humanos. Detalhe por semente em `test-results/economy-proof.json`.

## Resumo

| Critério                        | Alvo                    | Observado                        |
| ------------------------------- | ----------------------- | -------------------------------- |
| Dinheiro conservado             | diferença 0             | sim, em todas as sementes        |
| Empresas quebradas ou suspensas | nenhuma                 | 0 / 0                            |
| Procura atendida pelas lojas    | 70%                     | 50%                              |
| Aço ao governo                  | 320 t/dia               | 213,2 t/dia                      |
| Caminhões comprados             | 16 pesado + 16 leve/dia | 10,1 + 4,15/dia (0,4 importados) |
| Caminhões aposentados           | reposição               | 20,2/dia                         |
| Tempo de simulação              | —                       | 21,4 s por dia de jogo           |

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
| Extração de minério         |                 56,2 |              36,1 | 64% |                     160.633 |
| Extração de carvão          |                 53,6 |              34,8 | 65% |                      86.190 |
| Aço em alto-forno           |                105,4 |              67,8 | 64% |                     475.365 |
| Aço reciclado               |                   17 |               8,3 | 49% |                           0 |
| Utensílios de aço           |                124,2 |              88,8 | 71% |                     -57.962 |
| Montagem de caminhão pesado |                   16 |               9,3 | 58% |                      33.297 |
| Montagem de caminhão leve   |                    8 |               1,8 | 22% |                     -67.090 |
| Colheita de soja            |                 95,4 |              63,2 | 66% |                     386.353 |
| Esmagamento de soja         |                 59,6 |              44,5 | 75% |                     -17.517 |
| Fábrica de ração            |                 45,2 |              33,1 | 73% |                    -162.163 |
| Ordenha                     |                  318 |             211,2 | 66% |                   2.508.877 |
| Colheita de arroz           |                178,9 |             114,4 | 64% |                    -114.957 |
| Colheita de feijão          |                268,3 |             193,5 | 72% |                     -37.705 |
| Colheita de cana e açúcar   |                 99,4 |                80 | 80% |                      92.329 |
| Lojas                       |                    — |                 — |   — |                     239.007 |
| Distribuidores              |                    — |                 — |   — |                   1.521.419 |

## Procura atendida por produto

| Produto  | Atendida |
| -------- | -------: |
| beans    |      60% |
| milk     |      48% |
| oil      |      58% |
| rice     |      58% |
| sugar    |      58% |
| utensils |      53% |

## Estoque parado e concentração

Dias de estoque: quanto o estoque do mundo duraria no ritmo de vendas recente. Concentração: índice HHI das vendas no atacado (acima de 2.500 é concentrado; 10.000 é um só vendedor).

| Produto      | Dias de estoque | Concentração |
| ------------ | --------------: | -----------: |
| beanSeed     |               0 |            0 |
| beans        |               1 |          852 |
| caneSeedling |               0 |            0 |
| coal         |               4 |          467 |
| cow          |               0 |            0 |
| feed         |               1 |          176 |
| iron         |               4 |          409 |
| milk         |               1 |          344 |
| oil          |               2 |          426 |
| rice         |               1 |          999 |
| riceSeed     |               0 |            0 |
| scrap        |               2 |        5.839 |
| soy          |               2 |          376 |
| soySeed      |               0 |            0 |
| soymeal      |               1 |          332 |
| steel        |               2 |          153 |
| sugar        |               1 |          573 |
| truckHeavy   |               0 |          793 |
| truckLight   |               1 |        2.470 |
| utensils     |               1 |          236 |
