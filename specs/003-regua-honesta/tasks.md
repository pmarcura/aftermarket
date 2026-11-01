# Tasks 003 · Régua honesta

Prefixo `spec-003:`. Marcar `[x]` só com evidência (commit + comando + resultado).

- [x] T0 Régua de não regressão `test-results/spec-003-before.json` (escala 1, 20 dias, semente 0). — R6 (motor intacto)
- [x] T1 `equipmentByRecipe` explícito em `catalog.ts` com os valores atuais; `economy-v2.ts` lê a tabela; régua idêntica. — R6
- [ ] T2 Calculadora com `utilization` e `realizedPrice`; `paybackDays` como saída; checks de margem/lucro/payback; `knownBalanceDebt` no teste; `flows.cows` corrigido; régua idêntica. — R6
- [ ] T3 Resultado por negócio: estoque a custo + lotes em curso + trânsito. — R1
- [ ] T4 KPIs: utilização, lucro/linha ÷ projeto, preço realizado; `targets`. — R4, R5
- [ ] T5 Padrões 60/30/5 sementes; mediana/mín/máx; `runLab` com `scale`. — R2, R3
- [ ] T6 `PROVA.md` (apagar `PROVA-V2*.md`, atualizar referências); regra de aceitação na constituição. — R7, R8
- [ ] T7 Determinismo: mesma semente duas vezes, JSON idêntico (exceto tempo). — A2
- [ ] T8 Baseline escala 1 e escala 20 publicado em `PROVA.md`; tempo medido. — A1, A4
- [ ] T9 `npm run check`, `prettier --check .`; `specs/README.md` → verificada. — A3

## Evidência

- **T0** `npx tsx scripts/economy-proof.ts --days=20 --window=10 --seeds=0 --scale=1 --out=test-results/spec-003-before.json` no HEAD `e62a5e0`: semente 0, vendas 59%, aço ao governo 7,2 t/dia, caminhões 0,10 pesado + 0,10 leve/dia, 0,90 aposentados/dia, `moneyDrift` 0 (13,8 s). Régua de comparação: 27 campos (`coverage*`, `lines.*.observed`, `governmentSteelPerDay`, `trucks*`, `moneyDrift`) com tolerância zero. Reforço: impressão digital do motor (sha256 do `season.config` de um mundo novo e do `World` inteiro após 20 dias, semente 0, com `crypto.randomUUID` trocado por contador para tirar o único não determinismo, os ids): `config 87c8ecc2…`, `mundo c3b27259…`, repetível em duas execuções.
- **T1** Tabela `equipmentByRecipe` em `catalog.ts` copiada de `createScenario(AT,'playtest',0,{scale:1}).season.config.design.equipmentByRecipe` (14 receitas, centavos). `economy-v2.ts` lê a tabela e não importa mais `analyzeDesign`; `lineEconomics` devolve `equipment` (tabela), `suggestedEquipment` (derivado antigo), `capex` e `paybackDays`. Régua: `spec-003-before.json` × `spec-003-t1.json` → 27 campos, 0 diferenças; impressão digital idêntica (`config 87c8ecc2…`, `mundo c3b27259…`). `vitest run tests/economy-design.test.ts tests/economy-config.test.ts` → 8/8.
