# Plan 006 · Rebalanceamento

## Método

Uma alavanca por vez, sempre medindo: mexer → prova escala 1 local (rápida) → a cada 2–3 alavancas, prova escala 20 no Actions. Regra de aceite da constituição §5. Nada de afinar números "a olho": cada mudança tem o KPI que ela deve mover escrito antes.

## Ordem (maior distorção primeiro)

1. **Teste de adversário primeiro (R7).** Escrever os agentes antes de consertar: eles têm de falhar hoje (prova de que pegam as brechas) e passar no fim.
2. **Tetos de preço (R1).** `maxPrice` 1,15×, pedido aberto, `governmentBonus` 1,10. Esperado: realizado ÷ referência cai para 0,95–1,05; esmagamento, aço e utensílios deixam de ser ouro.
3. **Calculadora (R4).** Com os preços de referência já corrigidos, ver o que ainda falha dos 24 itens; ajustar custos fixos e preços-base do catálogo. Prioridade: caminhão leve, óleo de soja, ração, arroz/feijão/açúcar (lucro baixo demais) e minério/carvão.
4. **Teto de 40% (R2).** Mede a concentração da sucata de aço (HHI 4.169).
5. **Bots que expandem (R3).** Só depois de preço certo; senão expandem para onde o exploit paga. Alvo: procura atendida ≥ 55% e aço ao governo ≥ 256 t/dia.
6. **Temporada `balance/season-2026-01` (R6).** Congelar valores; migração explícita (backup antes, nunca apagar mundo).
7. **Prova final** escala 20, 5 sementes; PROVA.md oficial.

## Riscos

- Mexer em preço muda a lucratividade de tudo: pode virar gangorra (consertar um, quebrar outro). Mitigação: prova de escala 1 a cada passo e registro do antes/depois por receita.
- Bots que expandem aumentam o custo de simulação; conferir A1 da spec 005 (custo por dia estável).
- Escala 20 só roda no Actions (~horas): agrupar mudanças por rodada.
