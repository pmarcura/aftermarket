# Prova da economia versão 2

Gerado por `npm run economy:proof -- --days=90 --seeds=0,1,2 --write-doc`. Médias de 3 sementes nos últimos 30 dias de 90. As sementes variam o capital inicial e os orçamentos dos bots em ±15% e rodam as estratégias; não há jogadores humanos. Detalhe por semente em `test-results/economy-proof.json`.

## Resumo

| Critério                        | Alvo                      | Observado                         |
| ------------------------------- | ------------------------- | --------------------------------- |
| Dinheiro conservado             | diferença 0               | sim, em todas as sementes         |
| Empresas quebradas ou suspensas | nenhuma                   | 0 / 0 / 1                         |
| Procura atendida pelas lojas    | 70%                       | 48%                               |
| Aço ao governo                  | 16 t/dia                  | 9,3 t/dia                         |
| Caminhões comprados             | 0,8 pesado + 0,8 leve/dia | 0,44 + 0,16/dia (0,06 importados) |
| Caminhões aposentados           | reposição                 | 0,71/dia                          |
| Tempo de simulação              | —                         | 6 s por dia de jogo               |

## Desvios explicados

- **Procura atendida abaixo de 70%:** as lojas-bot contratam equipe para 60% da procura da cidade (D-031). O resto fica para as lojas dos jogadores; sem humanos, a prova mede só os bots.
- **Linhas abaixo da referência:** os bots abrem com 60% a 90% das linhas da calculadora; a diferença é espaço para os jogadores.
- **Montadoras com pouca procura:** a frota cresce pouco depois de cheia, e a reposição depende do desgaste (vida útil comprimida, D-033). Uma montadora de jogador concorre com a de bot pela mesma procura.
- **Aço ao governo abaixo de 16 t/dia:** parte dos editais pede qualidade acima da que as siderúrgicas-bot produzem, e outros expiram antes de juntar estoque.
- **Tempo de simulação:** as sementes rodam em paralelo no mesmo computador; o tempo por dia é maior do que numa rodada isolada.

## Produção por negócio

"Linhas" é a produção diária dividida pela de uma linha a plena capacidade. Caixa é o fluxo operacional diário dos bots da especialidade (entradas menos saídas, sem compra de imóveis e equipamento).

| Negócio                     | Linhas na referência | Linhas observadas |   % | Caixa dos bots/dia (R$) |
| --------------------------- | -------------------: | ----------------: | --: | ----------------------: |
| Extração de minério         |                  2,8 |               1,9 | 67% |                     826 |
| Extração de carvão          |                  2,7 |               1,7 | 65% |                   4.710 |
| Aço em alto-forno           |                  5,3 |               3,4 | 65% |                  31.991 |
| Aço reciclado               |                  0,8 |               0,5 | 54% |                       0 |
| Utensílios de aço           |                  6,2 |                 5 | 81% |                   7.984 |
| Montagem de caminhão pesado |                  0,8 |               0,4 | 44% |                    -539 |
| Montagem de caminhão leve   |                  0,4 |               0,1 | 19% |                 -13.046 |
| Colheita de soja            |                  4,8 |               3,6 | 76% |                   6.179 |
| Esmagamento de soja         |                    3 |               2,2 | 74% |                   2.911 |
| Fábrica de ração            |                  2,3 |               1,7 | 74% |                   2.696 |
| Ordenha                     |                 15,9 |              11,6 | 73% |                 182.381 |
| Colheita de arroz           |                  8,9 |               7,6 | 85% |                  10.865 |
| Colheita de feijão          |                 13,4 |              10,2 | 76% |                  18.812 |
| Colheita de cana e açúcar   |                    5 |               3,1 | 63% |                   2.452 |

## Procura atendida por produto

| Produto  | Atendida |
| -------- | -------: |
| beans    |      56% |
| milk     |      46% |
| oil      |      52% |
| rice     |      56% |
| sugar    |      44% |
| utensils |      51% |

## Estoque parado e concentração

Dias de estoque: quanto o estoque do mundo duraria no ritmo de vendas recente. Concentração: índice HHI das vendas no atacado (acima de 2.500 é concentrado; 10.000 é um só vendedor).

| Produto      | Dias de estoque | Concentração |
| ------------ | --------------: | -----------: |
| beanSeed     |               0 |            0 |
| beans        |               4 |        4.658 |
| caneSeedling |               0 |            0 |
| coal         |               6 |        4.951 |
| cow          |               0 |            0 |
| feed         |               4 |        3.506 |
| iron         |               7 |        3.799 |
| milk         |               1 |        2.552 |
| oil          |               3 |        3.138 |
| rice         |               4 |        4.322 |
| riceSeed     |               0 |            0 |
| scrap        |               4 |       10.000 |
| soy          |              14 |        5.112 |
| soySeed      |               0 |            0 |
| soymeal      |               5 |        2.837 |
| steel        |               5 |        3.277 |
| sugar        |               9 |        8.688 |
| truckHeavy   |               3 |       10.000 |
| truckLight   |              14 |       10.000 |
| utensils     |               3 |        3.443 |
