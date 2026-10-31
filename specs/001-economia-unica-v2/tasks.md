# Tasks 001 · Economia única

Marcar `[x]` só com evidência (comando + resultado) na coluna da direita. Um commit por tarefa ou por arquivo, prefixo `spec-001:`.

Régua usada em todas as linhas abaixo: `economy-proof` comparado a `test-results/spec-001-before*.json` em `moneyDrift`, `coverageAll`, `governmentSteelPerDay`, `coverage.*`, `lines.*.observed` e `margins.*` (38 métricas, tolerância 0,5%).

## Passo 0 · Régua

- [x] T0.1 Gerar `test-results/spec-001-before.json` (escala 1, 20 dias, semente 0) e `spec-001-before-s20.json` (escala 20, 5 dias, janela 3). — A3 · gerados em `96bed98` antes do primeiro commit; `moneyDrift = 0` nos dois.

## Passo 1 · Inverter o padrão

- [x] T1.1 `seed.ts`: `createWorld(now, { scale })` só economia 2; apagar ramos `economy === 2`. — R1 · `674c9bf`; régua `spec-001-step1.json`: 38 métricas, diferença 0.
- [x] T1.2 `scenarios.ts`: `baseline` | `playtest`; remover `starter`, `low-demand`, `economy-2`. — R2 · `7dacddb`.
- [x] T1.3 `apps/server/src/index.ts`: enum de cenário; `requireRoadRoutes: scale === 1`. — R7 · `c0ebd27`.
- [x] T1.4 `package.json`: remover `dev:v2`, `dev:starter`; apagar `scripts/starter.ts`; `.claude/launch.json` se referenciar. — R7 · `b5658c0` (`.claude/` fica fora do Git).
- [x] T1.5 `npm test`: listar os arquivos que quebram (vão para o passo 4). — R5 · a lista virou T4.1–T4.13; cada arquivo tem seu commit abaixo.

## Passo 2 · Remover as flags (um commit por arquivo, `npm test` entre eles)

- [x] T2.1 `calibration.ts`: sem `economyVersion`; `wholesalePrices` obrigatório. — R3 · `5caa28e`.
- [x] T2.2 `engine.ts` (11 pontos). — R4 · `e1b5698`.
- [x] T2.3 `supply.ts` (6). — R4 · `b7d0726`.
- [x] T2.4 `director.ts` (5). — R4 · `f617d3e`.
- [x] T2.5 `opening-v2.ts` (4). — R4 · `b6fd8fc`.
- [x] T2.6 `operations.ts`, `metrics.ts`, `design.ts`, `competition.ts`, `economy-v2.ts`. — R4 · `aa30ae7`.
- [x] T2.7 Web: `TruckPurchase`, `VehicleDetails`, `CarrierPage`, `BusinessIdeas`, `LabParameters`. — R4 · `73ff7f4`.
- [x] T2.8 Régua A3 após o passo 2: diff ≤ 0,5%. — R8 · `spec-001-step2.json` e `spec-001-step2-s20.json`: 38 métricas, diferença 0 nas duas escalas.

## Passo 3 · Remover os dados v1

- [x] T3.1 `model.ts`: `ProductId`/`products` derivados de `catalog.ts`; apagar `legacyProducts`, `LegacyProductId`, `newProductIds`, `recipes` v1. Fixar ordem se a régua mudar. — R3 · `4fe6f84` (`productIds` fixa a ordem antiga de iteração).
- [x] T3.2 `operations.ts`: apagar `expansionRecipes`; `engine.ts`: apagar expansão v1 de bots. — R3, R4 · `7409899` e `e1b5698`.
- [x] T3.3 `calibration.ts`: `legacyPriceReferences` → catálogo. — R3 · `07c83ca`.
- [x] T3.4 `migrate.ts`: recusa v1 com mensagem; `store.ts` não faz backup nem converte nesse caso. — R6, A5 · `bba4764`.
- [x] T3.5 Scripts: `mechanics-gaps`, `report-mechanics`, `audit-mathematics`, `audit-resources`, `economy-proof` sem v1; apagar os que só faziam sentido para v1 (listar). — R4 · `655c09a` (auditoria de recursos sobre o catálogo), `a3b3f58` (apagado `scripts/audit-mathematics.ts` e seu relatório: reproduzia M01–M07 sobre receitas v1), `61132f9` (`economy-proof` lê `wholesalePrices` sem `?.`).
- [x] T3.6 Régua A3 após o passo 3. — R8 · `spec-001-step3.json` e `spec-001-step3-s20.json`: 38 métricas, diferença 0.

