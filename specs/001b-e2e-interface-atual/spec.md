# Spec 001b · Testes de navegador alinhados à interface atual

Estado: **aprovada** (John, 01/11/2026). Branch `spec/001b-e2e-interface-atual`. Pendência registrada na 001.

## Problema

O job "Navegador (Chromium)" da CI falha no `main` (`adba910`) com 9 de 27 testes. Nenhuma falha é defeito do jogo: 7 testes descrevem a interface anterior ao redesenho de 29/10 (seletor "Produto" no Comércio, `summary` "Contratos de infraestrutura", aba "Estoque", título "Caixa, compromissos e recuperação", `data-map-ready`, marcador de caminhão por `data-shipment-id`, contagem "Recebimentos não lidos") e 2 usam lotes/estabelecimentos do mundo antigo (`newindustry`, `e-industry` do jogador) que o mundo `playtest` não tem. Com o `main` vermelho, a CI deixa de servir como sinal.

Falhas: `animation.spec.ts:5`, `business.spec.ts:15`, `design.spec.ts:9`, `design.spec.ts:88`, `economic-flow.spec.ts:4`, `intelligence.spec.ts:3`, `procurement.spec.ts:6`, `transport.spec.ts:7`, `transport.spec.ts:118`.

## Requisitos

- **R1** O servidor dos testes de navegador abre um mundo com o que os testes precisam, de forma explícita (`AFTERMARKET_SCENARIO` no `webServer` do `playwright.config.ts`, ou montagem pelos próprios testes via comandos), nunca dependendo de ids que só existiam na economia 1.
- **R2** Cada um dos 9 testes é reescrito para o fluxo equivalente da interface atual, preservando a intenção (o que ele prova para o jogador), ou removido quando a função não existe mais na interface — com uma linha no `tasks.md` dizendo o motivo e onde a regra continua coberta (teste de motor ou outro e2e).
- **R3** Preferir seletores por papel e nome acessível (`getByRole`) e o padrão de mundo montado no próprio teste de `opening.spec.ts`; evitar esperar rodadas econômicas reais quando o objetivo é só verificar a tela.
- **R4** Nada muda na interface nem no motor para "fazer o teste passar". Se um teste revelar defeito real da interface, registrar no `tasks.md` como achado (não corrigir aqui).

## Critérios de aceite

- **A1** `npx playwright test` em Chromium, sem rede externa: 0 falhas, localmente e no job "Navegador (Chromium)" da CI.
- **A2** `npm run check` e `prettier --check .` verdes.
- **A3** Duração do e2e ≤ a atual (7,3 min na CI).
