# Tarefas 014

- [x] T1 Códigos determinísticos (R1, A1): `ids.ts`, `World.idSeq`; prova A/B com 0 diferenças.
- [x] T2 Diário (R2): `world_journal` com `AUTOINCREMENT`; comando + recibo na mesma transação;
      rodada, rota, acesso e pausa anotados; falha de gravação do diário vira foto.
- [x] T3 Foto (R3): `writeWorld` grava `journalSeq`, arquiva e apaga o diário coberto; a cada
      5 min, 2.000 linhas, ao pausar e ao desligar.
- [x] T4 Abertura (R4): repete o diário com `aplicar`, confere a soma do dinheiro e tira foto.
- [x] T5 Cópia rasa dos históricos que só crescem (R5): cópia para desfazer de 77 para 16 ms.
- [x] T6 Testes (A2–A4): `tests/journal.test.ts`.
- [x] T7 Medição (A5): gravação do clique 1.373 → 30 ms (p50) no HD.
- [x] T9 Continuidade com a foto (R6): `rev` em cada linha; teste de foto mais nova que o
      diário. Motivo: trocar o ramo da pasta com o servidor de design ligado rodou um código sem
      diário, que gravou foto por cima; ao voltar, o diário velho foi repetido sobre ela (as
      passagens de tempo foram recusadas, o dinheiro fechou).
- [x] T10 Migração explícita (R7): formato 3, backup `pre-journal-storage` antes de criar a
      tabela; mundo recusado não ganha a tabela. Revisão do PR #10.
- [ ] T8 Revisão do John no PR.