## Passo 4 · Testes (uma linha por arquivo: adaptado | apagado + invariante que continua coberto)

- [x] T4.1 `tests/economy.test.ts` — adaptado, `82e5287`: mesmos 15 casos.
- [x] T4.2 `tests/operations.test.ts` — adaptado, `08ebbd2`: mesmos 13 casos.
- [x] T4.3 `tests/resources.test.ts` — adaptado, `3305a44`: mesmos 53 casos. Admissão sobre 20 itens/14 receitas; semente medida em `soySeed`/`riceSeed`; linha que não cobre fixos provada com arroz a R$ 0,01 (nenhuma receita da temporada dá negativo); pressão de coproduto vazia na temporada (farelo → ração → leite) e provada com procura hipotética de ração; produção e venda roda a reciclagem na siderúrgica e usa ciclos suficientes para cada saída render uma unidade inteira de comércio.
- [x] T4.4 `tests/season.test.ts` — adaptado, `a96b28a`: congelamento provado no catálogo em memória; prova de migração v1 virou A5 (recusa).
- [x] T4.5 `tests/decision-trace.test.ts` — adaptado, `b145ed3`: prova também a espera de meio dia sem fornecedor.
- [x] T4.6 `tests/transport.test.ts` — sem mudança: os 5 casos passam no mundo da economia 2.
- [x] T4.7 `tests/routing.test.ts` — adaptado, `1c8a75b`: mesmos 15 casos sobre o par Americana→Piracicaba.
- [x] T4.8 `tests/competition.test.ts` — adaptado, `a867371`: mesmos 22 casos sobre a abertura da economia 2.
- [x] T4.9 `tests/formula-fixes.test.ts` (reescrever M02–M07 sobre receitas v2 antes de apagar) — adaptado, `96b5bd5`: M03 (previsão = execução, 10 ciclos/dia), M04 (inalterado), M05 (vendido = capacidade da loja calculada pelo motor), M07 (estoque entre a meta repartida e a inteira, pela fórmula atual). M02 voltou como teste (saiu com o auditor de T3.5): recuperação da leiteria respeita o teto de ciclos por dia. 4 → 5 casos.
- [x] T4.10 `tests/catalog.test.ts` — adaptado, `a96b28a`: os 20 itens batem com o catálogo.
- [x] T4.11 `tests/lean-start.test.ts`, `migration.test.ts`, `world-view.test.ts`, `road-access.test.ts`, `design.test.ts` — adaptados em `ffe39c6`, `a96b28a`, `2ea4aca`, `5c342b2`; `road-access` sem mudança. Apagado em `design.test.ts` o caso "cenários isolados conservam moeda", que provava `starter`/`low-demand`: a conservação do começo enxuto segue em `lean-start.test.ts` e a variação de procura em `lab.test.ts` (opção `demand`).
- [x] T4.12 `tests/economy-v2*.test.ts` → renomear sem sufixo. — `ffe39c6`: `economy-{config,bots,steel,chains}.test.ts`.
- [x] T4.13 `tests/e2e/*.spec.ts`: fixtures com `playtest` escala 1. — `e2c803a`, `d8efcfe`. `createWorld()` já devolve o mundo `baseline`; os e2e com mundo simulado continuam com ele (o `playtest` tira a fábrica do jogador, que esses testes usam), e os que falam com o servidor já recebem `playtest` (padrão de T1.3). Só dois ajustes: `opening.spec` compra um lote industrial gerado (`lot-industry-3550308-0`, o lote `newindustry` não existe mais) e `lab.spec` conta 20 itens. Chromium: 17 passam, 11 falham, todas já falhavam antes da 001 (ver Evidência).
- [x] T4.14 Contagem final de testes ≥ 200 e `npm run check` verde. — A2 · `npm run check`: build ok, 31 arquivos, **242 testes** passam, `resources:check` sem erros, `lab:catalog:check` ok depois de regenerar o catálogo de telas (`9bf5775`).

## Passo 5 · Fechamento

- [x] T5.1 Docs: README, STATE, CLAUDE.md, AGENTS.md, ECONOMIA-HOJE, ECONOMIA-ALVO. — R7 · `ca31f22`; D-042 em `DECISIONS.md` recebe A3 e A6.
- [x] T5.2 A1 (grep zero), A4 (servidor sobe em `.runtime` vazio + `opening.spec.ts` em Chromium), A6 (linhas). — ver Evidência.
- [x] T5.3 `specs/README.md` → verificada; evidência anexada abaixo.

## Pendente para 001b

