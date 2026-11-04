# Spec 014 · Diário + foto

Estado: **em revisão** (Pedro + Claude, 04/11/2026; revisão do John no PR). Ramo `spec/014-diario`,
empilhado sobre `design/estrutura-telas` (precisa das specs 012 e 013).

## Problema

A régua da 013 mostrou que regravar o mundo inteiro é a maior parte do clique: 179 ms no SSD e
1.373 ms no HD (p50, escala 20). O servidor também regravava tudo a cada 5 s. A cópia para desfazer
clonava históricos que só crescem (77 ms).

## Requisitos

- **R1 Códigos determinísticos.** Registros novos recebem `n-<contador>` do próprio mundo
  (`World.idSeq`, `ids.ts`), não um UUID sorteado. Era a única fonte de acaso do motor.
- **R2 Diário.** Tudo o que entra no mundo vindo de fora vira uma linha em `world_journal`
  (`seq` com `AUTOINCREMENT`, nunca reaproveitado):
  - comando aceito, na mesma transação do recibo;
  - passagem do tempo que mudou algo, inclusive a que falhou no meio;
  - rota recebida;
  - acesso às estradas;
  - mudança da pausa.

  Comando recusado não grava nada.

- **R3 Foto.** O mundo inteiro é gravado a cada 5 min, a cada 2.000 linhas, ao pausar e ao
  desligar. A foto guarda `journalSeq` e apaga, na mesma transação, as linhas que cobre. O
  arquivamento do histórico vencido acontece só na foto.
- **R4 Abertura.** O servidor lê a foto, repete o diário em ordem com as mesmas funções do jogo ao
  vivo, confere a soma do dinheiro e tira uma foto nova.
- **R5 Cópia para desfazer enxuta.** Históricos que só crescem (`marketHistory`,
  `consumptionHistory`, `supplyHistory`, `botActivity`) e `routes` entram por cópia rasa.
- **R7 Migração explícita (formato 3).** A tabela do diário só nasce depois da validação do mundo e
  do backup (`pre-journal-storage`); a foto grava `storageFormat: 3`. Código antigo, que lê até o
  formato 2, recusa abrir um mundo com diário em vez de gravar uma foto por cima dele.
- **R6 Continuidade com a foto.** Cada linha guarda a revisão do mundo logo antes dela. Ao abrir, só
  repete o que continua exatamente da foto. Foto mais nova que o diário (gravada por um código que
  não conhece o diário) descarta o diário velho com aviso; buraco no meio recusa abrir.

## Critérios de aceite

- **A1** `economy:proof` A/B com JSON idêntico, exceto o tempo de execução.
- **A2** Queda simulada (fechar sem foto) e reabertura: mundo idêntico (hash SHA-256) ao da memória
  depois do mesmo arquivamento.
- **A3** Recibo repetido depois da queda não executa de novo; comando recusado não deixa linha.
- **A4** Clique não regrava o mundo; a foto limpa o diário.
- **A5** `perf:click`: gravação do clique p50 abaixo de 50 ms no HD.

## Fora de escopo

Tirar a rodada econômica da fila dos cliques (spec 015) e resumir o histórico arquivado.
