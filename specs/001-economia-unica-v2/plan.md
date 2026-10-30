# Plan 001 · como matar o v1 sem mudar a economia

## Abordagem

Refatoração em cinco passos, cada um com `npm test` verde ao final. A régua de R8 (prova antes/depois com a mesma semente) é gerada **antes** de tocar em qualquer coisa e comparada ao fim de cada passo que mexe no motor. Se um passo mudar números, o passo está errado (ou revelou um bug v1 que afetava v2 — registrar e decidir).

### Passo 0 · Régua

- Rodar `economy-proof --days=20 --window=10 --seeds=0 --scale=1 --out=test-results/spec-001-before.json`.
- Rodar também na escala 20 por 5 dias (`--days=5 --window=3`) para pegar caminhos que só existem com `opening-v2`.

### Passo 1 · Inverter o padrão (menor mudança, maior cobertura)

- `seed.ts`: `createWorld(now, { scale })` sempre monta a economia 2 (`v2SeasonConfig`, `prepareV2Fleet`, estoques declarados). Remover os ramos `options.economy === 2 ? … : …` deixando só o lado v2.
- `scenarios.ts`: `ScenarioName = 'baseline' | 'playtest'`; `baseline` = `createWorld` puro; `playtest` = `baseline` + `leanStart`. Remover `starter`/`low-demand`.
- `apps/server/src/index.ts`: enum do cenário, `requireRoadRoutes` sem exceção por nome (decidir: manter rota obrigatória só quando `scale === 1`; registrar no plan como decisão técnica reversível).
- `scripts/starter.ts` → apagar; `package.json`: remover `dev:v2`, `dev:starter`; `dev` lê `AFTERMARKET_WORLD_SCALE`.
- Rodar a suíte: a maior parte dos testes que usavam `createWorld()` passa a rodar na economia 2. Os que quebram entram na lista do passo 4.

### Passo 2 · Remover as flags

- `calibration.ts`: `economyVersion` sai de `SeasonConfig`; `wholesalePrices` vira campo obrigatório (`Record<ProductId, number>`), sempre preenchido por `v2SeasonConfig`.
- Em `engine.ts` (11 pontos), `supply.ts` (6), `director.ts` (5), `opening-v2.ts` (4), `operations.ts` (2), `metrics.ts`, `design.ts`, `competition.ts`: para cada `economyVersion ? A : B` ou `wholesalePrices ? A : B`, manter **A** e apagar B. Fazer um arquivo por commit, com `npm test` entre eles.
- Web: `TruckPurchase.tsx:38`, `VehicleDetails.tsx:20`, `CarrierPage.tsx:38`, `BusinessIdeas.tsx:40`: remover a condicional, manter o ramo v2.
- `devlab/LabParameters.tsx`: remover o seletor de versão.

### Passo 3 · Remover os dados v1

- `model.ts`: apagar `LegacyProductId`, `legacyProducts`, `newProductIds`, as `recipes` v1 (`:575-620`) e `seasonProducts` se ficar trivial; `ProductId` e `products` passam a derivar de `catalog.ts` (`designItems`). Cuidado: a ordem de iteração de `products` influencia desempates (`localeCompare` em alguns pontos) — conferir com a régua.
- `operations.ts:268-324` (`expansionRecipes`) → apagar junto com a expansão v1 de bots em `engine.ts:2239-2334`.
- `calibration.ts`: `legacyPriceReferences` só sobrevive se o catálogo não cobrir a fonte; mover a referência de preço para `catalog.ts` onde faltar.
- `migrate.ts`: ramo `version === 1` vira `throw new Error('Mundo da economia 1 não é mais suportado…')`; `needsMigration` mantém a completude de campos da v2.
- `scripts/lib/mechanics-gaps.ts`, `report-mechanics.ts`, `audit-mathematics.ts`: remover referências v1; se um script só fazia sentido para v1 (auditoria M01–M07 sobre receitas antigas), apagar e registrar.

### Passo 4 · Testes

- Para cada arquivo de teste quebrado, decidir: (a) adaptar ao mundo v2 (preferido: trocar ids de estabelecimento/produto por equivalentes v2 e manter o invariante), (b) apagar se provava uma regra v1 inexistente. Registrar em `tasks.md` a decisão por arquivo, com o invariante que continua coberto por outro teste.
- Testes `economy-v2*.test.ts` perdem o sufixo e viram os testes principais.
- `tests/e2e/*.spec.ts`: fixtures que chamavam `createWorld()` passam a receber `playtest` em escala 1.

### Passo 5 · Documentação e fechamento

- README, `.planning/STATE.md`, `CLAUDE.md`, `AGENTS.md`, `docs/product/ECONOMIA-HOJE.md`, `ECONOMIA-ALVO.md` ("ainda não está no motor" → está): uma economia, comandos novos.
- `docs/product/DECISIONS.md`: D-042 já registrada; anexar o resultado de A3 e A6.
- `specs/README.md`: estado **verificada** com evidência.

## Arquivos tocados (estimativa)

`packages/simulation/src/{seed,scenarios,calibration,engine,supply,director,opening-v2,operations,metrics,design,competition,migrate,model,economy-v2}.ts`; `apps/server/src/index.ts`; `apps/web/src/{components/TruckPurchase,components/VehicleDetails,pages/CarrierPage,features/economy/BusinessIdeas,devlab/LabParameters}.tsx`; `scripts/{starter,economy-proof,report-mechanics,audit-mathematics,audit-resources,lib/mechanics-gaps}.ts`; `tests/**` (25 arquivos); `package.json`; docs.

## Riscos

- **Ordem de produtos e desempates**: derivar `products` do catálogo pode mudar a ordem de iteração e, com ela, alocações que usam `localeCompare` ou "primeiro da lista". A régua (A3) pega isso; se acontecer, fixar a ordem explicitamente com a sequência antiga.
- **Testes v1 escondem invariantes úteis** (ex.: `formula-fixes.test.ts` prova M02–M07). Reescrever sobre receitas v2 antes de apagar.
- **`requireRoadRoutes`**: hoje o mundo v2 não exige rota real porque 500 bots travariam no OSRM público. Até a spec de roteador próprio, manter a exceção por escala (`scale > 1` → estimativa), não por nome de cenário.
- **Tamanho do passo 4**: é onde o tempo vai. Se passar de 2 dias, fechar a spec com os testes adaptados e abrir uma 001b para o resto, sem deixar testes desligados (`skip`) no `main`.

## Decisões técnicas reversíveis tomadas aqui

1. Cenário `playtest` substitui `economy-2`; `baseline` passa a ser v2 sem começo enxuto.
2. Rota real obrigatória só na escala 1 (comportamento atual preservado por outro critério).
3. `products` deriva de `catalog.ts`; `model.ts` deixa de ser fonte de itens.