1. `tests/e2e/business.spec.ts` e `design.spec.ts` ("servidor contrata rota curva") falham antes dos seletores antigos: usam ids que o mundo `playtest` não tem (`newindustry`; `ferrovale` → `e-industry` do jogador). Corrigir junto com os seletores, que já falhavam antes da 001.
2. Os outros e2e que já falhavam (`animation`, `design` "recuperação", `economic-flow`, `intelligence`, `procurement`, `transport` ×2) seguem como estavam: seletores antigos da interface. Necessário para o job e2e da CI ficar verde.

## Evidência

### A1 · nada da economia 1 no código

`grep -rnE "economyVersion|wholesalePrices\?|legacyProducts|LegacyProductId|expansionRecipes|economy: ?[12]|'economy-2'|'starter'|'low-demand'" packages apps scripts tests` → zero linhas (saída 1). A mensagem de recusa de `migrate.ts` não casa com o padrão.

### A2 · `npm run check`

Verde: `vite build` ok; `Test Files 31 passed (31)`, `Tests 242 passed (242)` (eram 230); `resources:check` com `"errors": []`; `lab:catalog:check` com 14 telas. Nenhum `skip`/`only` em `tests/*.ts`.

### A3 · régua antes × depois (HEAD final)

| Comparação                                                                 | Métricas | Fora de 0,5% | Maior diferença | `moneyDrift` |
| -------------------------------------------------------------------------- | -------: | -----------: | --------------: | ------------ |
| `spec-001-before.json` × `spec-001-after.json` (escala 1, 20 dias)         |       38 |            0 |               0 | 0 → 0        |
| `spec-001-before-s20.json` × `spec-001-after-s20.json` (escala 20, 5 dias) |       38 |            0 |               0 | 0 → 0        |

Comandos: `npx tsx scripts/economy-proof.ts --days=20 --window=10 --seeds=0 --scale=1 --out=test-results/spec-001-after.json` e `--days=5 --window=3 --seeds=0 --scale=20 --out=test-results/spec-001-after-s20.json`. As réguas intermediárias (`step1`, `step2`, `step2-s20`, `step3`, `step3a`, `step3-s20`) também dão diferença 0.

### A4 · servidor num banco vazio

`AFTERMARKET_DB_FILE=test-results/a4.sqlite AFTERMARKET_PORT=3021 npx tsx apps/server/src/index.ts`: `GET /api/health` → `{"ok":true,"mode":"local-development","version":"0.4.0"}`; `GET /api/world` com `x-company-id: player` → HTTP 200, temporada "Mundo jogável", 95 empresas, jogador só com `e-retail` e R$ 1.000.000. `opening.spec.ts` em Chromium: 3 de 3 passam.

### A5 · mundo da economia 1 recusado

`npx vitest run tests/migration.test.ts tests/season.test.ts -t "economia 1"` → 2 passam: `createStore` lança "Mundo da economia 1 não é mais suportado…", não cria `backups/` e o arquivo continua byte a byte igual; `migrateWorld` lança a mesma mensagem sem mexer no objeto.

### A6 · linhas do motor

`wc -l packages/simulation/src/{engine,supply,director,model,seed,calibration}.ts`: 5.264 em `96bed98` → 4.862 no fim (**−402**). engine 2.429 → 2.269, supply 692 → 673, director 781 → 767, model 719 → 595, seed 379 → 386, calibration 264 → 172.

### e2e em Chromium

O proxy desta máquina bloqueia `cdn.playwright.dev`; rodou com o Chromium pré-instalado (`/opt/pw-browsers`, `PLAYWRIGHT_BROWSERS_PATH` com links `chromium-1248 → chromium-1243`), `PLAYWRIGHT_CHANNEL=chromium` e banco do servidor de teste em `test-results/`. 28 testes. Rodada completa: 16 passam, 12 falham; depois de `d8efcfe`, `lab.spec` de novo: 3 de 5. Estado final: **17 passam, 11 falham**. Passam `landing` (7), `navigation` (2), `notifications` (2), `opening` (3), `lab` "A/B real", "cancelamento" e "consulta". Falham, todos já falhando antes da 001: `animation`, `business`, `design` ×2, `economic-flow`, `intelligence`, `procurement`, `transport` ×2 (seletores antigos, ver Pendente) e `lab` "catálogo" e "interfaces" (reproduzidos em `96bed98` no mesmo ambiente; a spec 002 apaga os dois). `lab` "A/B real" quebrou pela 001 (a tabela tem 20 itens, não 10) e foi corrigido em `d8efcfe`.
