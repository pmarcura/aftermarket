# Spec 005 · Invariantes em runtime e fila de eventos

Estado: **rascunho**. Semana 2. Depende da 001.

## Problema

A conservação de dinheiro só é provada em testes; em produção, uma regressão passaria despercebida. Comandos de bots executados dentro do tick não são atômicos (`attempt`/`act`/`executeSupply` só engolem `RuleError`; `dispatch` zera `order.escrowReserved` antes das transferências, `engine.ts:324`), e qualquer `TypeError` dentro do tick derruba a rodada inteira. `advance()` calcula o próximo evento com `Math.min(...spread)` sobre todas as remessas, lotes e treinos a cada iteração (`engine.ts:2341-2346`): O(n) por evento e estouro de pilha acima de ~65 mil itens. Históricos são cortados por contagem (`supplyHistory.slice(-5000)`, `consumptionHistory` 20.000, `marketHistory` 33.000), então com 500 bots o orçamento diário de compras deixa de limitar.

## Requisitos

- **R1** `w.invariants = { totalMoney }` gravado na criação; `advance()` e `execute()` verificam a soma dos saldos ao fim (sempre em testes e no lab; em produção atrás de `AFTERMARKET_CHECK_INVARIANTS=1` por custo). Falha lança erro com o comando/evento culpado e o delta.
- **R2** Comando de bot dentro do tick: validar tudo antes de mutar (padrão validate → commit) ou executar sobre cópia rasa das entidades tocadas e aplicar no fim. No mínimo: `escrowReserved` zerado só depois das transferências; nenhum `ensure` após a primeira mutação em `dispatch`.
- **R3** Erro de dados (`TypeError`) num bot ou numa política de suprimento é capturado, registrado (`botActivity` + `console.error` com ids) e não derruba o tick; o bot pula a rodada.
- **R4** Fila de eventos: `w.events` (ou índice derivado por revisão) ordenada por instante; `advance()` tira o próximo em O(log n); remessas, lotes e treinos inserem ao criar. Sem `Math.min(...spread)`.
- **R5** Históricos por janela de tempo: `supplyHistory`, `consumptionHistory`, `marketHistory`, `botActivity` cortados por `at >= now − N dias de jogo` (N na temporada), e `supplySpent` passa a ser contador diário por estabelecimento em vez de scan.
- **R6** Nada de balanceamento muda: régua da 003 antes/depois idêntica (determinismo e números).

## Critérios de aceite

- **A1** Teste de propriedade: 2.000 comandos aleatórios válidos/inválidos sobre um mundo `baseline` → `totalMoney` constante e massa por produto (estoque + trânsito + lotes) consistente.
- **A2** Teste que injeta um `TypeError` num bot e verifica que o tick termina e os outros bots agem.
- **A3** Benchmark do lab (escala do playtest, 30 dias): tempo por dia ≤ 70% do anterior.
- **A4** Régua da 003 idêntica antes/depois.

## Fora de escopo

Quebrar `engine.ts` em módulos (spec própria depois da 006); índices de leitura por id (idem).
