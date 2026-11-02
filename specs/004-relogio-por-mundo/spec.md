# Spec 004 · Relógio por mundo

Estado: **aprovada** (John, 02/11/2026). Branch `spec/004-relogio-por-mundo`. Depende da 001 e da 005 (mergeadas).

## Problema

`TIME_SCALE = 120` e `ECONOMIC_INTERVAL = 60_000` ms **reais** são constantes globais (`model.ts:464-465`), usadas em 12 pontos do motor, 6 arquivos do cliente e literais escondidos (`competition.ts:418` divide por 120; `director.ts:296` espera 60.000 ms reais para aceitar propostas). O playtest usa relógio lento (D-028: 1 h real = 6 h de jogo, `timeScale = 6`). Com as constantes atuais, mudar `TIME_SCALE` sozinho faria 240 rodadas econômicas por dia de jogo e quebraria educação e negociação.

Inventário (02/11/2026): `TIME_SCALE`/`ECONOMIC_INTERVAL`/`GAME_DAY` em 22 arquivos de código (engine 25 usos, director 14, operations 8, lab 7, supply 6, servidor 6, web 13 arquivos) e ~25 em testes; literais escondidos em `director.ts:298` (60.000 ms reais para aceitar proposta), `competition.ts:428` (`/ 120`), e no cliente (`tempo.ts`, `Financas.tsx`, `precificacao.ts`, `ProdutoFicha.tsx`, `Transacoes.tsx`, `pedidos/dados.ts`). **As durações das receitas já são gravadas na temporada em ms reais** (`economy-v2.ts:40`: `hours × 3.600.000 / TIME_SCALE`), ou seja, a velocidade de cada mundo salvo já está embutida nos dados.

## Requisitos

- **R1** `season.config.clock = { timeScale, economicIntervalGameMs }` gravado na criação do mundo (padrão 120 e 2 h de jogo; `createWorld`/`createScenario`/servidor aceitam `timeScale`, servidor por `AFTERMARKET_TIME_SCALE`). Tudo o que a temporada grava em ms reais (durações de receitas etc.) é calculado com o `timeScale` do próprio mundo. Mundos salvos sem `clock` recebem `{ timeScale: 120, … }` na migração, sem recalcular nada (é a velocidade com que foram criados).
- **R2** Toda duração no motor é expressa em **tempo de jogo** e convertida uma única vez por funções `gameToReal(w, ms)` / `realToGame(w, ms)` em `core` (ou `operations.ts`); zero literais de ms reais ou de `120` fora dessas funções (grep como critério).
- **R3** O cliente recebe `clock` na view e deixa de importar `TIME_SCALE`; relógio do jogo, "enquanto você esteve fora" e animação dos caminhões usam o valor do mundo.
- **R4** O lab e `economy-proof` aceitam `--timeScale`; a prova compara mundos a 120 e a 6 com a mesma semente e mesma duração em dias de jogo: KPIs iguais dentro de 0,5% (o relógio não pode mudar a economia; só a velocidade). Diferenças menores que isso só podem vir de arredondamento de ms e precisam ser explicadas.
- **R6** Com `timeScale = 120`, o jogo atual não muda: JSON da prova idêntico ao `main` (exceto `msPerDay`/commit/hash da temporada, que muda pelo campo novo `clock`).
- **R5** Documentação: README e STATE explicam o relógio do playtest (dia de jogo = 4 h reais).

## Critérios de aceite

- **A1** `grep -rnE "TIME_SCALE|ECONOMIC_INTERVAL|/ ?120\b|60_?000" packages apps scripts tests` devolve só as duas funções de conversão e seus testes.
- **A2** Prova de R4 anexada.
- **A3** `npm run check` e e2e verdes com `timeScale = 120` (padrão dos testes) e um teste unitário com `timeScale = 6`.

## Fora de escopo

Recalibrar prazos de produção/transporte para o relógio lento (006, depois de medir).
