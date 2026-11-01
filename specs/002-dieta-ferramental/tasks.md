# Tasks 002 · Dieta de ferramental

Prefixo de commit `spec-002:`. Evidência obrigatória ao marcar.

- [x] T1 `check` sem `lab:catalog:check`; plugin fora do `vite.config.ts`; apagar `tests/ui-catalog.test.ts`, `tests/ui-flows.test.ts`. `npm run check` verde. — R1 · commit `52462f9` · `time npm run check` → exit 0, 29 arquivos / 225 testes, 41,3 s (antes: 31 / 230, 59,6 s).
- [x] T2 `git rm` da cadeia de R2; `LabPage.tsx` só com _Simulações_; `tsc` limpo. — R2 · commit `3fb66f0` · 15 arquivos removidos com `git rm`; `LabPage.tsx` 1.061 → 657 linhas; `npx tsc --noEmit` → exit 0; `npm test` → 29 / 225.
- [x] T3 `package.json` sem scripts de R3; `start-lab.ts` sem watcher; decisão sobre `capture-landing.ts` registrada. — R3 · commit `cd4755d` · `grep '"lab:\|"capture\|"test:lab' package.json` → restam só `lab`, `lab:batch`, `lab:benchmark`, `landing:telas`; `tsc --noEmit` → exit 0. Decisão: `landing:telas` fica (compila sozinho, documentado em `docs/design/LANDING.md`); `capture:ui`/`capture-ui.ts` e `playwright.lab.config.ts` removidos.
- [x] T4 Playwright em Chromium; `tests/e2e/fixtures.ts` bloqueando rede externa em todos os specs; `playwright.lab.config.ts` decidido. `npx playwright test` verde sem rede externa. — R4, A2 · commit `d7a59f7` · `npx playwright test` em Chromium (Chrome for Testing 153, `PLAYWRIGHT_BROWSERS_PATH` local): 18 passam, 9 falham; os 9 já falhavam em `spec/000-constituicao` (reproduzido no mesmo ambiente: 8 falhas idênticas + `economic-flow`, ver Evidência). `rede-externa.spec.ts` e `lab.spec.ts` passam; nenhuma requisição externa chega à rede.
- [x] T5 Arquivos mortos de R7 removidos (decisão sobre `LogisticsPage` registrada). — R7 · commit `563f478` · 5 arquivos removidos; `grep` por nome/caminho em `apps tests scripts` → só as próprias definições; `tsc --noEmit` → exit 0. `LogisticsPage` mantida (tem fluxo real de frete via `intent`).
- [x] T6 Versões exatas + `.nvmrc` + lock regenerado; `npm ci && npm run check` verde. — R6, A6 · commit `1b5318d` · `npm install --save-exact` nas 12 dependências de R6 (mesmas versões já instaladas); `npm ci` → 192 pacotes; `npm ls` sem `^`; `.nvmrc` = `22`; `npm run check` → exit 0.
- [x] T7 CI: Node 22, job `e2e` com Chromium. Verde no GitHub. — R5, A3 · commit `d70833b` · `verificacao.yml` com `node-version-file: .nvmrc` e job `e2e` (`npx playwright install --with-deps chromium` + `npm run test:e2e`). **Pendente de execução no GitHub** (sem push nesta sessão).
- [x] T8 Docs: `AGENTS.md`, `README.md`, `DEVELOPMENT-LAB.md`. — R8 · commit `b6aced4` · também `docs/DEVELOPMENT.md`, `.github/CONTRIBUTING.md` e `.github/ISSUE_TEMPLATE/balance_report.yml`, que apontavam para `lab:query`.
- [x] T9 A1 (tempo do `check` antes/depois), A4 (grep zero), A5 (linhas) anexados; `specs/README.md` → verificada. — Evidência abaixo. A5 atendido só em `devlab`; em `scripts/` a queda é de 2.716 linhas (meta 3.500 inatingível com a lista de R2, ver Evidência).

## Evidência

Ambiente: Linux, Node v22.23.4, npm ci com 192 pacotes. Baseline = `96bed98` (`spec/000-constituicao`). Branch `spec/002-dieta-ferramental`.

### A1 · `npm run check`

|                    | Comando              | Resultado                                                                                        |
| ------------------ | -------------------- | ------------------------------------------------------------------------------------------------ |
| Antes (`96bed98`)  | `time npm run check` | exit 0 · build + 31 arquivos / 230 testes + `resources:check` + `lab:catalog:check` · **59,6 s** |
| Depois (`d70833b`) | `time npm run check` | exit 0 · build + 29 arquivos / 225 testes + `resources:check` · **42,5 s** (T1 isolado: 41,3 s)  |

Queda de ~17 s (29 %), quase toda do `lab:catalog:check` (AST do TypeScript) e dos dois testes removidos.

### A2 · e2e em Chromium sem rede externa

