# Validação 013

## A1 · Economia idêntica (04/11/2026)

`economy:proof --days=20 --window=10 --seeds=0,1`: código de `4d4b941` (worktree limpo) × código
com a 013. Vendas, aço ao governo, caminhões, quebras e dinheiro idênticos nas duas sementes.
Única diferença no JSON fora do tempo de execução: `margins.retail` da semente 0, 1.973.159,66 →
1.973.166,86 (7,2 centavos por dia de jogo na margem medida das lojas).

## A2–A4 · Testes

`tests/daily-costs.test.ts` (uma linha por dia; saldo = extrato; regravação e reabertura iguais) e
`tests/idle-pause.test.ts` (para, não pula o tempo parado, reabre; sem a opção nunca para).
Bateria inteira: 40 arquivos, 277 testes.

## A5 · Linhas por dia

Playtest escala 20, semente 0, 584 estabelecimentos, média dos dias 2–3:

| Natureza                          | Antes      | Depois            |
| --------------------------------- | ---------- | ----------------- |
| Salários                          | 7.541      | 1.788             |
| Energia                           | 7.523      | 1.770             |
| Água                              | 7.523      | 1.770             |
| Varejo                            | 6.313      | 528               |
| Manutenção                        | 6.276      | 523               |
| Demais (produção, pregão, frete…) | 4.983      | 4.984             |
| **Total**                         | **40.159** | **11.363 (−72%)** |

O que sobra são eventos reais entre empresas e da produção. Salários, energia e água restantes
vêm do motorista do frete e do consumo de cada lote produzido.

## A6 · Linha de base do clique (`npm run perf:click`)

Mundo de referência: playtest escala 20, 7 dias de jogo, 86 MB, 117.968 linhas de extrato,
584 estabelecimentos. 56 cliques reais (preço, regra de reposição e compra), 15 s reais entre
eles. Tempos em ms.

| Etapa                            | SSD (C:, NVMe) p50 / p95 | HD (D:, SATA 7.200 rpm) p50 / p95 |
| -------------------------------- | ------------------------ | --------------------------------- |
| Cópia para desfazer              | 77 / 87                  | 78 / 121                          |
| Avanço do tempo (rodada no meio) | 4 / 255                  | 4 / 323                           |
| Regra do jogo                    | 0 / 0                    | 0 / 1                             |
| **Gravação**                     | **179 / 290**            | **1.373 / 2.451**                 |
| Resposta (vista)                 | 26 / 33                  | 31 / 49                           |
| **Total**                        | **289 / 644**            | **1.501 / 2.815**                 |
| Gravação automática (a cada 5 s) | 272 (p95)                | 2.220 (p95)                       |

Leitura: a gravação do mundo inteiro é a maior parte do clique, e no HD fica 8× mais lenta. O
diário (spec 014) troca essa etapa por uma linha pequena. A rodada econômica (~0,3 s) entra no
clique quando cai no meio dele; a spec 015 tira isso da fila dos cliques.

O mundo `design-b` (2,5 GB, extrato antigo de antes desta spec) é muito pior: 1–40 s por clique
no HD. Um mundo de design novo começa com as regras desta spec.
