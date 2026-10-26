# Roteiro por resultado jogável

| Fase                                    | Resultado                                              | Estado                            | Critério de saída                                                                                                         |
| --------------------------------------- | ------------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 01 · Fundação e fatia jogável           | Interface e fluxo financeiro/industrial local          | Entregue                          | Dez telas, transações, entrega, produção, fontes e testes                                                                 |
| 02 · Economia explicável e inteligência | Jogador entende custos, prazo e oportunidades internas | Entregue no laboratório           | BRL, configuração congelada, utilidades, fórmulas, animação, titularidade, filtros vazios e análise simples/avançada      |
| 03 · Mundo autenticado                  | Dois jogadores disputam mercado com autorização real   | Planejada                         | Identidade, permissões, PostgreSQL/PostGIS, migração e concorrência entre conexões                                        |
| 04 · Geografia de produção              | Propriedades e rotas verificadas em SP–MG              | Planejada                         | Validação territorial, Valhalla truck, orçamento de tiles e cache                                                         |
| 05 · Economia sustentável               | Duas cadeias completas, consumo final e recuperação    | Próxima frente de design/playtest | Fechar oferta/demanda de duas cadeias, recircular recursos, recuperar insolvência, teste de 30 dias sem ruptura sem saída |
| 06 · Operação empresarial               | Expansão e automação reduzem repetição                 | Parcial                           | Reposição de lojas entregue; faltam aluguel, contratos, especialização, equipamentos e recursos humanos                   |
| 07 · Alpha fechada                      | Mundo recuperável sob carga medida                     | Planejada                         | Backups restaurados, observabilidade, migração relacional, playtests e desempenho                                         |

## Prioridade definida em 26/10/2026

O usuário antecipou a fase 02 de economia/UX. A antiga fase de autenticação passa a 03; nenhuma implementação autenticada foi descartada ou declarada pronta. A frente econômica pode ser testada localmente antes da identidade pública, mas autenticação e persistência relacional continuam obrigatórias antes de qualquer lançamento.

A simulação de 30 dias conserva dinheiro e movimenta agentes, mas esgota feijão e leite. A próxima decisão de design é fechar duas cadeias, explicitar recuperação de caixa e separar terreno/instalação/contratação. Evitar novos setores até validar essas saídas. Ver `docs/product/GAME-DESIGN-AUDIT.md`.

Para a fase 03: manter comandos financeiros, separar identidade de desenvolvimento, introduzir repositórios relacionais com restrições e bloqueio de estoque. Migrar preservando o laboratório e validar concorrência por lote/imóvel em duas conexões independentes.

Fontes externas calibram apenas a abertura e futuras temporadas. Nunca corrigir rupturas conectando cotações externas ao motor durante uma season.
