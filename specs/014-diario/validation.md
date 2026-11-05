# Validação 014

## A1 · Economia idêntica (04/11/2026)

`economy:proof --days=20 --window=10 --seeds=0,1`, código `1ba10e7` (sem a 014, worktree limpo) ×
códigos determinísticos: **0 diferenças** fora do tempo de execução.

## A2–A4 · Testes

`tests/journal.test.ts`:

- **Queda sem foto e reabertura:** o mundo repetido tem o mesmo hash SHA-256 do mundo da memória
  (depois do mesmo arquivamento), com comandos, rodadas econômicas, bots e rota. A foto seguinte
  reabre igual.
- **Recibo e recusa:** o mesmo recibo depois da queda não cobra de novo, e o comando recusado não
  grava linha.
- **Foto:** o clique não muda a foto gravada, e a foto limpa o diário.

Bateria inteira: 42 arquivos, 283 testes.

## A5 · Clique (`npm run perf:click`, escala 20, 7 dias, 56 cliques)

p50 / p95 em ms:

| Etapa                            | SSD 013         | SSD 014           | HD 013            | HD 014            |
| -------------------------------- | --------------- | ----------------- | ----------------- | ----------------- |
| Cópia para desfazer              | 77 / 87         | 16 / 19           | 78 / 121          | 16 / 19           |
| Avanço do tempo (rodada no meio) | 4 / 255         | 3 / 236           | 4 / 323           | 3 / 254           |
| **Gravação**                     | 179 / 290       | **2 / 4**         | 1.373 / 2.451     | **30 / 119**      |
| Resposta (vista)                 | 26 / 33         | 24 / 32           | 31 / 49           | 25 / 29           |
| **Clique inteiro**               | 289 / 644       | **47 / 283**      | 1.501 / 2.815     | **123 / 380**     |
| Foto do mundo inteiro (p95)      | a cada 5 s: 272 | a cada 5 min: 235 | a cada 5 s: 2.220 | a cada 5 min: 701 |

Leitura: a gravação do clique caiu 90× no SSD e 45× no HD. O p95 que sobra é a rodada econômica
caindo no meio do clique (~0,25 s); a spec 015 tira a rodada da fila dos cliques. A foto do mundo
inteiro continua custando o mesmo, mas acontece 60× menos.