- Navegador: Chromium. O proxy desta máquina bloqueia `cdn.playwright.dev`, então `npx playwright install --with-deps chromium` falhou no download (as dependências do sistema instalaram). Usei o Chrome for Testing 153.0.8010.12 pré-instalado em `/opt/pw-browsers` via `PLAYWRIGHT_BROWSERS_PATH` apontando para links `chromium-1248 → chromium-1243`. Nenhum Edge no ambiente.
- `npx playwright test` (27 testes, 10,2 min): **18 passam, 9 falham**. Passam: `lab.spec` (3), `landing.spec` (7), `navigation.spec` (2), `notifications.spec` (2), `opening.spec` (3), `rede-externa.spec` (1). Falham: `animation`, `business`, `design` (2), `economic-flow`, `intelligence`, `procurement`, `transport` (2).
- As 9 falhas são seletores antigos da interface (`Caixa, compromissos e recuperação`, `Pedidos e negociações`, `[data-shipment-id]` fora da tela de logística etc.), já listados como "próxima ação" em `docs/design/VALIDACAO-INTERFACE-2026-10-30.md`. Reproduzido em `96bed98` no mesmo ambiente com `PLAYWRIGHT_CHANNEL=chromium`: `animation`, `business`, `design` ×2, `intelligence`, `procurement`, `transport` ×2 falham igual (8/8); `economic-flow` idem (ver log `e2e-baseline-economic.log` da sessão). Nenhuma falha nova foi introduzida pela 002; a única regressão encontrada (`landing.spec` esperando as abas do laboratório) foi corrigida em `d7a59f7`.
- Sem rede: `tests/e2e/fixtures.ts` responde `tiles.openfreemap.org` com TileJSON local e tiles vazios, e qualquer outro host fora de 127.0.0.1 (inclusive `router.project-osrm.org`) com 204. `rede-externa.spec.ts` verifica que o mapa fica pronto, que não houve `requestfailed` externo e que `fetch` ao OSRM devolve 204 pela fixture. O servidor de teste já usava `AFTERMARKET_ROUTER_URL=http://127.0.0.1:3014` (fixture `road-router.mjs`).

### A3 · CI

Workflow editado (`d70833b`): dois jobs, `verificacao` e `e2e`, ambos em Node 22 via `.nvmrc`. **Pendente de execução no GitHub.**

### A4 · grep

```
grep -rn "capture-lab\|ui-catalog\|ui-flows\|lab-artifacts\|lab:context\|lab:query" --include=*.ts --include=*.tsx --include=*.json --include=*.md . | grep -v node_modules | grep -v specs/ | wc -l
```

Antes: 36 ocorrências em 18 arquivos. Depois: **0**. Para zerar foi preciso reescrever três frases em registros históricos (`.planning/phases/05-resource-balance/05-VALIDATION.md`, `.planning/phases/07-development-lab/07-VALIDATION.md`) que citavam os arquivos pelo nome; o sentido foi preservado e a remoção pela spec 002 anotada.

### A5 · linhas

| Pasta                            | Antes (`96bed98`) | Depois | Queda      | Meta                       |
| -------------------------------- | ----------------- | ------ | ---------- | -------------------------- |
| `scripts/` (`*.ts` + `lib/*.ts`) | 6.299             | 3.583  | **−2.716** | ≥ 3.500 · **não atingida** |
| `apps/web/src/devlab/`           | 3.761             | 1.986  | **−1.775** | ≥ 1.000 · atingida         |

A lista de R2 em `scripts/` soma 2.681 linhas (`capture-lab` 1.702, `lab-context` 315, `ui-catalog` 222, `lab-study` 167, `visual-diff` 138, `refresh-lab` 65, `lab-artifacts` 45, `lab-fingerprint` 27); com `capture-ui` (26) e o `start-lab` enxuto chega-se a 2.716. Cortar 3.500 exigiria apagar scripts que R2 manda manter (`report-mechanics` 1.008, `audit-mathematics` 738, `economy-proof` 329). A meta estava superestimada; não removi nada fora de R2. Em `devlab`, `lab.css` (755 linhas) ficou intacto porque redução de CSS está fora de escopo.

### A6 · versões

`npm ls typescript vite vitest @playwright/test react react-dom express zod maplibre-gl echarts @vitejs/plugin-react tsx --depth=0` → 12 pacotes, nenhum `^` (typescript 7.0.2, vite 8.3.5, vitest 4.1.12, @playwright/test 1.64.1, react/react-dom 19.3.1, express 5.3.0, zod 4.6.7, maplibre-gl 6.16.0, echarts 6.1.0, @vitejs/plugin-react 6.1.2, tsx 4.23.15). `.nvmrc` = `22`; `node --version` local = v22.23.4; `node:sqlite` disponível sem flag. CI em 22.x pendente de execução.

### Decisões fora do plan

1. `LabInspection.tsx` e `LabParameters.tsx` ficaram (dependem só do motor e da aba _Simulações_); `LabJournal.tsx` saiu junto com a aba _Método_ (o plan deixava em aberto).
2. `tests/e2e/lab.spec.ts` perdeu os três casos das abas _Interfaces_/_Método_ e o trecho de diário do quarto caso.
3. `scripts/lib/lab-fingerprint.ts` ficou (usado por `lab-batch`, `lab-benchmark`, `audit-mathematics`), sem `labFixtureSources`/`labFixtureFingerprint`.
4. `capture:ui` / `scripts/capture-ui.ts` removidos (screenshot do mapa em Edge, sem uso documentado) — não estavam em R3.
5. `capture-landing.ts` passou a Chromium por padrão (Edge com `PLAYWRIGHT_CHANNEL=msedge`), como o `playwright.config.ts`.
6. Novo `tests/e2e/rede-externa.spec.ts` para provar A2 de forma explícita.
7. `navigation.spec.ts` trocou `route.continue()` por `route.fallback()` para que a fixture de bloqueio seja consultada.
8. Registros históricos em `.planning/phases/*` reescritos minimamente para zerar A4.
9. Pacotes fora de R6 (`@fontsource/*`, `lucide-react`, `@types/*`, `concurrently`, `prettier`) continuam com `^`.
