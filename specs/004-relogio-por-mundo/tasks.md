# Tasks 004 · Relógio por mundo

Prefixo `spec-004:`. Marcar `[x]` só com evidência.

- [x] T1 Régua de `main` (escala 1, 20 dias; escala 20, 5 dias). — R6
- [x] T2 Funções de conversão; `TIME_SCALE` sai do `model.ts`. — R2
- [x] T3 `season.config.clock` na criação e na migração; durações da temporada com o `timeScale` do mundo. — R1
- [x] T4 Motor sem `TIME_SCALE`/literais (um commit por arquivo; régua idêntica). — R2, R6
- [x] T5 Servidor (`AFTERMARKET_TIME_SCALE`, `clock` na view) e scripts (`--timeScale`). — R1, R4
- [x] T6 Cliente lê o relógio do mundo. — R3
- [x] T7 Testes adaptados + teste do relógio a 6×. — A3
- [x] T8 Prova R4 (120× vs 6×, mesma semente, 20 dias de jogo). — A2
- [x] T9 A1 (grep), `npm run check`, e2e, prettier; docs; `specs/README.md` → verificada. — A1, A3, R5

## Evidência

### Como a régua foi medida

- **Prova:** `npx tsx scripts/economy-proof.ts --days=20 --window=10 --seeds=0 --scale=1` e `--days=5 --window=3 --seeds=0 --scale=20`, cada commit num worktree do próprio commit (as duas escalas em paralelo, nunca mais de 2 simulações). Comparação do JSON inteiro, campo a campo, exceto `msPerDay`, `commit` e `seasonHash`.
- **Impressão digital** (mesma técnica da T0 da 003/005): sha256 do mundo inteiro ao fim de cada dia, com `crypto.randomUUID` trocado por contador e sem `season.config.clock` (campo novo), mais o total de ids gerados.

### Resultado por tarefa

