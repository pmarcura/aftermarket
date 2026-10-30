# Plan 002 · Dieta de ferramental

## Ordem (cada passo termina com `npm test` verde)

1. **Desacoplar antes de apagar.** Tirar `lab:catalog:check` do `check`; remover o plugin de `vite.config.ts`; apagar `tests/ui-catalog.test.ts` e `tests/ui-flows.test.ts`. Rodar `npm run check`.
2. **Apagar a cadeia** listada em R2 com `git rm`. Conferir cada import quebrado com `tsc --noEmit`: `LabPage.tsx` perde as abas *Interfaces* e *Método* (manter *Simulações*; `LabJournal`/`LabStudyEvidence` só se não dependerem do removido — verificar, senão apagar e simplificar `LabPage`). `start-lab.ts` deixa de iniciar watcher.
3. **Scripts e `package.json`**: remover os scripts de R3. `landing:telas` (`capture-landing.ts`) só tira screenshots da landing com Playwright; manter se compilar sozinho sem `capture-lab`, senão apagar e registrar.
4. **Playwright**: `playwright.config.ts` com `channel: process.env.PLAYWRIGHT_CHANNEL === 'msedge' ? 'msedge' : undefined`; criar `tests/e2e/fixtures.ts` com `bloquearRedeExterna(page)` (tiles → resposta vazia 204 ou um tile transparente em cache; OSRM → fixture `road-router.mjs` já existente na porta 3014) e aplicar em todos os specs via `test.beforeEach`. Conferir `playwright.lab.config.ts` e `playwright.landing.config.ts` (apagar o do lab se a aba *Interfaces* for embora; o da landing segue).
5. **Arquivos mortos** de R7: `git rm`, `tsc`, `npm test`. Para `LogisticsPage`, ler `App.tsx` e `game.tsx` (`intent` de frete) antes.
6. **Versões**: `npm install --save-exact` das listadas; `.nvmrc`; CI em Node 22 com job `e2e` (`npx playwright install --with-deps chromium`). Conferir que `node:sqlite` existe no 22 LTS sem flag (sim desde 22.13; manter `engines`).
7. **Docs**: `AGENTS.md` seção "Investigar o jogo com rapidez" reescrita em 5 linhas (lab de simulações + `economy-proof`); `DEVELOPMENT-LAB.md` enxuto; `README.md` seção "Executar" sem `lab:refresh`/`lab:query`.

## Arquivos tocados

`package.json`, `package-lock.json`, `.nvmrc`, `vite.config.ts`, `playwright*.config.ts`, `.github/workflows/verificacao.yml`, `scripts/*` (remoções), `apps/web/src/devlab/*`, `apps/web/src/{features/business,components,pages}` (remoções), `tests/e2e/*`, `tests/ui-*.test.ts` (remoções), `AGENTS.md`, `README.md`, `docs/design/DEVELOPMENT-LAB.md`.

## Riscos

- `LabPage.tsx` (1.061 linhas) mistura as três abas; a separação pode exigir reescrever a página em vez de recortar. Limite: se passar de meio dia, deixar a aba *Simulações* como única e apagar o resto da página.
- `landing:telas` pode compartilhar helpers com `capture-lab`; se sim, extrair o mínimo (abrir página, screenshot) para `scripts/lib/screenshot.ts`.
- Travar versões pode exigir `npm install` com rede; se o lock mudar muito, fazer num commit isolado para o diff ficar legível.
- Conflito com a spec 001 em `package.json`, `AGENTS.md`, `README.md` e `tests/e2e/*`: trabalhar em branches separados e fazer merge da 002 primeiro (é menor); a 001 rebaseia.

## Decisões técnicas reversíveis

1. Remover em vez de mover para `legacy/` (constituição 4 e `AGENTS.md`: sem pastas `old`/`legacy`; o Git guarda).
2. Chromium como navegador padrão de teste; Edge opcional por variável de ambiente.
3. e2e em CI como job separado para não travar o `check` rápido.
