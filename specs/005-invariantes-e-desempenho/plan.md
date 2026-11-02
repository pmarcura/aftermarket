# Plan 005 · Invariantes e desempenho

## Princípio

Esta spec muda **quanto custa** simular, não **o que acontece**. A régua de não regressão é a impressão digital da 003 (sha256 do `World` inteiro após N dias com ids trocados por contador) mais o JSON da prova: os dois têm de ficar idênticos ao `main` em todo passo que toca o motor. O tempo é medido com o progresso a cada 5 dias que a prova já imprime.

## Passos

### 0 · Régua e medição de partida

- Impressão digital e JSON de `main` (`66fdc57`): escala 1, 20 dias, semente 0; escala 20, 5 dias, semente 0.
- Tempo de partida: escala 20, semente 0, 15 dias, um processo sozinho (referência já medida: 68 s / 272 s / 690 s nos dias 5 / 10 / 15).
- Perfil de CPU guardado para comparar depois (`node --cpu-prof --import tsx scripts/economy-proof.ts …`).

### 1 · Índices (R1) — o ganho principal

- Novo módulo `packages/simulation/src/indexes.ts`: índices derivados do `World`, guardados em `WeakMap<World, …>` (padrão de `metrics.ts`), atualizados **incrementalmente**: cada lista (`shipments`, `jobs`, `orders`) guarda até que posição já foi indexada; ao consultar, indexa só o que foi acrescentado; itens entregues/concluídos/fechados são filtrados na leitura (as flags mudam no lugar) e podados periodicamente. Se a identidade da lista mudar (arquivamento troca o array), o índice é refeito do zero.
- Consultas: `openShipmentsTo(w, destinationId, product?)`, `openJobsAt(w, establishmentId)`, `pendingOrdersTo(w, destinationId, product)`, e o que mais o perfil apontar.
- Trocar as varreduras em `runSupplyPolicies` (`supply.ts:511-524`), `supply.ts:96`, `:356`, `:385-388`, `committedStorage`/`storageQuantity` (`transport.ts`), e os pontos de `engine.ts`/`director.ts` que aparecerem no perfil depois da primeira troca. Um arquivo por commit, régua idêntica a cada um.
- Cuidado com a ordem: onde o código antigo dependia da ordem do `filter` (soma é comutativa, mas `find`/primeiro elemento não), o índice preserva a ordem de inserção.
- Medir de novo e repetir o perfil: se outra função passar a dominar (ex.: `updateWages`, `actorState`, `supplyCandidates`), tratar só se for barata e segura; registrar o resto.

### 2 · `advance` (R6)

- Trocar `Math.min(...spread)` por laço sobre os índices de remessas/lotes/treinos abertos. Régua idêntica.

### 3 · Invariantes (R3, R4, R5)

- `w.invariants = { totalMoney }` na criação (e na migração de mundos existentes, calculado do estado salvo). `assertMoney(w, contexto)`.
- `dispatch`: mover `order.escrowReserved = 0` para depois das transferências; revisar se há outro `ensure` depois de mutação (listar no `tasks.md`).
- `attempt`/`act`/`executeSupply`: capturar erro não-`RuleError`, registrar em `botActivity` com ids e seguir.
- Testes A3 e A4.

### 4 · Históricos por tempo (R7)

- `season.config.history.windowDays` (padrão: o que preserva os números atuais; medir) e cortes por `at`. `supplySpent` por contador diário.
- Rodar a régua: se mudar, parar e trazer a diferença (é mudança de comportamento dos bots, não só de desempenho).

### 5 · Fechamento

- A1 medido; A2 régua; A5 verde; atualizar `docs/design/DEVELOPMENT-LAB.md` com o novo custo por dia.

## Riscos

- **Índice desatualizado** dentro da mesma rodada (compra feita por uma regra precisa aparecer para a próxima regra do mesmo estabelecimento): por isso indexação incremental na leitura, não cache por rodada.
- **Arquivamento troca as listas** (`archiveHistory`): detectar por identidade do array.
- **R7 pode mudar decisões** dos bots (o corte por contagem já influenciava): separado no fim e com parada obrigatória.

## Decisões técnicas reversíveis

1. Índices derivados em `WeakMap`, fora do JSON salvo (não mudam o formato do mundo).
2. Verificação de invariante desligada por padrão em produção.
