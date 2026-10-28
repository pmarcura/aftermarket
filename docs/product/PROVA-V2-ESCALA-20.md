# Prova da economia versão 2

Gerado por `npm run economy:proof -- --days=20 --window=10 --scale=20 --seeds=0 --write-doc`, escala 20 do mundo de referência. Médias de 1 sementes nos últimos 10 dias de 20. As sementes variam o capital inicial e os orçamentos dos bots em ±15% e rodam as estratégias; não há jogadores humanos. Detalhe por semente em `test-results/economy-proof.json`.

## Resumo

| Critério                        | Alvo                    | Observado                    |
| ------------------------------- | ----------------------- | ---------------------------- |
| Dinheiro conservado             | diferença 0             | sim, em todas as sementes    |
| Empresas quebradas ou suspensas | nenhuma                 | 0                            |
| Procura atendida pelas lojas    | 70%                     | 38%                          |
| Aço ao governo                  | 320 t/dia               | 11,7 t/dia                   |
| Caminhões comprados             | 16 pesado + 16 leve/dia | 7,9 + 2,7/dia (1 importados) |
| Caminhões aposentados           | reposição               | 13/dia                       |
| Tempo de simulação              | —                       | 11,6 s por dia de jogo       |

## Desvios explicados

- **Procura atendida abaixo de 70%:** as lojas-bot contratam equipe para 60% da procura da cidade (D-031). O resto fica para as lojas dos jogadores; sem humanos, a prova mede só os bots.
- **Linhas abaixo da referência:** os bots abrem com 60% a 90% das linhas da calculadora; a diferença é espaço para os jogadores.
- **Montadoras com pouca procura:** a frota cresce pouco depois de cheia, e a reposição depende do desgaste (vida útil comprimida, D-033). Uma montadora de jogador concorre com a de bot pela mesma procura.
- **Aço ao governo abaixo de 16 t/dia:** parte dos editais pede qualidade acima da que as siderúrgicas-bot produzem, e outros expiram antes de juntar estoque.
- **Tempo de simulação:** as sementes rodam em paralelo no mesmo computador; o tempo por dia é maior do que numa rodada isolada.

## Produção por negócio

"Linhas" é a produção diária dividida pela de uma linha a plena capacidade. Resultado é o lucro operacional diário dos bots da especialidade: entradas menos saídas mais o estoque formado a preço de referência, sem imóveis, crédito, caminhões e educação da equipe.

| Negócio                     | Linhas na referência | Linhas observadas |   % | Resultado dos bots/dia (R$) |
| --------------------------- | -------------------: | ----------------: | --: | --------------------------: |
| Extração de minério         |                 56,2 |               9,2 | 16% |                     -16.055 |
| Extração de carvão          |                 53,6 |               8,7 | 16% |                     -30.315 |
| Aço em alto-forno           |                105,4 |              15,9 | 15% |                     -35.311 |
| Aço reciclado               |                   17 |               6,5 | 38% |                           0 |
| Utensílios de aço           |                124,2 |              67,8 | 55% |                      21.211 |
| Montagem de caminhão pesado |                   16 |               6,9 | 43% |                      52.615 |
| Montagem de caminhão leve   |                    8 |               1,2 | 14% |                     -13.093 |
| Colheita de soja            |                 95,4 |              50,4 | 53% |                     319.639 |
| Esmagamento de soja         |                 59,6 |              40,3 | 68% |                     145.928 |
| Fábrica de ração            |                 45,2 |              29,8 | 66% |                    -181.386 |
| Ordenha                     |                  318 |             177,9 | 56% |                   1.968.643 |
| Colheita de arroz           |                178,9 |             114,4 | 64% |                    -198.304 |
| Colheita de feijão          |                268,3 |             193,5 | 72% |                     -69.405 |
| Colheita de cana e açúcar   |                 99,4 |                80 | 80% |                      35.629 |
| Lojas                       |                    — |                 — |   — |                     366.856 |
| Distribuidores              |                    — |                 — |   — |                     468.806 |

## Procura atendida por produto

| Produto  | Atendida |
| -------- | -------: |
| beans    |      57% |
| milk     |      35% |
| oil      |      53% |
| rice     |      49% |
| sugar    |      53% |
| utensils |      43% |

## Estoque parado e concentração

Dias de estoque: quanto o estoque do mundo duraria no ritmo de vendas recente. Concentração: índice HHI das vendas no atacado (acima de 2.500 é concentrado; 10.000 é um só vendedor).

| Produto      | Dias de estoque | Concentração |
| ------------ | --------------: | -----------: |
| beanSeed     |               0 |            0 |
| beans        |               1 |          961 |
| caneSeedling |               0 |            0 |
| coal         |              17 |        1.258 |
| cow          |               0 |            0 |
| feed         |               2 |          224 |
| iron         |              19 |          904 |
| milk         |               1 |          227 |
| oil          |               1 |          435 |
| rice         |               2 |        1.082 |
| riceSeed     |               0 |            0 |
| scrap        |               2 |        2.647 |
| soy          |               4 |          675 |
| soySeed      |               0 |            0 |
| soymeal      |               1 |          381 |
| steel        |               2 |          322 |
| sugar        |               2 |          688 |
| truckHeavy   |               0 |        1.073 |
| truckLight   |               1 |        3.178 |
| utensils     |               1 |          256 |
