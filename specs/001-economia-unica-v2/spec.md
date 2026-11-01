# Spec 001 · Economia única: fim do mundo v1

Estado: **aprovada** (John, 30/10/2026 · D-042). Semana 1. Branch `spec/001-economia-unica-v2`.

## Problema

O motor mantém duas economias vivas. A "versão 1" (dez regiões, nove produtos, bots que expandem comprando lotes, aço só para o governo, farelo sem destino) é o cenário **padrão** de `createWorld()`, de `createScenario('baseline')`, do servidor sem `AFTERMARKET_SCENARIO` e de ~100 chamadas em 25 arquivos de teste. A "versão 2" (catálogo com 20 itens e 14 receitas, 59 municípios, ~500 bots, começo enxuto) é o mundo que vai ao playtest, mas vive atrás de `options.economy === 2`, `season.config.economyVersion` e `wholesalePrices` como flag implícita, em 22 arquivos. Toda regra nova nasce bifurcada, metade dos testes prova uma economia que não existe mais e a auditoria estima ~20% das ramificações do motor nesse caminho morto.

## Requisitos

- **R1** Existe uma única economia. `createWorld(now, { scale })` cria sempre o mundo da economia 2; a opção `economy` deixa de existir.
- **R2** Os cenários passam a ser `baseline` (= economia 2, escala 1, sem começo enxuto, para testes) e `playtest` (= economia 2, escala configurável, começo enxuto, antes `economy-2`). `starter` e `low-demand` são removidos; a variação de demanda vira opção do laboratório (`demand`), que já existe.
- **R3** Não existe mais `economyVersion`, `wholesalePrices` como flag, `legacyProducts`, `LegacyProductId`, `expansionRecipes`, nem as receitas v1 de `model.ts`. O catálogo de `catalog.ts` é a única fonte de itens e receitas; `products`/`ProductId` derivam dele.
- **R4** Todo código condicionado a v1 é removido, não comentado: engine, supply, director, opening-v2, calibration, operations, metrics, design, competition, migrate, scripts e os quatro pontos da web (`TruckPurchase`, `VehicleDetails`, `CarrierPage`, `BusinessIdeas`).
- **R5** A suíte de testes continua provando o mesmo conjunto de invariantes (conservação, comandos, reservas, transporte, recuperação, migração, rotas, catálogo, lab) sobre mundos da economia 2. Testes que só existiam para provar regras v1 (fórmulas M01–M07 sobre receitas antigas, cenário `starter`, expansão de bots comprando lotes) são removidos com justificativa no `tasks.md`.
- **R6** Mundos salvos v1 não são migrados: `migrateWorld` recusa com mensagem clara ("Mundo da economia 1 não é mais suportado; use um mundo novo"), sem tocar no arquivo. O mundo principal do Pedro (`.runtime/world.sqlite`) é arquivado pelo dono, fora do Git; nada no repositório o apaga.
- **R7** `npm run dev` abre o mundo `playtest` na escala definida por `AFTERMARKET_WORLD_SCALE` (padrão 1) em `.runtime/world.sqlite`; `npm run dev:v2` e `npm run dev:starter` deixam de existir. Documentação (README, STATE, CLAUDE.md, AGENTS.md, ECONOMIA-HOJE) deixa de mencionar duas economias.
- **R8** Nada de balanceamento muda nesta spec: a prova `economy-proof` com os mesmos parâmetros produz os mesmos números (mesma semente, mesma escala) antes e depois, dentro de ±0,5% por métrica. Esta spec é refatoração.

## Critérios de aceite

- **A1** `grep -rnE "economyVersion|wholesalePrices\?|legacyProducts|LegacyProductId|expansionRecipes|economy: ?[12]|'economy-2'|'starter'|'low-demand'" packages apps scripts tests` devolve zero linhas (exceto a mensagem de recusa em `migrate.ts` e o changelog).
- **A2** `npm run check` verde. Número de testes ≥ 200 (hoje 230; a diferença é justificada tarefa a tarefa).
- **A3** `npx tsx scripts/economy-proof.ts --days=20 --window=10 --seeds=0 --scale=1` antes e depois: `moneyDrift = 0` e todas as métricas de `coverage`, `lines`, `margins` iguais dentro de ±0,5%. O JSON "antes" fica em `test-results/spec-001-before.json` (não versionado) e o diff anexado ao `tasks.md`.
- **A4** Servidor sobe com `npm run dev` num `.runtime` vazio e cria um mundo `playtest`; `GET /api/world` responde; o guia de primeiros passos aparece (o e2e `opening.spec.ts` passa em Chromium).
- **A5** `migrateWorld` de um snapshot `version: 1` lança a mensagem de R6; `store.ts` não cria backup nem converte nesse caso.
- **A6** `wc -l packages/simulation/src/{engine,supply,director,model,seed,calibration}.ts` cai em pelo menos 400 linhas no total.

## Fora de escopo

Mudar qualquer número de balanceamento; extrair constantes para a temporada (spec 006); quebrar `engine.ts` em módulos (depois da 005); tocar na interface além dos quatro pontos de R4.
