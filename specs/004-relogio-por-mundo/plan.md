# Plan 004 · Relógio por mundo

## Princípio

Duas provas guiam a spec: (1) com `timeScale = 120` nada muda em relação ao `main` (JSON da prova idêntico, exceto metadados); (2) o mesmo mundo a 120× e a 6× pelo mesmo número de dias de jogo dá a mesma economia (KPIs dentro de 0,5%).

## Passos

1. **Régua**: prova de `main` na escala 1 (20 dias, semente 0) e escala 20 (5 dias).
2. **Funções únicas de conversão** em `operations.ts` (ou `clock.ts`): `timeScaleOf(w)`, `gameMs(w, realMs)`, `realMs(w, gameMs)`, `gameDay(w)`, `economicInterval(w)`. `TIME_SCALE` deixa de ser exportado do `model.ts` (fica só o padrão `DEFAULT_TIME_SCALE`).
3. **Temporada**: `season.config.clock` gravado na criação; `v2SeasonConfig(scale, timeScale)` usa o `timeScale` para converter durações; migração preenche `clock` com 120 sem recalcular.
4. **Motor**: trocar todos os usos em `engine`, `director`, `operations`, `supply`, `competition`, `design`, `economy-v2`, `opening-v2`, `history`, `lab`, `lab-telemetry`, `resource-audit`, `seed` pelas funções; corrigir os literais `director.ts:298` (60.000 ms reais → 12 min de jogo = `realMs(w, 0,2 h)`… usar o equivalente em jogo do valor atual) e `competition.ts:428` (`/ 120`). Régua idêntica (passo 1) a cada arquivo.
5. **Servidor e scripts**: `AFTERMARKET_TIME_SCALE` no servidor; `view.ts` envia `clock`; `economy-proof`, `balance-season`, `report-mechanics` e o lab aceitam `--timeScale`.
6. **Cliente**: todo cálculo de tempo de jogo lê `world.season.config.clock` (ou `view`); trocar `TIME_SCALE` e literais em `tempo.ts`, `Financas.tsx`, `precificacao.ts`, `ProdutoFicha.tsx`, `Transacoes.tsx`, `pedidos/dados.ts`, `Cotacoes.tsx`, `ProductAnalysis.tsx`, `FleetPicker.tsx`, `Logistics.tsx`, `Fluxo.tsx`, `App.tsx` (Configurações mostra "1 minuto real = N minutos no jogo" do mundo).
7. **Testes**: os ~25 usos em testes passam a usar as funções (ou o padrão 120 explícito); teste novo: mundo a 6× avança 1 dia de jogo em 4 h reais com 12 rodadas econômicas; educação, editais e aceitação de proposta duram o mesmo em tempo de jogo nas duas velocidades.
8. **Prova R4**: escala 1, semente 0, 20 dias de jogo a 120× e a 6× → KPIs dentro de 0,5%; explicar qualquer diferença.
9. **Docs**: README e STATE (relógio do playtest: `AFTERMARKET_TIME_SCALE=6`, dia de jogo = 4 h reais).

## Riscos

- **Arredondamento**: durações em ms inteiros divididas por 6 em vez de 120 mudam frações; pode alterar a ordem de eventos simultâneos. Tolerância de 0,5% na prova R4; se passar disso, investigar.
- **Datas reais no cliente**: "enquanto você esteve fora" e calendário do jogo usam `season.startedAt` + tempo de jogo; conferir com o relógio lento no navegador.
- **e2e**: testes que esperam rodadas reais de 60 s continuam a 120×.

## Decisões técnicas reversíveis

1. `clock` na temporada (congelado por mundo), não variável de ambiente lida a cada tick.
2. Mundos salvos ficam na velocidade em que nasceram; trocar a velocidade de um mundo existente não é suportado nesta spec.
