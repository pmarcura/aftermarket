# Spec 004 · Relógio por mundo

Estado: **rascunho**. Semana 2. Depende da 001.

## Problema

`TIME_SCALE = 120` e `ECONOMIC_INTERVAL = 60_000` ms **reais** são constantes globais (`model.ts:464-465`), usadas em 12 pontos do motor, 6 arquivos do cliente e literais escondidos (`competition.ts:418` divide por 120; `director.ts:296` espera 60.000 ms reais para aceitar propostas). O playtest usa relógio lento (D-028: 1 h real = 6 h de jogo, `timeScale = 6`). Com as constantes atuais, mudar `TIME_SCALE` sozinho faria 240 rodadas econômicas por dia de jogo e quebraria educação e negociação.

## Requisitos

- **R1** `season.config.clock = { timeScale, economicIntervalGameMs }` criado na abertura do mundo; o motor lê só daí. `ECONOMIC_INTERVAL` real = `economicIntervalGameMs / timeScale`.
- **R2** Toda duração no motor é expressa em **tempo de jogo** e convertida uma única vez por funções `gameToReal(w, ms)` / `realToGame(w, ms)` em `core` (ou `operations.ts`); zero literais de ms reais ou de `120` fora dessas funções (grep como critério).
- **R3** O cliente recebe `clock` na view e deixa de importar `TIME_SCALE`; relógio do jogo, "enquanto você esteve fora" e animação dos caminhões usam o valor do mundo.
- **R4** O lab e `economy-proof` aceitam `--timeScale`; a prova compara mundos a 120 e a 6 com a mesma semente e mesma duração em dias de jogo: KPIs iguais dentro de 0,5% (o relógio não pode mudar a economia; só a velocidade).
- **R5** Documentação: README e STATE explicam o relógio do playtest (dia de jogo = 4 h reais).

## Critérios de aceite

- **A1** `grep -rnE "TIME_SCALE|ECONOMIC_INTERVAL|/ ?120\b|60_?000" packages apps scripts tests` devolve só as duas funções de conversão e seus testes.
- **A2** Prova de R4 anexada.
- **A3** `npm run check` e e2e verdes com `timeScale = 120` (padrão dos testes) e um teste unitário com `timeScale = 6`.

## Fora de escopo

Recalibrar prazos de produção/transporte para o relógio lento (006, depois de medir).
