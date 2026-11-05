# Tarefas 013

- [x] T1 Pausa de mundo ocioso (R1, A4): `store.ts` (`pauseWhenIdleMs`, `atividade`, `parado`),
      `index.ts`, `World.pausedMs`, `apps/web/src/lib/clock.ts` (`agora()`). Teste
      `tests/idle-pause.test.ts`.
- [x] T2 Linha do dia (R2, A1, A2, A3, A5): `engine.ts` `dailyBook`/`accrue`, `Entry.daily`;
      gravador regrava a linha trocada (`world-storage.ts`, `conhecer`). Teste
      `tests/daily-costs.test.ts`. Medido com a 006: 47.196 → 16.544 linhas por dia (−65%);
      prova A/B com JSON idêntico (rodada da virada em linha própria).
- [x] T3 Registros encerrados gravados uma vez (R3): formato 2 em `world-storage.ts`, backup
      `pre-frozen-storage` antes de migrar.
- [x] T4 `PRAGMA journal_size_limit` (R4).
- [x] T5 Régua do clique (R5): `scripts/perf-click.ts`, `npm run perf:click`, `Server-Timing`.
- [x] T6 Linha de base no SSD e no HD em `validation.md` (A6): clique p50 289 ms no SSD e
      1.501 ms no HD; a gravação é a maior parte.
- [ ] T7 Revisão do John no PR.
