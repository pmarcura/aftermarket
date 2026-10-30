# Tasks 001 · Economia única

Marcar `[x]` só com evidência (comando + resultado) na coluna da direita. Um commit por tarefa ou por arquivo, prefixo `spec-001:`.

## Passo 0 · Régua

- [ ] T0.1 Gerar `test-results/spec-001-before.json` (escala 1, 20 dias, semente 0) e `spec-001-before-s20.json` (escala 20, 5 dias, janela 3). — A3

## Passo 1 · Inverter o padrão

- [ ] T1.1 `seed.ts`: `createWorld(now, { scale })` só economia 2; apagar ramos `economy === 2`. — R1
- [ ] T1.2 `scenarios.ts`: `baseline` | `playtest`; remover `starter`, `low-demand`, `economy-2`. — R2
- [ ] T1.3 `apps/server/src/index.ts`: enum de cenário; `requireRoadRoutes: scale === 1`. — R7
- [ ] T1.4 `package.json`: remover `dev:v2`, `dev:starter`; apagar `scripts/starter.ts`; `.claude/launch.json` se referenciar. — R7
- [ ] T1.5 `npm test`: listar os arquivos que quebram (vão para o passo 4). — R5

## Passo 2 · Remover as flags (um commit por arquivo, `npm test` entre eles)

- [ ] T2.1 `calibration.ts`: sem `economyVersion`; `wholesalePrices` obrigatório. — R3
- [ ] T2.2 `engine.ts` (11 pontos). — R4
- [ ] T2.3 `supply.ts` (6). — R4
- [ ] T2.4 `director.ts` (5). — R4
- [ ] T2.5 `opening-v2.ts` (4). — R4
- [ ] T2.6 `operations.ts`, `metrics.ts`, `design.ts`, `competition.ts`, `economy-v2.ts`. — R4
- [ ] T2.7 Web: `TruckPurchase`, `VehicleDetails`, `CarrierPage`, `BusinessIdeas`, `LabParameters`. — R4
- [ ] T2.8 Régua A3 após o passo 2: diff ≤ 0,5%. — R8

## Passo 3 · Remover os dados v1

- [ ] T3.1 `model.ts`: `ProductId`/`products` derivados de `catalog.ts`; apagar `legacyProducts`, `LegacyProductId`, `newProductIds`, `recipes` v1. Fixar ordem se a régua mudar. — R3
- [ ] T3.2 `operations.ts`: apagar `expansionRecipes`; `engine.ts`: apagar expansão v1 de bots. — R3, R4
- [ ] T3.3 `calibration.ts`: `legacyPriceReferences` → catálogo. — R3
- [ ] T3.4 `migrate.ts`: recusa v1 com mensagem; `store.ts` não faz backup nem converte nesse caso. — R6, A5
- [ ] T3.5 Scripts: `mechanics-gaps`, `report-mechanics`, `audit-mathematics`, `audit-resources`, `economy-proof` sem v1; apagar os que só faziam sentido para v1 (listar). — R4
- [ ] T3.6 Régua A3 após o passo 3. — R8

## Passo 4 · Testes (uma linha por arquivo: adaptado | apagado + invariante que continua coberto)

- [ ] T4.1 `tests/economy.test.ts` —
- [ ] T4.2 `tests/operations.test.ts` —
- [ ] T4.3 `tests/resources.test.ts` —
- [ ] T4.4 `tests/season.test.ts` —
- [ ] T4.5 `tests/decision-trace.test.ts` —
- [ ] T4.6 `tests/transport.test.ts` —
- [ ] T4.7 `tests/routing.test.ts` —
- [ ] T4.8 `tests/competition.test.ts` —
- [ ] T4.9 `tests/formula-fixes.test.ts` (reescrever M02–M07 sobre receitas v2 antes de apagar) —
- [ ] T4.10 `tests/catalog.test.ts` —
- [ ] T4.11 `tests/lean-start.test.ts`, `migration.test.ts`, `world-view.test.ts`, `road-access.test.ts`, `design.test.ts` —
- [ ] T4.12 `tests/economy-v2*.test.ts` → renomear sem sufixo. —
- [ ] T4.13 `tests/e2e/*.spec.ts`: fixtures com `playtest` escala 1. —
- [ ] T4.14 Contagem final de testes ≥ 200 e `npm run check` verde. — A2

## Passo 5 · Fechamento

- [ ] T5.1 Docs: README, STATE, CLAUDE.md, AGENTS.md, ECONOMIA-HOJE, ECONOMIA-ALVO. — R7
- [ ] T5.2 A1 (grep zero), A4 (servidor sobe em `.runtime` vazio + `opening.spec.ts` em Chromium), A6 (linhas). —
- [ ] T5.3 `specs/README.md` → verificada; evidência anexada abaixo.

## Evidência

(preencher)
