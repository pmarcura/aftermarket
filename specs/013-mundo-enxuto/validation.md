# Validação 013

## A1 · Economia idêntica (04/11/2026)

`economy:proof --days=20 --window=10 --seeds=0,1` sobre o ramo já juntado com o `main` (specs 006
e 008): código sem a 013 (`cd7b541` + `origin/main`, worktree limpo) × código com a 013.
**JSON idêntico**, exceto o tempo de execução (`msPerDay`): 0 diferenças em vendas, aço,
caminhões, quebras, dinheiro, margens, receitas, estoque parado, concentração e cobertura.

Primeira tentativa (rodada da virada somada à linha do dia anterior) mudava o reajuste semanal de
salários (`updateWages` soma a folha com `at >= updatedAt`, a partir de uma virada) em ~0,001% e
por tabela 174 números minúsculos (maior: 0,05% na razão de lucro de utensílios). Correção: a
rodada exatamente na virada fica numa linha própria; a linha do dia soma as outras 11.

## A2–A4 · Testes

`tests/daily-costs.test.ts` (uma linha por dia; saldo = extrato; regravação e reabertura iguais) e
`tests/idle-pause.test.ts` (para, não pula o tempo parado, reabre; sem a opção nunca para).
Bateria inteira: 40 arquivos, 277 testes.

## A5 · Linhas por dia

Playtest escala 20, semente 0, 685 estabelecimentos (com a 006), média dos dias 2–3:

| Natureza                          | Antes      | Depois            |
| --------------------------------- | ---------- | ----------------- |
| Energia                           | 9.104      | 2.864             |
| Água                              | 9.104      | 2.864             |
| Salários                          | 8.898      | 2.658             |
| Manutenção                        | 7.488      | 1.248             |
| Varejo                            | 6.828      | 1.135             |
| Demais (produção, pregão, frete…) | 5.774      | 5.775             |
| **Total**                         | **47.196** | **16.544 (−65%)** |

Cada estabelecimento fica com 2 linhas por natureza e dia (a rodada da virada e a do resto do
dia). O que sobra são eventos reais entre empresas e da produção: salários, energia e água restantes
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
