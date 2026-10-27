# Requisitos rastreáveis

Estados: **Implementado** = demonstrado no laboratório; **Parcial** = há base funcional e limite explícito; **Planejado** = não entregue.

| ID      | Requisito                                                    | Estado       | Evidência / próxima etapa                                                                                                                     |
| ------- | ------------------------------------------------------------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| UX-01   | Seis destinos principais e dez telas de referência           | Implementado | Páginas React e testes de navegação                                                                                                           |
| UX-02   | Fluxos com confirmação financeira e erro recuperável         | Implementado | Compra, frete, produção e preços                                                                                                              |
| UX-03   | Layout desktop, navegação móvel e foco visível               | Implementado | CSS responsivo e testes em 1920/390 px                                                                                                        |
| GEO-01  | Mapa navegável nacional com camadas                          | Implementado | MapLibre/OpenFreeMap; malha viária e natureza, sem aeroportos/prédios/rótulos; D-014 e validação 26/10                                        |
| GEO-02  | Catálogo oficial de municípios e proveniência                | Implementado | 5.571 registros IBGE e hash de importação                                                                                                     |
| GEO-03  | Busca nacional, recortes e consultas territoriais            | Parcial      | Busca piloto e coordenadas; catálogo nacional importado                                                                                       |
| GEO-04  | Lotes únicos, georreferenciados e sem sobreposição nacional  | Parcial      | Titularidade única; geração/validação PostGIS pendente                                                                                        |
| GEO-05  | Rotas rodoviárias para cargas                                | Parcial      | OSRM automotivo + estimativa identificada; falta perfil de caminhão                                                                           |
| ECO-01  | Compra transacional de propriedade                           | Implementado | SQLite, exclusividade e testes                                                                                                                |
| ECO-02  | Estoque físico e custo médio                                 | Implementado | Reserva na origem, recebimento no destino, custo posto                                                                                        |
| ECO-03  | Produção consumindo entradas e custos                        | Implementado | Aço, óleo de soja, soja e extração com reserva finita                                                                                         |
| ECO-04  | Cadeias alimentar e industrial completas                     | Parcial      | Produção, comércio e varejo disponíveis; falta transformação do aço em produto de varejo                                                      |
| ECO-05  | Orçamento finito de consumo e concorrência por preço         | Implementado | Vendas por rodada, sem estoque negativo                                                                                                       |
| ECO-06  | Demanda e oportunidades realimentadas por toda a economia    | Parcial      | Preços/estoque/negócios observados, demanda modelada, histórico interno e mapa por item; equilíbrio integral pendente                         |
| ECO-07  | Bots completos com planejamento e todas as operações humanas | Parcial      | 30 novos bots, pedidos/contrapropostas, reposição, produção, preço, educação, editais e expansão heurística; planejamento estratégico parcial |
| LOG-01  | Carga com origem, destino, massa, volume, prazo e custo      | Implementado | Cotação e remessa persistida                                                                                                                  |
| LOG-02  | Veículo ocupado, capacidade e chegada sem duplicação         | Implementado | Regras compartilhadas e testes                                                                                                                |
| LOG-03  | Jogadores aceitam contratos de frete e rotas próprias        | Planejado    | Fase 05                                                                                                                                       |
| FIN-01  | Transferências conservam dinheiro e geram histórico          | Implementado | Ledger, débito/crédito e exportação CSV                                                                                                       |
| FIN-02  | Caixa, inventário, produção e resultado separados            | Implementado | Custo capitalizado e balanço do cenário                                                                                                       |
| TIME-01 | Processamento offline persistente                            | Implementado | Eventos ordenados e equivalência online/offline                                                                                               |
| MMO-01  | Múltiplos participantes no mesmo mundo                       | Parcial      | Duas contas locais; falta identidade autenticada                                                                                              |
| MMO-02  | Isolamento de dados, autorização e acesso público            | Planejado    | Fase 03, pré-condição para publicação                                                                                                         |
| SYS-01  | Idempotência e rollback transacional                         | Implementado | Receipts SQLite e testes                                                                                                                      |
| SYS-02  | Migrações, recuperação e escala operacional                  | Parcial      | Backup e migração SQLite testados, incluindo recibos e snapshots intermediários; escala/observabilidade pendentes                             |
| BIZ-01  | Aluguel e aquisição de operação com escopo detalhado         | Planejado    | Fase 06                                                                                                                                       |
| BIZ-02  | Contratos recorrentes e automações com orçamento             | Parcial      | Reposição configurável em lojas/produtores/armazéns; contratos recorrentes ainda pendentes                                                    |

