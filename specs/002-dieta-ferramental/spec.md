# Spec 002 · Dieta de ferramental

Estado: **aprovada** (John, 30/10/2026). Semana 1, em paralelo com a 001. Branch `spec/002-dieta-ferramental`.

## Problema

O repositório carrega ferramentas construídas para gerar evidência para agentes de IA, não para a equipe nem para o jogador, e elas cobram imposto em todo ciclo: a cadeia `capture-lab.ts` (1.702 linhas) + `ui-catalog.ts` (AST do TypeScript) + `ui-flows.ts` + `visual-diff` + `lab-context` + aba _Interfaces_ do `/lab` está acoplada ao `npm run check` (`lab:catalog:check`), ao `vite.config.ts` (plugin `labArtifacts`) e a dois testes; `ui-catalog.test.ts` exige "exatamente 14 telas", então toda tela nova obriga a atualizar ~5 arquivos. Os testes de navegador rodam em Edge por padrão e dependem de tiles externos (só `opening.spec.ts` intercepta). A CI usa Node 24 com `engines >= 22.13`, não roda e2e, não constrói imagem. O stack está em versões de ponta sem travar (TypeScript 7, Vite 8, Express 5, React 19.3, Vitest 4), e há arquivos mortos na web.

## Requisitos

- **R1** `npm run check` = build + testes unitários + `resources:check`. `lab:catalog:check` sai do `check`.
- **R2** A cadeia de evidência de interface (`scripts/capture-lab.ts`, `scripts/ui-catalog.ts`, `scripts/lab-context.ts`, `scripts/refresh-lab.ts`, `scripts/lab-study.ts`, `scripts/lib/visual-diff.ts`, `scripts/lib/lab-fingerprint.ts`, `scripts/lab-artifacts.ts`, `apps/web/src/devlab/{ui-flows,ui-evidence,screens}.ts`, `LabInterfaceFlows.tsx`, `LabInspection.tsx`, `LabStudyEvidence.tsx`, `LabJournal.tsx`, `tests/ui-catalog.test.ts`, `tests/ui-flows.test.ts`, `docs/design/UI-CATALOG.json`) é **removida do repositório** (o histórico Git a preserva; não criar pasta `legacy`). O `/lab` mantém só _Simulações_ (worker, A/B, telemetria, JSON) e `scripts/{lab-batch,lab-benchmark,start-lab,economy-proof,economy-design,audit-resources,audit-mathematics,report-mechanics}.ts`.
- **R3** `vite.config.ts` sem o plugin `labArtifacts`; `package.json` sem `lab:catalog*`, `lab:capture`, `lab:query`, `lab:context`, `lab:refresh`, `lab:watch`, `lab:study`, `test:lab` se depender do removido (verificar), `capture:ui`, `landing:telas` (manter se for só screenshot da landing; decidir no plan).
- **R4** Playwright: `channel` padrão Chromium (`npx playwright install chromium` documentado); Edge só com `PLAYWRIGHT_CHANNEL=msedge`. Todos os specs interceptam tiles do OpenFreeMap e o roteador como `opening.spec.ts` faz (fixture compartilhada em `tests/e2e/fixtures.ts`).
- **R5** CI: Node 22 LTS (igual ao `engines`), `npm ci`, `format:check`, `check`, e um job `e2e` que instala Chromium e roda `test:e2e` (pode ser `continue-on-error: false`; se o tempo passar de 15 min, dividir).
- **R6** Versões travadas: `package.json` sem `^` nas dependências de runtime e de build (`typescript`, `vite`, `vitest`, `@playwright/test`, `react`, `react-dom`, `express`, `zod`, `maplibre-gl`, `echarts`, `@vitejs/plugin-react`, `tsx`); `package-lock.json` regenerado; `.nvmrc` com `22`.
- **R7** Arquivos mortos removidos: `apps/web/src/features/business/{Orders,InfrastructureContracts,OrderLogistics,SalesCatalog}.tsx`, `apps/web/src/components/BotActivity.tsx` (o dado `botActivity` fica; a tela de mural é spec futura), `apps/web/src/pages/LogisticsPage.tsx` se for só um redirecionamento para `PedidosPage` (verificar o `intent` completo antes; se houver fluxo real, manter e registrar).
- **R8** `AGENTS.md` e `docs/design/DEVELOPMENT-LAB.md` deixam de instruir o uso de `lab:context`/`lab:query`/`lab:refresh`; `docs/design/DEVELOPMENT-LAB.md` passa a descrever só a bancada de simulações.

## Critérios de aceite

- **A1** `npm run check` verde e mais rápido que antes (medir `time`).
- **A2** `npx playwright test` passa em Chromium num ambiente sem Edge e **sem rede** para `tiles.openfreemap.org` e `router.project-osrm.org` (bloquear com `page.route` ou `--offline` e confirmar).
- **A3** CI verde no GitHub Actions com os dois jobs.
- **A4** `grep -rn "capture-lab\|ui-catalog\|ui-flows\|lab-artifacts\|lab:context\|lab:query" --include=*.ts --include=*.tsx --include=*.json --include=*.md . | grep -v node_modules | grep -v specs/` devolve zero.
- **A5** Linhas em `scripts/` caem em ≥ 3.500 e em `apps/web/src/devlab` em ≥ 1.000.
- **A6** `npm ls` sem `^` nas dependências listadas em R6; `node --version` em CI = 22.x.

## Fora de escopo

Qualquer mudança na bancada de simulações; redução de CSS; roteador do cliente; memoização do Provider (specs de interface, depois da 007).
