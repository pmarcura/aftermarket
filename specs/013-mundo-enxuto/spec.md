# Spec 013 · Mundo enxuto

Estado: **em revisão** (Pedro + Claude, 04/11/2026; revisão do John no PR). Ramo `design/estrutura-telas`
(depende da 012, que só existe neste ramo).

## Problema

O servidor de design caiu e cada clique levava de 1 a 40 segundos. Medido no mundo `design-b`
(escala 20, relógio 120×):

- O extrato crescia ~5,4 milhões de linhas e ~1,6 GB por dia real com o servidor ligado. A causa
  era cada estabelecimento lançar salário, manutenção, energia e água 12 vezes por dia de jogo,
  uma linha cada (73% do extrato), mais uma linha por venda das lojas de bots.
- Mundos de teste esquecidos ligados no relógio rápido rodavam sozinhos o dia inteiro.
- A cada clique e a cada 5 s, o servidor regravava o mundo inteiro, inclusive registros que nunca
  mais mudam (cargas entregues, lotes concluídos, pedidos encerrados).
- O arquivo `-wal` do SQLite nunca encolhia (2,5 GB).
- Não havia régua para o tempo do clique; só para a economia.

## Requisitos

- **R1 Mundo de teste para quando ninguém joga.** Sem pedido do navegador por 3 min, o relógio
  do mundo para; ao voltar, segue de onde parou, sem recuperar o tempo parado. Servidor desligado
  conta como parado. Vale para todo `AFTERMARKET_DB_FILE` diferente de `.runtime/world.sqlite`;
  `AFTERMARKET_IDLE_PAUSE=0|1` força. O motor recebe o instante já descontado (`World.pausedMs`).
- **R2 Linha do dia.** Custos fixos e vendas ao consumidor das lojas de bots têm uma linha por
  estabelecimento, natureza (e produto) e dia de jogo, somando as rodadas. O dinheiro continua
  andando a cada rodada. Lojas de jogadores mantêm uma linha por rodada (a fita da loja).
- **R3 Registros encerrados gravados uma vez** (armazenamento formato 2), com backup antes da
  migração e leitor dos formatos 0, 1 e 2.
- **R4 `-wal` limitado** a 64 MB depois de cada checkpoint.
- **R5 Régua do clique.** `npm run perf:click` mede cada etapa num mundo de referência fixo, e o
  servidor manda `Server-Timing` em `/api/commands` e `/api/world`, anotando no log os cliques
  acima de 500 ms.

## Critérios de aceite

- **A1** Prova econômica A/B (`economy:proof --days=20 --window=10 --seeds=0,1`, código antes ×
  depois): resultado idêntico, exceto o tempo de execução.
- **A2** Saldo de cada empresa = saldo inicial + extrato, centavo por centavo (teste).
- **A3** Mundo gravado, reaberto e relido igual ao da memória, inclusive linhas do dia regravadas.
- **A4** Pausa: para, não pula o tempo parado, reabre igual; sem a opção nunca para (teste).
- **A5** Linhas por dia de jogo no playtest escala 20 caem pelo menos 60%.
- **A6** `perf:click` registra a linha de base no SSD e no HD em `validation.md`.

## Fora de escopo

Diário de comandos e foto periódica (spec 014), simulação em processador separado (015), resumo
do histórico arquivado (parte C, depois da 014).
