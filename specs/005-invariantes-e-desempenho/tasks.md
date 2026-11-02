# Tasks 005 · Invariantes e desempenho

Prefixo `spec-005:`. Marcar `[x]` só com evidência (commit + comando + resultado).

- [ ] T0 Régua (impressão digital + JSON) de `main` e tempo de partida na escala 20 (15 dias, semente 0). — A1, A2
- [ ] T1 `indexes.ts` com índices incrementais e testes próprios. — R1
- [ ] T2 `runSupplyPolicies` e demais varreduras de `supply.ts` usando os índices; régua idêntica. — R1, R2
- [ ] T3 `committedStorage`/`storageQuantity` usando os índices; régua idêntica. — R1, R2
- [ ] T4 Novo perfil; pontos de `engine.ts`/`director.ts` que ainda dominarem, se seguros; régua idêntica. — R1, R2
- [ ] T5 `advance` sem `Math.min(...spread)`; régua idêntica. — R6
- [ ] T6 `totalMoney` e `assertMoney`; `dispatch` sem mutação antes da última verificação; erro de bot isolado; testes A3 e A4. — R3, R4, R5
- [ ] T7 Históricos por tempo e `supplySpent` por contador; régua (parar se mudar). — R7
- [ ] T8 A1 medido; `npm run check`, e2e, `prettier --check .`; docs; `specs/README.md` → verificada. — A1, A5

## Evidência