- **T1** `main` = `aa35efc`. Escala 1, 20 dias: vendas 58,6% (`coverageAll` 0,5862958678559475), aço ao governo 7,2 t/dia, `moneyDrift` 0, `seasonHash` `87c8ecc278c7`, 96.103 ids (o mesmo número da 005). Escala 20, 5 dias: vendas 47,8%, aço 22,0 t/dia, `moneyDrift` 0, `seasonHash` `c28047496501`, 238.301 ids.
- **T2** `1def4d7` + `30364a2`. `packages/simulation/src/clock.ts`: `gameToReal(w, ms)`, `realToGame(w, ms)`, `gameDay(w)`, `economicInterval(w)`, `timeScaleOf(w)` (aceitam o mundo ou o próprio relógio), `createClock(timeScale = 120)` e as unidades de jogo `MINUTE_MS`/`HOUR_MS`/`DAY_MS`. `createClock` só aceita inteiro positivo que divida a rodada de 2 h de jogo (7.200.000 ms), para rodadas e dias caírem em ms reais inteiros (6 e 120 passam; 7 e 1,5 não). `TIME_SCALE`/`ECONOMIC_INTERVAL` saíram do `model.ts` e `GAME_DAY` do `operations.ts` no fim (`30364a2`), quando o último uso tinha saído; o padrão fica só em `DEFAULT_TIME_SCALE`. Testes: `tests/clock.test.ts`.
- **T3** `97e0e37`. `season.config.clock = { timeScale, economicIntervalGameMs: 7.200.000 }`; `createWorld`/`createScenario` aceitam `timeScale`; `v2Recipes(clock)` e `v2SeasonConfig(scale, clock)` calculam a duração das receitas e `government.contractIntervalMs` com o relógio do mundo; `nextEconomicAt` inicial = `economicInterval(clock)`. Migração: `clock` entrou em `seasonFields`; mundo salvo sem ele recebe `createClock()` (120×) e o resto da temporada fica como foi gravado (teste compara a temporada inteira antes e depois). Régua: **idêntica** nas duas escalas; `seasonHash` passa a `9e5fbe980eb4` (escala 1) e `07a3dbbbdf8b` (escala 20) pelo campo novo. Impressão digital escala 1: idêntica dia a dia, 96.103 ids.
- **T4** Um commit por arquivo, régua **idêntica** (escala 1 e 20) em cada um: `527505e` operations, `d9ccfc8` engine, `459a7a6` director, `79736f9` competition, `d877927` supply, `1106e63` design, `d0081ce` opening-v2, `de78b9d` history, `3a40720` lab-telemetry, `c06401e` lab (também `LabOptions.timeScale`), `b5142a8` resource-audit (economy-v2 e seed foram na T3). Literais: `director.ts` aceitava proposta após 60.000 ms **reais** → `gameToReal(w, 2 * HOUR_MS)` (2 h de jogo, o mesmo valor a 120×; o "12 min" do `plan.md` estava errado); `competition.ts` `(educationHours * 3600000) / 120` → `gameToReal(w, educationHours * HOUR_MS)`. Todas as trocas mantêm a mesma ordem das operações em ponto flutuante (ex.: `(x * 3600000) / 120` → `gameToReal(w, x * HOUR_MS)` = `(x * 3600000) / 120`), por isso a régua fica idêntica bit a bit.
- **T5** `17c94ee` servidor: `AFTERMARKET_TIME_SCALE` (validada por `createClock`) cria mundo novo naquela velocidade; mundo existente segue a sua, com aviso no console se a variável for diferente. `store.ts` (arquivo do histórico) e `view.ts` usam `gameDay(w)`; o pacote do navegador já leva `season.config.clock` (a view espalha o mundo). `0d1ee0c` scripts: `economy-proof --timeScale` (avança por `gameDay(w)`: a prova avança o relógio, não espera tempo real, então um dia de jogo custa a mesma CPU; `timeScale` só entra no JSON fora do padrão e `--from` exige o mesmo relógio), `balance-season`, `lab-batch` e `lab-benchmark` com `--timeScale`; `report-mechanics` descreve o relógio do mundo relatado (mundo salvo sem relógio é lido como 120×). Régua de `0d1ee0c`: **idêntica**.
- **T6** `6333ee5`: 23 arquivos do cliente; nenhum importa mais `TIME_SCALE`/`ECONOMIC_INTERVAL`/`GAME_DAY`. Relógio do jogo, "enquanto você esteve fora" e calendário (`tempo.ts`), finanças, resumo, início, fichas de produto e análise (vela por rodada econômica), cotações, prazos de pedido e frete, receitas e "Ritmo do mundo" em Configurações (`1 minuto real = N minutos no jogo` do mundo). `horasDeJogo`, `horasAte` e `estadoDaUnidade` recebem o mundo; a última rodada é `nextEconomicAt - economicInterval(world)`. A animação dos caminhões já usava `departedAt`/`arrivesAt` (instantes reais do próprio mundo).
- **T7** `46129e3`: 21 arquivos de teste declaram `DAY`/`ROUND` do relógio padrão (`createClock()`), `economy-config` confere a duração das receitas pelo relógio do mundo, e2e de Configurações espera "1 minuto real = 120 minutos no jogo". `e88c5f2` `tests/clock-speed.test.ts`: a 6× o dia de jogo dura 4 h reais com as mesmas 12 rodadas e o mesmo calendário; treinamento (12 h de jogo), editais (6 h de lance, prazo de 4 dias) e os editais do primeiro dia (mesmos produtos, quantidades e instantes de jogo) iguais nas duas velocidades; o bot comprador não decide a 2 h de jogo − 1 ms e decide a 2 h de jogo, nas duas (com o literal antigo, a 6× decidiria após 1 min real = 6 min de jogo); `createStore(':memory:', { timeScale: 6 })` cria o mundo a 6×.
- **T8 (A2)** Prova R4 no commit `e88c5f2`, semente 0, `--timeScale=6` contra o padrão, mesmos dias de jogo. O JSON inteiro é **igual campo a campo** (todos os KPIs, por produto e por receita); só diferem `timeScale` (ausente a 120×), `seasonHash` (o relógio e as durações em ms estão na temporada) e `msPerDay`. Diferença: **0** em todos os KPIs, abaixo da tolerância de 0,5%; não houve nem arredondamento, porque a 6× toda duração em ms reais é exatamente 20× a de 120× e as razões (duração ÷ dia, rodada ÷ dia) são as mesmas em ponto flutuante.

  | KPI                                        | Escala 1, 20 dias, 120× | Escala 1, 20 dias, 6× | Escala 20, 5 dias, 120× | Escala 20, 5 dias, 6× |
  | ------------------------------------------ | ----------------------- | --------------------- | ----------------------- | --------------------- |
  | Vendas (`coverageAll`)                     | 0,586296                | 0,586296              | 0,478006                | 0,478006              |
  | Aço ao governo (t/dia)                     | 7,2                     | 7,2                   | 22,0                    | 22,0                  |
  | Caminhões comprados/dia (pesado · leve)    | 0,10 · 0,10             | 0,10 · 0,10           | 37,33 · 28,00           | 37,33 · 28,00         |
  | Caminhões aposentados/dia                  | 0,90                    | 0,90                  | 3,33                    | 3,33                  |
  | Quebras · `moneyDrift` · estoque sem custo | 0 · 0 · 0               | 0 · 0 · 0             | 0 · 0 · 0               | 0 · 0 · 0             |
  | `seasonHash`                               | `9e5fbe980eb4`          | `300730b141cb`        | `07a3dbbbdf8b`          | `359a9673c825`        |
  | ms de CPU por dia de jogo                  | 660                     | 669                   | 8.311                   | 8.428                 |

  O custo por dia de jogo é o mesmo (as duas velocidades rodaram juntas, em paralelo). Margens, concentração, linhas e utilização por receita também iguais (comparação do JSON inteiro).

