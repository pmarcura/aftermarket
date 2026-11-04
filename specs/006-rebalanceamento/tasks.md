# Tarefas 006

- [ ] T1 Agentes adversários (R7). _Adiado: os tetos de preço ficaram como estão (ver T2); os agentes entram quando os tetos apertarem._
- [x] T2 Tetos de preço em `season.config` (R1). **Medido e não aceito:** `maxPriceFactor` 1,5→1,25 e `governmentBonus` 1,25→1,10 derrubam o pior caso da procura atendida de 50% para 33% e suspendem 1–3 bots por semente (escala 1, 5 sementes). Sobre o atacado (1,15–1,5×) é pior ainda (4–20% atendidos). Os tetos viraram parâmetro da temporada com os valores de hoje; apertar só depois de os produtores-bot competirem por preço.
- [x] T3 Calculadora fecha: `knownBalanceDebt` vazia (commit `f18eac6`). Preços na faixa real; equipamento por prazo de retorno (~42 dias; caminhões 30). `resources:check` sem erro.
- [ ] T4 Teto de 40% por grupo (R2). _Não iniciado._
- [x] T5 Oferta dos bots (R3, revisto): bots abrem com 100% das linhas de referência (`BOT_SHARE` 1, commit `3eba791`) e lojas-bot cobrem 70% da procura (`RETAIL_COVERAGE` 0,7). "Comprar uma linha a mais" é impossível: as unidades já ocupam toda a área (expansão = terreno novo, fora desta rodada). Produtor-bot baixando preço com estoque parado: medido e descartado (menos caixa → mais suspensões).
- [ ] T6 Temporada `balance/season-2026-01` + migração (R6).
- [ ] T7 Prova escala 20 no Actions (A1). Rodada 1 (`3eba791`, run 41556950012): procura 45%→51%, aço 180→215 t/dia, estoque fora 7→2, utilização fora 3→1, lucro/linha fora 12→10, pesados 14,2→16,6/dia; **retrocesso:** 1–2 minas excedentes suspensas por semente (antes 0). Rodada 2 (lojas 70%) em andamento.
