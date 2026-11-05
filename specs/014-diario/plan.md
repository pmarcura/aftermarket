# Plano 014 · Diário + foto

1. `packages/simulation/src/ids.ts`: `newId(w)` no lugar de `randomUUID()` em `engine.ts`,
   `competition.ts`, `scenarios.ts` e `lab-experiments.ts`. Prova A/B antes de seguir.
2. `world-storage.ts`:
   - `JournalEntry`, `JOURNAL_TABLE`, `readJournalSeq` e `readJournal`;
   - a foto grava `journalSeq`;
   - `rollbackSnapshot` com cópia rasa dos históricos que só crescem.
3. `store.ts`:
   - `aplicar(entry)` é a única porta de mudança vinda de fora, usada ao vivo e ao repetir;
   - o comando grava a linha + o recibo;
   - `tick` anota a rodada e decide a foto;
   - `writeWorld` é a foto (arquiva, grava e apaga o diário coberto);
   - `abandonar()` simula queda nos testes.
4. Testes: `tests/journal.test.ts` (queda e reabertura idêntica, recibo, recusa, foto limpa o
   diário); `operation-reliability` compara o mundo depois da foto.
5. Medir com `npm run perf:click` no SSD e no HD e registrar em `validation.md`.

## Riscos

- **Repetição diferente do ao vivo** se o motor ganhar outra fonte de acaso ou de relógio. A
  conferência do dinheiro na abertura recusa o mundo repetido, e o teste A2 roda no `npm test`.
- **Atualização de versão com diário pendente:** o diário é repetido com o código novo. Para trocar
  de versão, desligar o servidor normalmente (a foto ao desligar deixa o diário vazio).
- **`synchronous=FULL`** continua: cada linha de diário faz um fsync (30 ms p50 no HD). Para
  servidor hospedado, `NORMAL` em WAL perderia só a última transação numa queda de energia;
  decisão do John.
