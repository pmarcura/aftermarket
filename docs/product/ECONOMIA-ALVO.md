# Economia alvo · etapa B

Números da proposta 1 aprovada pelo Pedro em 27/10/2026 (D-029). Itens e receitas ficam em [`packages/simulation/src/catalog.ts`](../../packages/simulation/src/catalog.ts), lido pelo motor e pela calculadora [`economy-design.ts`](../../packages/simulation/src/economy-design.ts); este documento resume. Para ver tudo: `npm run economy:design`. O teste `tests/economy-design.test.ts` falha se alguma regra de balanceamento quebrar.

Ainda **não** está no motor. O jogo atual segue o que descreve [ECONOMIA-HOJE](ECONOMIA-HOJE.md).

## Como os números foram escolhidos

1. **Preços seguem a vida real.** Cada item tem uma faixa de referência; o preço fica dentro dela. Itens sem referência real (caminhão, vaca, kit de utensílios) têm faixa de jogo identificada.
2. **O mundo precisa de lugar para todos.** A parcela da população que compra no jogo passa de 1% para 2%. Com isso a demanda sustenta cerca de 72 linhas de produção e 20 lojas, o suficiente para 4–5 amigos e cerca de 40 bots.
3. **O equipamento é o botão de ajuste.** O custo do equipamento de cada receita é o que faz a linha se pagar no prazo alvo: 35 dias de jogo para indústria e mineração, 30 para fazendas, 40 para lojas. Hoje o equipamento custa o mesmo para qualquer receita da categoria.
4. **Tudo tem destino.** Coprodutos são absorvidos (farelo 99,7%), sementes sobram só o necessário para novas fazendas e a sucata é sempre mais barata de reciclar do que fazer aço do minério.

## Uma linha de cada negócio

Lucro operacional por dia antes do investimento, em SP, a plena capacidade e preços alvo. "Linhas no mundo" é quanto o mundo de referência consome.

| Negócio                        | Lucro/dia |                        Investimento/linha | Linhas no mundo |
| ------------------------------ | --------: | ----------------------------------------: | --------------: |
| Extração de minério            |  R$ 5.896 |                                R$ 206 mil |             2,8 |
| Extração de carvão             |  R$ 7.396 |                                R$ 259 mil |             2,7 |
| Aço em alto-forno              | R$ 11.558 |                                R$ 405 mil |             5,3 |
| Aço reciclado (mesmo forno)    | R$ 13.045 |                                R$ 457 mil |             0,8 |
| Utensílios de aço              |  R$ 3.097 |                                R$ 108 mil |             6,2 |
| Caminhão pesado                | R$ 26.898 |                                R$ 941 mil |             0,8 |
| Caminhão leve                  | R$ 26.060 |                                R$ 912 mil |             0,4 |
| Colheita de soja               | R$ 10.057 |                                R$ 302 mil |             4,8 |
| Esmagamento de soja            |  R$ 4.082 |                                R$ 143 mil |             3,0 |
| Fábrica de ração               |  R$ 3.504 |                                R$ 123 mil |             2,3 |
| Ordenha (150 vacas)            | R$ 15.170 | R$ 455 mil, dos quais R$ 375 mil em vacas |            15,9 |
| Colheita de arroz              |  R$ 2.802 |                                 R$ 84 mil |             8,9 |
| Colheita de feijão             |  R$ 2.049 |                                 R$ 61 mil |            13,4 |
| Colheita de cana e açúcar      |  R$ 2.257 |                                 R$ 68 mil |             5,0 |
| Loja de referência (8 pessoas) |  R$ 5.495 |                                R$ 220 mil |      19,7 lojas |

## Preços alvo

| Item                   |        Porta da fábrica |  Na loja |
| ---------------------- | ----------------------: | -------: |
| Minério de ferro       |                R$ 500/t |        — |
| Carvão                 |              R$ 1.850/t |        — |
| Sucata                 |              R$ 1.200/t |        — |
| Aço                    |              R$ 5.000/t |        — |
| Caminhão pesado / leve | R$ 290 mil / R$ 140 mil |        — |
| Soja / semente de soja | R$ 2.400/t / R$ 6.000/t |        — |
| Farelo / ração         | R$ 2,20/kg / R$ 2,78/kg |        — |
| Vaca                   |                R$ 2.500 |        — |
| Óleo 1 L               |                 R$ 7,44 |  R$ 8,90 |
| Leite 1 L              |                 R$ 5,08 |  R$ 6,10 |
| Arroz 5 kg             |                R$ 20,39 | R$ 24,50 |
| Feijão 1 kg            |                 R$ 7,73 |  R$ 9,25 |
| Açúcar 5 kg            |                R$ 15,35 | R$ 18,50 |
| Utensílios (kit)       |                R$ 54,38 | R$ 65,00 |

A loja trabalha com margem bruta de 16%.

## Fluxos diários do mundo de referência

- Aço: 36,7 t/dia. Governo 16 t (44%), utensílios 11,9 t, caminhões 8,8 t. Sucata recicla 5,1 t.
- Farelo: 27,2 t/dia produzidas pelo óleo, 27,1 t viram ração para 2.385 vacas.
- Rebanho cresce 1,4 vaca/dia além da reposição: são as vacas à venda para novas fazendas.

## Hipóteses a medir no laboratório

- **70% da demanda atendida.** Se as lojas atenderem menos, toda a cadeia encolhe junto.
- **Caminhões:** 0,8 pesado e 0,8 leve comprados por dia, só 25% para repor caminhões velhos. É uma frota crescendo; depois da fase de crescimento a procura cai, e o desgaste por km precisa ser calibrado para manter a reposição.
- **Sucata urbana:** 30% da massa dos utensílios volta pela coleta.
- **Montadora:** uma só atende o mundo. Bom alvo para um jogador ambicioso; risco de monopólio a observar.

## O que muda no motor (próximos passos da etapa B)

1. Corrigir as fórmulas que enganam os bots: M02, M03, M04, M05 e M07 da auditoria matemática (feito; provas em `tests/formula-fixes.test.ts`).
2. Nove itens novos com ficha do [padrão de recursos](RESOURCE-STANDARD.md): sementes de soja, arroz e feijão, muda de cana, ração, vaca, caminhão, utensílios e sucata.
3. Receitas com perda declarada, equipamento por receita e rebanho que fica na linha sem ser consumido, com nascimentos e aposentadorias.
4. Caminhão como mercadoria: a montadora produz, o comprador registra na frota, o veículo desgasta por km e pode virar sucata ou ser vendido usado.
5. Parcela de consumidores em 2%, consumo de utensílios, capacidade da loja em 50 unidades por pessoa por rodada e demanda do governo perto de 16 t/dia.
6. Coleta municipal vende sucata urbana a preço fixo.
7. Bots aprendem as receitas e os produtos novos pelos mesmos comandos.
8. Relógio de 120× para 6× (mundo semanal), junto com a etapa D.
9. Provar com 90 dias de bots no `/lab`, com várias sementes aleatórias.
