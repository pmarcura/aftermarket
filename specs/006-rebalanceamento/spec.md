# Spec 006 · Fechar exploits de preço e rebalancear a temporada

Estado: **verificada com dívida** (03/11/2026; ver `tasks.md`). R1, R2 e R6 ficam para a 006b. Branch `spec/006-rebalanceamento`. Parte do baseline oficial da escala 20 (`docs/product/PROVA.md`, código `aa35efc`).

## Problema

A régua honesta (spec 003) mostra que, na escala do playtest, a economia atual **não fecha** e tem brechas que um jogador humano acharia em uma hora:

| Sintoma (mediana, escala 20)               | Hoje              | Alvo    |
| ------------------------------------------ | ----------------- | ------- |
| Procura atendida pelas lojas               | 45%               | ≥ 55%   |
| Aço entregue ao governo (t/dia)            | 180               | ≥ 256   |
| Lucro/linha ÷ projeto fora de 0,8–1,2      | 12 de 13 receitas | 0       |
| Esmagamento de soja: observado ÷ projeto   | 9,0               | 0,8–1,2 |
| Utensílios: observado ÷ projeto            | 2,9               | 0,8–1,2 |
| Aço em alto-forno: observado ÷ projeto     | 2,2               | 0,8–1,2 |
| Caminhão leve: observado ÷ projeto         | 0,07 (prejuízo)   | 0,8–1,2 |
| Sucata de aço: concentração (HHI)          | 4.169             | < 2.500 |
| Produtos com estoque fora de 1–7 dias      | 7                 | 0       |
| Falhas da calculadora (`knownBalanceDebt`) | 24                | 0       |

Leitura para o jogador: quem compra soja e esmaga ganha 9× o que a conta promete; quem monta caminhão leve perde dinheiro; metade da demanda das lojas fica sem atendimento porque ninguém expande. Não é um jogo com decisões, é uma planilha com uns poucos ganhadores óbvios.

Brechas de preço conhecidas no código:

- `opening-v2.ts:146`: bot paga até **1,5×** o preço-base por insumo (`maxPrice`). Quem vende para bot cobra o teto.
- `director.ts:568`: pedido aberto do bot sai ao `maxPrice` da regra, sem negociar.
- `engine.ts:1810`: `governmentBonus` 1,25 paga 25% acima do atacado em programas do governo.
- Nenhum limite de participação: um grupo pode ficar com 100% de um produto.
- Bots nunca expandem: a oferta não acompanha a procura.

## Requisitos

- **R1 Fechar os tetos de preço.** `maxPrice` dos bots passa de 1,5× para 1,15× a referência de atacado do produto; pedido aberto usa o mesmo teto; `governmentBonus` 1,25 → 1,10. Valores em `season.config`, não no código.
- **R2 Teto de participação.** Nenhum grupo vende mais de 40% do volume de um produto no atacado na janela de 7 dias de jogo; acima disso, novos lotes dele perdem prioridade nas ofertas de bots (humanos recebem aviso, sem bloqueio).
- **R3 Bots que expandem.** Bot com caixa acima de N dias de custo fixo e utilização da especialidade ≥ 90% compra uma linha a mais (mesmo comando `buyEquipment` dos humanos). Bot com utilização < 50% por 14 dias não repõe equipamento.
- **R4 Calculadora fecha.** `knownBalanceDebt` vazia: as 13 receitas passam em margem ≥ 15%, lucro ≥ 1,5× fixo, retorno 20–60 dias. Ajustes em preços de referência e custos fixos, sempre pelo catálogo (`RESOURCE-STANDARD.md`; `npm run resources:check`).
- **R5 Observado ≈ projeto.** Lucro/linha observado ÷ projeto entre 0,8 e 1,2 em todas as receitas, mediana e pior caso (alvo da 003).
- **R6 Temporada versionada.** Os valores finais ficam na temporada `balance/season-2026-01`, congelada por mundo. Mundos existentes não mudam (a temporada vem do mundo, não do código).
- **R7 Testes de adversário.** Agentes automáticos que tentam: revender no atacado entre empresas do mesmo grupo, vender ao governo acima da referência, acumular 100% de um produto, esvaziar um bot cobrando o teto. Cada tentativa tem de ter retorno ≤ o do jogador médio.

## Critérios de aceite

- **A1** Prova escala 20 (5 sementes, 60/30, workflow "Prova econômica"): todo KPI com alvo na mediana **e** pior caso dentro; senão, a regra da constituição §5 (mediana melhora, pior caso não piora) com a lista do que sobrou e porquê.
- **A2** `knownBalanceDebt` vazia e o teste exige lista vazia.
- **A3** Testes de adversário (R7) verdes e `moneyDrift = 0` em todas as sementes.
- **A4** Prova escala 1 sem regressão (mundo `baseline` de testes continua idêntico até o passo que muda a temporada).
- **A5** `npm run check`, e2e e `prettier --check .` verdes.

## Fora desta spec

Genética, gado, leilões, contratos recorrentes, frete de jogador, modelo de grupo completo (D-042).