## Complemento · Economia explicável

| ID     | Requisito                                                               | Estado       | Evidência                                                                                                             |
| ------ | ----------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------- |
| ECO-08 | Configuração congelada por temporada, sem cotações externas em execução | Implementado | `season.config`, regressão de imutabilidade e ausência de fetch                                                       |
| ECO-09 | Água, energia, salários e manutenção pagos e explicados                 | Implementado | Produção/ledger/custos recorrentes; pausa conserva contratos                                                          |
| ECO-10 | Mão de obra e logística calculadas                                      | Implementado | `metrics.ts`, ficha de fórmula e limitação de escopo                                                                  |
| UX-04  | Filtros opcionais vazios, análise simples e avançada por item           | Implementado | Cinco testes de navegador, catálogo completo e ECharts                                                                |
| UX-05  | Mapa somente das próprias propriedades e mapa econômico                 | Implementado | Titularidade, bolhas agrupadas e indicadores internos                                                                 |
| LOG-04 | Animação segundo prazo persistido e distância da rota                   | Implementado | Interpolação, teste temporal e teste de recarga no Edge                                                               |
| ECO-11 | Temporada sustentável e recuperação de insolvência                      | Parcial      | Simulação 30 dias conserva dinheiro e termina com oferta nos dez itens; 28/30 novos bots ativos, recuperação pendente |

O status implementado aqui se refere ao laboratório local. A aprovação de lançamento público exige critérios adicionais no roteiro.

## Complemento · Operação e concorrência 0.3.0

| ID     | Requisito                                                      | Estado       | Evidência                                                                                                                |
| ------ | -------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| BIZ-03 | Pedidos abertos por humanos/bots com proposta e contraproposta | Implementado | Comandos comuns, aceitação pela contraparte, testes de caixa/estoque/autorização e navegador                             |
| BIZ-04 | Transferência entre depósitos/empresas próprias                | Implementado | Sem receita artificial, custo/qualidade/frete conservados, fluxo de interface                                            |
| BIZ-05 | Abastecimento completo de lojas e produtores                   | Implementado | Política por produto, réguas, mínimo/alvo, orçamento, caixa protegido, origens e projeção explicada                      |
| BIZ-06 | Contratação sem candidatos e salários estaduais evolutivos     | Implementado | Índices internos semanais, histórico e custo previsto; sem cotações externas                                             |
| BIZ-07 | Educação paga melhora qualidade futura                         | Implementado | Custo por empregado/nível, tempo, formação diluída ao contratar e estoque antigo preservado                              |
| FIN-03 | Tesouro por UF financia quantidade de contratos                | Implementado | 27 contas, reservas/caixa, programas no piloto, teto de referência interna +25%                                          |
| ECO-12 | Disputa por programas públicos variados                        | Implementado | Sete programas, critérios explícitos, revalidação e tentativa da próxima proposta viável                                 |
| LOG-05 | Agrupar todos os caminhões pelo pedido e destino municipal     | Implementado | Pedido só conclui após a última entrega; mapa/cronograma de todos os veículos                                            |
| ECO-13 | Trinta novos bots e manutenção da cobertura de capacidades     | Parcial      | 30 concorrentes finitos + oito anteriores; registro/testes de receitas e comandos, funções futuras exigem nova cobertura |

Validação consolidada em `phases/06-business-operations/06-VALIDATION.md`.
