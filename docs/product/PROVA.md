# Prova da economia

Régua oficial de balanceamento (constituição §5, spec 003), gerada por `npm run economy:proof -- --write-doc`. Cada escala tem sua seção; rodar a prova numa escala regenera só a seção dela. O detalhe por semente fica no JSON de `test-results/`.

## Como ler

- **Mundo medido:** mundo jogável (`playtest`) criado do zero, só bots, sem jogadores humanos. As sementes variam o capital inicial e os orçamentos dos bots em ±15% e rodam as estratégias.
- **Números:** mediana [mínimo–máximo] entre sementes, nunca média. A janela são os últimos dias da rodada, depois da partida.
- **Resultado dos bots:** caixa operacional da janela (sem imóvel e equipamento, crédito, verba do cenário, educação, caminhões da frota e venda de ativos) mais a variação do estoque a custo médio, dos lotes em curso a custo e das cargas compradas em trânsito. Nenhum preço de referência entra no resultado.
- **Projeto:** lucro por linha instalada da calculadora (`npm run economy:design`) com 70% de utilização e 95% do preço de referência. As receitas que não fecham na própria calculadora estão em `knownBalanceDebt` (`tests/economy-design.test.ts`).
- **Situação:** "Mediana" diz se a mediana atende o alvo; "Pior caso" avalia o extremo do lado do alvo (o mínimo para alvo mínimo, o máximo para alvo máximo). Regra de aceitação de uma mudança de balanceamento: a mediana melhora e o pior caso não piora em todos os KPIs com alvo.
- **Referência sem alvo:** compras de caminhão comparadas à frota da calculadora; não decidem aceitação.

<!-- escala:20 início -->
## Escala 20

`npm run economy:proof -- --days=20 --window=10 --seeds=0,1 --scale=20 --write-doc` (uma semente por processo, juntadas com `--from`). Código `6f2774b`; temporada `c28047496501`. 2 sementes, janela dos últimos 10 dias de 20. Simulação: 50,3 [49,3–51,4] s por dia de jogo por semente.

### KPIs de mundo

| KPI | Alvo | Mediana [mín–máx] | Mediana | Pior caso |
| --- | --- | ---: | --- | --- |
| Dinheiro conservado (diferença em centavos) | 0 | 0 [0–0] | dentro | dentro |
| Empresas-bot quebradas ou suspensas | 0 | 0 [0–0] | dentro | dentro |
| Procura atendida pelas lojas | ≥ 55% | 51% [51%–52%] | fora | fora |
| Aço entregue ao governo (t/dia) | ≥ 256 (80% de 320) | 177,2 [166,8–187,5] | fora | fora |
| Produtos vendidos com estoque fora de 1–7 dias | 0 | 5.5 [5–6] | fora | fora |
| Produtos com HHI ≥ 2.500 no atacado | 0 | 2 [2–2] | fora | fora |
| Receitas com utilização fora de 70–95% | 0 | 1.5 [1–2] | fora | fora |
| Receitas com lucro/linha ÷ projeto fora de 0,8–1,2 | 0 | 11.5 [11–12] | fora | fora |
| Caminhões pesados comprados por dia | referência 16, sem alvo | 11,4 [11,2–11,6] | — | — |
| Caminhões leves comprados por dia | referência 4, sem alvo | 4,1 [3,7–4,5] | — | — |
| Caminhões importados por dia | sem alvo | 2,65 [2,4–2,9] | — | — |
| Caminhões aposentados por dia | sem alvo | 21,65 [20,8–22,5] | — | — |

Quebras por semente: 0: nenhuma; 1: nenhuma.

### Por negócio

Linhas instaladas: equipamento das unidades da especialidade. Linhas de referência: calculadora × escala. Linhas observadas: produção ÷ uma linha a plena capacidade. Utilização: linhas-dia usadas ÷ instaladas (alvo 70–95%). Resultado dos bots: R$/dia da especialidade (fórmula no topo). Lucro/linha: resultado ÷ linhas instaladas, comparado ao lucro de projeto da calculadora (alvo 0,8–1,2). Preço realizado: vendas no atacado dos produtores ÷ preço de referência.

