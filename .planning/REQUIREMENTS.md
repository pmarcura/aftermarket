# Requisitos rastreáveis

Estados: **Implementado** = demonstrado no laboratório; **Parcial** = há base funcional e limite explícito; **Planejado** = não entregue.

| ID      | Requisito                                                    | Estado       | Evidência / próxima etapa                                                                |
| ------- | ------------------------------------------------------------ | ------------ | ---------------------------------------------------------------------------------------- |
| UX-01   | Seis destinos principais e dez telas de referência           | Implementado | Páginas React e testes de navegação                                                      |
| UX-02   | Fluxos com confirmação financeira e erro recuperável         | Implementado | Compra, frete, produção e preços                                                         |
| UX-03   | Layout desktop, navegação móvel e foco visível               | Implementado | CSS responsivo e testes em 1920/390 px                                                   |
| GEO-01  | Mapa navegável nacional com camadas                          | Implementado | MapLibre/OpenFreeMap; economia piloto                                                    |
| GEO-02  | Catálogo oficial de municípios e proveniência                | Implementado | 5.571 registros IBGE e hash de importação                                                |
| GEO-03  | Busca nacional, recortes e consultas territoriais            | Parcial      | Busca piloto e coordenadas; catálogo nacional importado                                  |
| GEO-04  | Lotes únicos, georreferenciados e sem sobreposição nacional  | Parcial      | Titularidade única; geração/validação PostGIS pendente                                   |
| GEO-05  | Rotas rodoviárias para cargas                                | Parcial      | OSRM automotivo + estimativa identificada; falta perfil de caminhão                      |
| ECO-01  | Compra transacional de propriedade                           | Implementado | SQLite, exclusividade e testes                                                           |
| ECO-02  | Estoque físico e custo médio                                 | Implementado | Reserva na origem, recebimento no destino, custo posto                                   |
| ECO-03  | Produção consumindo entradas e custos                        | Implementado | Aço, óleo de soja, soja e extração com reserva finita                                    |
| ECO-04  | Cadeias alimentar e industrial completas                     | Parcial      | Produção, comércio e varejo disponíveis; falta transformação do aço em produto de varejo |
| ECO-05  | Orçamento finito de consumo e concorrência por preço         | Implementado | Vendas por rodada, sem estoque negativo                                                  |
| ECO-06  | Demanda e oportunidades realimentadas por toda a economia    | Parcial      | Parâmetros iniciais claramente identificados                                             |
| ECO-07  | Bots completos com planejamento e todas as operações humanas | Parcial      | Recursos finitos, extração e produção; falta decisão comercial/expansão completa         |
| LOG-01  | Carga com origem, destino, massa, volume, prazo e custo      | Implementado | Cotação e remessa persistida                                                             |
| LOG-02  | Veículo ocupado, capacidade e chegada sem duplicação         | Implementado | Regras compartilhadas e testes                                                           |
| LOG-03  | Jogadores aceitam contratos de frete e rotas próprias        | Planejado    | Fase 04                                                                                  |
| FIN-01  | Transferências conservam dinheiro e geram histórico          | Implementado | Ledger, débito/crédito e exportação CSV                                                  |
| FIN-02  | Caixa, inventário, produção e resultado separados            | Implementado | Custo capitalizado e balanço do cenário                                                  |
| TIME-01 | Processamento offline persistente                            | Implementado | Eventos ordenados e equivalência online/offline                                          |
| MMO-01  | Múltiplos participantes no mesmo mundo                       | Parcial      | Duas contas locais; falta identidade autenticada                                         |
| MMO-02  | Isolamento de dados, autorização e acesso público            | Planejado    | Fase 02, pré-condição para publicação                                                    |
| SYS-01  | Idempotência e rollback transacional                         | Implementado | Receipts SQLite e testes                                                                 |
| SYS-02  | Migrações, recuperação e escala operacional                  | Parcial      | Backup consistente disponível; migrações/observabilidade pendentes                       |
| BIZ-01  | Aluguel e aquisição de operação com escopo detalhado         | Planejado    | Fase 05                                                                                  |
| BIZ-02  | Contratos recorrentes e automações com orçamento             | Planejado    | Fase 05                                                                                  |

O status implementado aqui se refere ao laboratório local. A aprovação de lançamento público exige critérios adicionais no roteiro.
