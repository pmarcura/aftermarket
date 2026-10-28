# Prova da economia versão 2

Gerado por `npm run economy:proof -- --days=20 --window=10 --scale=20 --seeds=0,1 --write-doc`, escala 20 do mundo de referência. Médias de 2 sementes nos últimos 10 dias de 20. As sementes variam o capital inicial e os orçamentos dos bots em ±15% e rodam as estratégias; não há jogadores humanos. Detalhe por semente em `test-results/economy-proof.json`.

## Resumo

| Critério                        | Alvo                    | Observado                       |
| ------------------------------- | ----------------------- | ------------------------------- |
| Dinheiro conservado             | diferença 0             | sim, em todas as sementes       |
| Empresas quebradas ou suspensas | nenhuma                 | 0 / 0                           |
| Procura atendida pelas lojas    | 70%                     | 51%                             |
| Aço ao governo                  | 320 t/dia               | 204 t/dia                       |
| Caminhões comprados             | 16 pesado + 16 leve/dia | 9,9 + 3,55/dia (0,2 importados) |
| Caminhões aposentados           | reposição               | 19,6/dia                        |
| Tempo de simulação              | —                       | 21,5 s por dia de jogo          |

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
| Extração de minério         |                 56,2 |              36,4 | 65% |                     163.116 |
| Extração de carvão          |                 53,6 |              34,5 | 64% |                     111.264 |
| Aço em alto-forno           |                105,4 |              68,7 | 65% |                     440.613 |
| Aço reciclado               |                   17 |               8,2 | 48% |                           0 |
| Utensílios de aço           |                124,2 |              90,6 | 73% |                      83.772 |
| Montagem de caminhão pesado |                   16 |               9,7 | 60% |                     224.177 |
| Montagem de caminhão leve   |                    8 |               1,8 | 22% |                     -15.708 |
| Colheita de soja            |                 95,4 |              61,6 | 65% |                     394.934 |
| Esmagamento de soja         |                 59,6 |              42,7 | 72% |                     -19.787 |
| Fábrica de ração            |                 45,2 |              31,5 | 70% |                       9.135 |
| Ordenha                     |                  318 |             213,9 | 67% |                   2.493.872 |
| Colheita de arroz           |                178,9 |             114,4 | 64% |                     -77.292 |
| Colheita de feijão          |                268,3 |             193,5 | 72% |                         -17 |
| Colheita de cana e açúcar   |                 99,4 |                80 | 80% |                      64.303 |
| Lojas                       |                    — |                 — |   — |                     477.614 |
| Distribuidores              |                    — |                 — |   — |                   1.477.454 |

## Procura atendida por produto

| Produto  | Atendida |
| -------- | -------: |
| beans    |      58% |
| milk     |      49% |
| oil      |      59% |
| rice     |      57% |
| sugar    |      57% |
| utensils |      54% |

## Estoque parado e concentração

Dias de estoque: quanto o estoque do mundo duraria no ritmo de vendas recente. Concentração: índice HHI das vendas no atacado (acima de 2.500 é concentrado; 10.000 é um só vendedor).

| Produto      | Dias de estoque | Concentração |
| ------------ | --------------: | -----------: |
| beanSeed     |               0 |            0 |
| beans        |               1 |          557 |
| caneSeedling |               0 |            0 |
| coal         |               4 |          464 |
| cow          |               0 |            0 |
| feed         |               1 |          170 |
| iron         |               4 |          406 |
| milk         |               1 |          313 |
| oil          |               2 |          448 |
| rice         |               1 |        1.013 |
| riceSeed     |               0 |            0 |
| scrap        |               2 |        6.551 |
| soy          |               2 |          349 |
| soySeed      |               0 |            0 |
| soymeal      |               1 |          366 |
| steel        |               2 |          147 |
| sugar        |               2 |          742 |
| truckHeavy   |               0 |          801 |
| truckLight   |               2 |        2.491 |
| utensils     |               1 |          191 |
