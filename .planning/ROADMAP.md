# Roteiro por resultado jogável

| Fase                          | Resultado                                                              | Estado    | Critério de saída                                                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 · Fundação e fatia jogável | Interface fiel e fluxo financeiro/industrial local                     | Entregue  | Dez telas, transações, entrega, produção, testes e fontes preservadas                                                                       |
| 02 · Mundo autenticado        | Dois jogadores distintos disputam o mesmo mercado com autorização real | Próxima   | Autenticação, permissões, migração PostgreSQL/PostGIS, idempotência e teste concorrente entre conexões independentes                        |
| 03 · Geografia de produção    | Propriedades e rotas verificadas em SP–MG                              | Planejada | Lotes sem interseções proibidas, malhas versionadas, Valhalla truck, volume de mapas orçado e cache próprio                                 |
| 04 · Economia viva            | Bots e humanos sustentam duas cadeias completas                        | Planejada | Aço → componente; soja → óleo → varejo; bots compram/vendem/transportam com custos; demanda realimentada; transportador humano aceita carga |
| 05 · Operação empresarial     | Expansão e automação reduzem trabalho repetitivo                       | Planejada | Aluguel, contratos, estoques mínimos, rotas internas, capacidade e recursos humanos                                                         |
| 06 · Alpha fechada            | Mundo persistente recuperável sob carga de teste                       | Planejada | Observabilidade, backups restaurados, migração validada, falhas recuperáveis, playtest e desempenho medidos                                 |

## Próxima fase: 02

Manter a interface e os comandos econômicos. Separar a identidade de desenvolvimento da identidade autenticada. Introduzir repositórios relacionais com restrições únicas, bloqueio de estoque e transações por pedido. Criar migração que preserve o estado do laboratório. Validar a mesma disputa por propriedade e o mesmo lote em dois clientes independentes.

**Não misturar na fase 02:** novos setores, chat social, 3D, mais receitas ou telas decorativas. O resultado é confiança no mundo compartilhado.