| Negócio | Linhas instaladas | Linhas na referência | Linhas observadas | Utilização | Resultado dos bots/dia (R$) | Lucro/linha/dia (R$) | Projeto/linha/dia (R$) | Observado ÷ projeto | Preço realizado ÷ referência |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Extração de minério | 46 [46–46] | 53,8 | 34,2 [33,4–35] | 74% [73%–76%] | 180.151 [178.148–182.153] | 3.916 [3.873–3.960] | 3.268 | 1,2 [1,18–1,21] | 1,01 [1,01–1,01] |
| Extração de carvão | 41 [41–41] | 51,2 | 32 [31,9–32,1] | 78% [78%–78%] | 231.508 [229.626–233.391] | 5.647 [5.601–5.692] | 4.245 | 1,33 [1,32–1,34] | 1 [1–1] |
| Aço em alto-forno (com aço reciclado) | 81 [81–81] | 100,9 | 63,6 [63–64,1] | 89% [88%–89%] | 913.717 [898.806–928.627] | 11.280 [11.096–11.465] | 5.437 | 2,07 [2,04–2,11] | 1,11 [1,1–1,11] |
| Utensílios de aço | 99 [99–99] | 124,2 | 91,5 [90,7–92,4] | 92% [92%–93%] | 310.512 [300.438–320.585] | 3.136 [3.035–3.238] | 1.110 | 2,83 [2,73–2,92] | 1,05 [1,05–1,06] |
| Montagem de caminhão pesado | 13 [13–13] | 16 | 10,1 [9,9–10,2] | 77% [76%–78%] | 93.339 [88.822–97.857] | 7.180 [6.832–7.527] | 6.893 | 1,04 [0,99–1,09] | 0,94 [0,94–0,95] |
| Montagem de caminhão leve | 2 [2–2] | 2 | 1,4 [1,3–1,4] | 68% [65%–70%] | 807 [45–1.568] | 403 [23–784] | 6.704 | 0,06 [0–0,12] | 0,94 [0,94–0,94] |
| Colheita de soja | 77 [77–77] | 95,4 | 60,8 [60–61,6] | 79% [78%–80%] | 604.569 [604.049–605.088] | 7.852 [7.845–7.858] | 5.796 | 1,35 [1,35–1,36] | 0,96 [0,96–0,96] |
| Esmagamento de soja | 49 [49–49] | 59,6 | 42,8 [42,5–43] | 87% [87%–88%] | 263.310 [251.578–275.042] | 5.374 [5.134–5.613] | 613 | 8,77 [8,38–9,16] | 1,23 [1,2–1,26] |
| Fábrica de ração | 36 [36–36] | 45,2 | 32,1 [32–32,2] | 89% [89%–89%] | 135.867 [131.498–140.236] | 3.774 [3.653–3.895] | 2.273 | 1,66 [1,61–1,71] | 1,07 [1,07–1,07] |
| Ordenha | 254 [254–254] | 318 | 216,2 [214,6–217,8] | 85% [84%–86%] | 2.879.681 [2.877.816–2.881.546] | 11.337 [11.330–11.345] | 8.264 | 1,37 [1,37–1,37] | 1,04 [1,04–1,04] |
| Colheita de arroz | 143 [143–143] | 178,9 | 114,4 [114,4–114,4] | 80% [80%–80%] | 183.482 [180.626–186.339] | 1.283 [1.263–1.303] | 872 | 1,47 [1,45–1,49] | 0,94 [0,93–0,94] |
| Colheita de feijão | 215 [215–215] | 268,3 | 193,5 [193,5–193,5] | 90% [90%–90%] | 403.133 [393.400–412.867] | 1.875 [1.830–1.920] | 757 | 2,48 [2,42–2,54] | 0,97 [0,96–0,97] |
| Colheita de cana e açúcar | 80 [80–80] | 99,4 | 80 [80–80] | 100% [100%–100%] | 110.815 [110.057–111.572] | 1.385 [1.376–1.395] | 752 | 1,84 [1,83–1,86] | 0,92 [0,92–0,92] |
| Lojas | — | — | — | — | 570.321 [555.300–585.342] | — | — | — | — |
| Distribuidores | — | — | — | — | 996.128 [975.637–1.016.619] | — | — | — | — |

### Procura atendida por produto

| Produto | Atendida |
| --- | ---: |
| Feijão 1 kg | 58% [58%–58%] |
| Leite 1 L | 49% [49%–50%] |
| Óleo de soja 1 L | 59% [57%–60%] |
| Arroz 5 kg | 58% [58%–58%] |
| Açúcar 5 kg | 57% [56%–57%] |
| Utensílios de aço (kit) | 54% [54%–54%] |

### Estoque e concentração

Dias de estoque: quanto o estoque do mundo dura no ritmo de vendas da janela (alvo 1–7). HHI: concentração das vendas no atacado por vendedor (2.500 ou mais é concentrado; 10.000 é um vendedor só).

| Produto | Dias de estoque | HHI |
| --- | ---: | ---: |
| Feijão 1 kg | 0,8 [0,7–0,9] | 449 [443–455] |
| Carvão mineral | 3,5 [3,5–3,5] | 466 [453–478] |
| Ração para gado | 1,2 [1,1–1,3] | 164 [161–167] |
| Minério de ferro | 3,9 [3,8–4] | 387 [369–405] |
| Leite 1 L | 0,6 [0,6–0,7] | 376 [372–381] |
| Óleo de soja 1 L | 2,2 [2,2–2,2] | 423 [400–445] |
| Arroz 5 kg | 0,9 [0,7–1] | 1.051 [972–1.130] |
| Sucata de aço | 1,7 [1,3–2,1] | 2.724 [2.722–2.725] |
| Soja em grão | 1,7 [1,6–1,8] | 382 [379–384] |
| Farelo de soja | 1,2 [1,1–1,3] | 363 [341–384] |
| Aço em barras | 1,9 [1,8–2] | 163 [158–169] |
| Açúcar 5 kg | 1,5 [1–2,1] | 502 [326–679] |
| Caminhão pesado 30 t | 0 [0–0] | 788 [785–792] |
| Caminhão leve 8 t | 0 [0–0] | 5.058 [5.007–5.109] |
| Utensílios de aço (kit) | 0,9 [0,8–1] | 213 [210–216] |
<!-- escala:20 fim -->
