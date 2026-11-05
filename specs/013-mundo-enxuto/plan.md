# Plano 013 · Mundo enxuto

Pedido do Pedro em 04/11/2026: o servidor de design caiu e os cliques demoravam ~1 s.
Medição no mundo `design-b` (escala 20, relógio 120×, ~650 estabelecimentos):

| Parte                                | Tamanho | Linhas  |
| ------------------------------------ | ------- | ------- |
| `history_ledger` (extrato arquivado) | 1,47 GB | 4,97 mi |
| `world_ledger` (extrato recente)     | 184 MB  | 611 mil |
| `history_shipments` + `history_jobs` | 262 MB  | 344 mil |
| Estado do mundo (`worlds.state`)     | 18 MB   | 1       |

Causa: `engine.ts` lança salário, manutenção, energia e água de cada estabelecimento
12 vezes por dia de jogo, uma linha cada (73% das últimas 200 mil linhas). Vendas ao
consumidor também viram uma linha por venda. A 120×, um dia real tem 120 dias de jogo:
~5,4 mi lançamentos e ~1,6 GB por dia real com o servidor ligado. O arquivo
(`history_*`) nunca é podado. A pasta `.runtime` chegou a 17 GB.

## Parte A · mundo de teste para quando ninguém joga (feito, aguardando revisão)

1. `createStore({ pauseWhenIdleMs })`: sem pedido do navegador por 3 min o relógio do
   mundo para; ao voltar, segue de onde parou. `World.pausedMs` guarda o tempo parado e o
   motor recebe `agora real − pausedMs` (o motor não muda).
2. Servidor desligado também conta como parado: ao abrir, o mundo não recupera as horas.
   Limite conhecido: recupera no máximo a rodada em curso, porque `updatedAt` marca o
   último evento.
3. Liga por padrão em todo `AFTERMARKET_DB_FILE` diferente de `.runtime/world.sqlite`;
   `AFTERMARKET_IDLE_PAUSE=0|1` força. O mundo principal continua andando sozinho.
4. Navegador: `lib/clock.ts` expõe `agora()` (relógio do mundo); prazos, chegadas e
   "há quanto tempo" usam ele.

Teste: `tests/idle-pause.test.ts` (para, não pula o tempo, reabre, e sem a opção nunca para).

## Parte B · extrato enxuto

5. **Feito.** Custos fixos (salário, manutenção, energia, água) continuam cobrados a cada
   rodada, mas o extrato tem uma linha por estabelecimento, natureza e dia de jogo
   (`Entry.daily`), que soma as rodadas. A rodada exatamente na virada do dia fica numa linha
   própria: o reajuste semanal de salários (`at >= updatedAt`) e a prova (`at > from`) recortam o
   extrato a partir de viradas e contam exatamente o mesmo de antes.
   - A linha é trocada por objeto novo, nunca alterada (o desfazer guarda o extrato por
     referência). O gravador lembra o objeto gravado dos últimos 2 dias e regrava o trocado
     (`UPDATE world_ledger ... WHERE id`), na mesma transação.
   - Energia e água de produção, motorista do frete e obrigações em atraso não mudam.
   - Medição e prova A/B (JSON idêntico) em `validation.md`.
   - Testes: `tests/daily-costs.test.ts` (uma linha por dia; saldo = extrato; regravação e
     reabertura iguais).
6. **Feito.** Vendas ao consumidor das lojas de bots: uma linha por loja, produto e dia, com
   quantidade somada e preço médio ponderado. Lojas de jogadores seguem com uma linha por
   rodada, porque a fita da loja (`Fita.tsx`) e os gráficos por hora usam esse detalhe.
   - Com os itens 5 e 6 e a spec 006: **47.196 → 16.544 linhas por dia (−65%)**.
   - O que sobra são eventos reais entre empresas: produção (operação, energia e água do
     lote), frete e motorista, pregão.
7. Negócios entre empresas (pregão, frete, contratos, ativos) seguem um a um.
8. `PRAGMA journal_size_limit=64 MB`: o arquivo `-wal` volta a encolher depois de cada
   checkpoint (o do `design-b` tinha 2,5 GB).

## Parte C · retenção do arquivo (proposta, precisa do John)

9. `history_ledger` guarda detalhe dos últimos 30 dias de jogo; o que é mais velho vira
   resumo por empresa, dia e tipo (o que gráficos e totais usam). Idem cargas e lotes:
   resumo por rota e produto por dia.
10. Migração explícita, backup antes, nunca apagar o mundo; `PRAGMA wal_checkpoint` após a
    compactação para o arquivo `-wal` não crescer junto.

Critério de saída: mundo de escala 20 com tamanho estável depois de 7 dias reais ligado,
clique abaixo de 200 ms, mesmas contas, `npm run check` verde.
