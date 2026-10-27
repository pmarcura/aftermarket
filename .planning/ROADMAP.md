# Roteiro por resultado jogável

| Fase                                    | Resultado                                              | Estado                            | Critério de saída                                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------ | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 · Fundação e fatia jogável           | Interface e fluxo financeiro/industrial local          | Entregue                          | Dez telas, transações, entrega, produção, fontes e testes                                                                                            |
| 02 · Economia explicável e inteligência | Jogador entende custos, prazo e oportunidades internas | Entregue no laboratório           | BRL, configuração congelada, utilidades, fórmulas, animação, titularidade, filtros vazios e análise simples/avançada                                 |
| 03 · Mundo autenticado                  | Dois jogadores disputam mercado com autorização real   | Planejada                         | Identidade, permissões, PostgreSQL/PostGIS, migração e concorrência entre conexões                                                                   |
| 04 · Geografia de produção              | Propriedades e rotas verificadas em SP–MG              | Planejada                         | Validação territorial, Valhalla truck, orçamento de tiles e cache                                                                                    |
| 05 · Economia sustentável               | Consumo final, liquidez e recuperação                  | Próxima frente de design/playtest | Contas estaduais e compras públicas entregues; faltam recuperação, defesa de referência e teste de 90 dias                                           |
| 06 · Operação empresarial               | Expansão e automação reduzem repetição                 | Parcial                           | Pedidos/negociação, transferências, produção/suprimento, capacidade, educação e bots entregues; faltam aluguel, contratos recorrentes e equipamentos |
| 07 · Alpha fechada                      | Mundo recuperável sob carga medida                     | Planejada                         | Backups restaurados, observabilidade, migração relacional, playtests e desempenho                                                                    |

## Prioridade definida em 26/10/2026

O usuário antecipou a fase 02 de economia/UX. A antiga fase de autenticação passa a 03; nenhuma implementação autenticada foi descartada ou declarada pronta. A frente econômica pode ser testada localmente antes da identidade pública, mas autenticação e persistência relacional continuam obrigatórias antes de qualquer lançamento.

A simulação 0.3.0 de 30 dias conserva dinheiro e termina com oferta nos dez produtos. Trinta novos concorrentes participam, 28 mantêm operação ativa; duas indústrias pausam por falta de caixa. Compras públicas recirculam parte da arrecadação estadual. Priorizar recuperação, referência pública resistente a conluio e cenário iniciante; ainda não há prova de equilíbrio de uma season pública. Ver `docs/product/GAME-DESIGN-AUDIT.md`.

Para a fase 03: manter comandos financeiros, separar identidade de desenvolvimento, introduzir repositórios relacionais com restrições e bloqueio de estoque. Migrar preservando o laboratório e validar concorrência por lote/imóvel em duas conexões independentes.

Fontes externas calibram apenas a abertura e futuras temporadas. Nunca corrigir rupturas conectando cotações externas ao motor durante uma season.

## Frente 06 antecipada · 0.3.0

Pedidos e contrapropostas de humanos/bots, abastecimento completo, transferências próprias, equipe/educação, logística por pedido e licitações estaduais foram antecipados pelo usuário. Ver planos e validação em `phases/06-business-operations`. Nenhuma dessas entregas substitui autenticação/persistência da fase 03.