- **R6 no fim** `e88c5f2` contra `main`: prova **idêntica** nas duas escalas (exceto `msPerDay`, `commit`, `seasonHash`); impressão digital (mundo sem `season.config.clock`) **idêntica** dia a dia nas duas escalas, com 96.103 e 238.301 ids. Tempo por dia sem regressão (régua de `30364a2`: 706 ms e 6.771 ms; `main`: 644 ms e 6.851 ms, mesma forma de medir; medições com ruído de ±15% nesta máquina).
- **T9** **A1** (`grep -rnE "TIME_SCALE|ECONOMIC_INTERVAL|/ ?120\b|60_?000" packages apps scripts tests`, depois de `d3cd3aa`): sobram (a) `clock.ts` (`MINUTE_MS = 60_000`, `DEFAULT_TIME_SCALE = 120`) e seus testes (`clock.test.ts`, `clock-speed.test.ts`); (b) o nome da variável `AFTERMARKET_TIME_SCALE` (`apps/server/src/index.ts`, `store.ts`, título de teste); (c) números que não são tempo e só casam com `60_?000` por conterem a sequência: preços, faixas e salários de `catalog.ts`, `seed.ts`, `calibration.ts`, populações de `opening-v2.ts`; (d) tempo **real** que não é tempo de jogo: nova tentativa do roteador externo em 60 s (`apps/server/src/routing.ts`, `road-access.ts`, `apps/web/src/lib/routing.ts`), tempo-limite de testes do vitest/Playwright (`60000`) e o instante de chegada sintético do e2e de animação. Nenhum literal de tempo de jogo fora das funções de conversão. `npm run check` verde (build; 33 arquivos, 258 testes; `resources:check` sem erros); `npx prettier --check .` verde; e2e `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers npx playwright test`: 26/26 em 6,6 min (relógio padrão). Docs: `4e09343` (README e STATE: dia de jogo = 4 h reais a 6×, `AFTERMARKET_TIME_SCALE`).

### Decisões técnicas fora do plano (reversíveis)

1. Nomes da spec (`gameToReal`/`realToGame`) em `clock.ts`, mais `gameDay`/`economicInterval`/`timeScaleOf`; aceitam o mundo ou o relógio (a temporada é criada antes do mundo).
2. `createClock` exige inteiro que divida 7.200.000 (ms inteiros por rodada e por dia).
3. `economicIntervalGameMs` fica fixo em 2 h: os `/ 12` e `* 12` do motor (rodadas por dia de jogo em `engine.ts`, `supply.ts`, `economy-v2.ts`) continuam corretos enquanto ele não puder mudar; se um dia puder, trocar por `gameDay(w) / economicInterval(w)`.
4. A prova só grava `timeScale` no JSON quando não é 120 (o JSON a 120× fica comparável com o de antes).
5. Servidor avisa no console quando `AFTERMARKET_TIME_SCALE` difere do relógio do mundo carregado (não muda o mundo).
6. Cliente: o campo `minutos` da gaveta de reposição (gravado e nunca exibido) foi removido.

### Limitações

- Contagens regressivas da interface rotuladas "s reais" (treinamento em `Workforce.tsx`, lance de edital em `CartaoContrato.tsx`) continuam em tempo real, corretas em qualquer velocidade, mas a 6× mostram números grandes (treinamento de 12 h de jogo = 7.200 s reais). Próxima ação: mostrar em horas de jogo, junto com a recalibração de prazos da 006.
