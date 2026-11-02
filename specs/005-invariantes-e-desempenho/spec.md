# Spec 005 · Invariantes em runtime e desempenho do motor

Estado: **verificada** (R7 retirado em 01/11/2026; ver `tasks.md`) (John, 01/11/2026). Branch `spec/005-invariantes-e-desempenho`. Passou à frente da 004 (decisão registrada na 003).

## Problema

**Desempenho.** Na escala do playtest (20, ~550 empresas), o custo de cada dia de jogo cresce com o tempo: 14 s/dia nos dias 1–5, 41 s/dia nos dias 6–10, 84 s/dia nos dias 11–15 (máquina de desenvolvimento, 2 núcleos). Uma prova de 60 dias passa de 1 h por semente, e o servidor do playtest faria o mesmo: cada rodada econômica bloquearia o processo por mais tempo a cada dia. Perfil de CPU de 12 dias (semente 0, escala 20), tempo inclusivo:

| Função                                        | Total | Próprio |
| --------------------------------------------- | ----: | ------: |
| `runSupplyPolicies` (`supply.ts:470`)         |   58% |     24% |
| `supplyCandidates`                            |   22% |      4% |
| `committedStorage` (`transport.ts:31`)        |   21% |     21% |
| `execute` → `dispatch` (compras da reposição) |   20% |       — |
| `runBotDirector`                              |   10% |      2% |
| `updateWages`                                 |    5% |       — |
| `advance` (busca do próximo evento)           |     — |      3% |

Causa: para cada estabelecimento com reposição (~500) e cada regra, `runSupplyPolicies` varre **todas** as remessas e **todos** os pedidos do mundo (`supply.ts:511-524`, idem `:96`, `:356`, `:385-388`); `committedStorage` varre todas as remessas e lotes a cada cotação de espaço. Remessas entregues ficam na lista até o arquivamento (15 dias de jogo), então o custo por rodada cresce dia a dia. A hipótese do rascunho (busca do próximo evento no `advance`) responde por 3%.

**Invariantes.** A conservação de dinheiro só é provada em testes. Comandos de bots dentro do tick não são atômicos (`dispatch` zera `order.escrowReserved` antes das transferências, `engine.ts:324`). Um `TypeError` num bot derruba a rodada inteira. `Math.min(...spread)` no `advance` estoura acima de ~65 mil itens. Históricos cortados por contagem (`supplyHistory.slice(-5000)`) deixam o orçamento diário de compras sem efeito com 500 empresas.

## Requisitos

- **R1 Índices nos caminhos quentes.** Remessas não entregues por destino (e por destino+produto), lotes abertos por estabelecimento e pedidos pendentes por destino+produto, mantidos de forma incremental (as listas só recebem itens no fim; entregas e conclusões mudam flags) ou reconstruídos por revisão, sem varrer as listas inteiras por estabelecimento. `runSupplyPolicies`, `supplyCandidates`, `committedStorage`/`storageQuantity`, o planejamento de reposição (`supply.ts:96`, `:356`, `:385`) e os pontos equivalentes de `engine.ts`/`director.ts` apontados pelo perfil passam a usar os índices.
- **R2 Determinismo e economia intactos.** Nenhuma regra muda. A régua de não regressão (escala 1, 20 dias, semente 0 e escala 20, 5 dias, semente 0) dá **resultado idêntico** ao `main` (JSON inteiro exceto `msPerDay`, mais a impressão digital do mundo usada na 003).
- **R3 Invariante de dinheiro em runtime.** `totalMoney` gravado na criação; verificação ao fim de `advance` e de `execute` sempre em testes e no lab, e em produção atrás de `AFTERMARKET_CHECK_INVARIANTS=1`. Falha lança erro com o comando/evento e o delta.
- **R4 Comandos de bots atômicos.** Em `dispatch`, nenhuma mutação antes da última verificação (`escrowReserved` zerado depois das transferências). Comando de bot/reposição que falhar não deixa estado parcial (validar antes de mutar, ou aplicar sobre cópia rasa do que é tocado).
- **R5 Erro isolado.** `TypeError` (ou qualquer erro que não seja `RuleError`) num bot ou numa política de reposição é registrado com ids e não derruba o tick; o bot pula a rodada.
- **R6 `advance` sem `Math.min(...spread)`.** Laço simples ou fila ordenada; sem limite de argumentos.
- **R7 Históricos por tempo.** _(Retirado em 01/11/2026: a medição mostrou que o corte por contagem nunca descartou dado usado por decisão de bot; ver `tasks.md` T7.)_ `supplyHistory`, `consumptionHistory`, `marketHistory` e `botActivity` cortados por janela de dias de jogo (na temporada); `supplySpent` vira contador diário por estabelecimento. Se isso mudar algum número da régua (porque o corte por contagem já alterava decisões), registrar a diferença e decidir antes de aceitar.

## Critérios de aceite

- **A1** Escala 20, semente 0, um processo sozinho na máquina de desenvolvimento: custo por dia de jogo nos dias 11–15 ≤ 1,5× o dos dias 1–5 (hoje 6×), e 20 dias em ≤ 40% do tempo atual (hoje ~1.000 s).
- **A2** Régua de não regressão idêntica (R2).
- **A3** Teste de propriedade: 2.000 comandos aleatórios (válidos e inválidos) sobre o mundo `baseline` → `totalMoney` constante e massa por produto (estoque + trânsito + lotes) consistente.
- **A4** Teste que injeta um `TypeError` num bot e verifica que o tick termina e os outros bots agem.
- **A5** `npm run check`, e2e e `prettier --check .` verdes.

## Fora de escopo

Quebrar `engine.ts` em módulos; mudar regras ou parâmetros; servidor (view, serialização).
