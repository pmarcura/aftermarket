# Tasks 003 · Régua honesta

Prefixo `spec-003:`. Marcar `[x]` só com evidência (commit + comando + resultado).

- [ ] T0 Régua de não regressão `test-results/spec-003-before.json` (escala 1, 20 dias, semente 0). — R6 (motor intacto)
- [ ] T1 `equipmentByRecipe` explícito em `catalog.ts` com os valores atuais; `economy-v2.ts` lê a tabela; régua idêntica. — R6
- [ ] T2 Calculadora com `utilization` e `realizedPrice`; `paybackDays` como saída; checks de margem/lucro/payback; `knownBalanceDebt` no teste; `flows.cows` corrigido; régua idêntica. — R6
- [ ] T3 Resultado por negócio: estoque a custo + lotes em curso + trânsito. — R1
- [ ] T4 KPIs: utilização, lucro/linha ÷ projeto, preço realizado; `targets`. — R4, R5
- [ ] T5 Padrões 60/30/5 sementes; mediana/mín/máx; `runLab` com `scale`. — R2, R3
- [ ] T6 `PROVA.md` (apagar `PROVA-V2*.md`, atualizar referências); regra de aceitação na constituição. — R7, R8
- [ ] T7 Determinismo: mesma semente duas vezes, JSON idêntico (exceto tempo). — A2
- [ ] T8 Baseline escala 1 e escala 20 publicado em `PROVA.md`; tempo medido. — A1, A4
- [ ] T9 `npm run check`, `prettier --check .`; `specs/README.md` → verificada. — A3

## Evidência
