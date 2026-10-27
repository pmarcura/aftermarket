# Roteiro por resultado jogável

Frente de apoio 07, solicitada em 27/10: laboratório local de simulação e interfaces, com contexto automático para acelerar entendimento e refinamentos. Ver `phases/07-development-lab` e `docs/design/DEVELOPMENT-LAB.md`. A bancada não substitui autenticação, playtest humano, escala ou os critérios da alpha.

| Fase                                    | Resultado                                              | Estado                  | Critério de saída                                                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 · Fundação e fatia jogável           | Interface e fluxo financeiro/industrial local          | Entregue                | Dez telas, transações, entrega, produção, fontes e testes                                                                                                                 |
| 02 · Economia explicável e inteligência | Jogador entende custos, prazo e oportunidades internas | Entregue no laboratório | BRL, configuração congelada, utilidades, fórmulas, animação, titularidade, filtros vazios e análise simples/avançada                                                      |
| 03 · Mundo autenticado                  | Dois jogadores disputam mercado com autorização real   | Planejada               | Identidade, permissões, PostgreSQL/PostGIS, migração e concorrência entre conexões                                                                                        |
| 04 · Geografia de produção              | Propriedades e rotas verificadas em SP–MG              | Parcial · 0.4.0         | OSRM rodoviário obrigatório, cache/fila/animação; faltam validação territorial, perfil truck e orçamento de tiles                                                         |
| 05 · Economia sustentável               | Consumo final, liquidez e recuperação                  | Parcial · playtest      | Recuperação, referência protegida e cenários 30/90 dias entregues; concentração/liquidez ainda exigem calibração                                                          |
| 06 · Operação empresarial               | Expansão e automação reduzem repetição                 | Parcial                 | Pedidos/negociação, transferências, produção/suprimento, capacidade, educação e bots entregues; instalação/equipamentos entregues; faltam aluguel e contratos recorrentes |
| 07 · Alpha fechada                      | Mundo recuperável sob carga medida                     | Planejada               | Backups restaurados, observabilidade, migração relacional, playtests e desempenho                                                                                         |

## Prioridade definida em 26/10/2026

O usuário antecipou a fase 02 de economia/UX. A antiga fase de autenticação passa a 03; nenhuma implementação autenticada foi descartada ou declarada pronta. A frente econômica pode ser testada localmente antes da identidade pública, mas autenticação e persistência relacional continuam obrigatórias antes de qualquer lançamento.

A simulação 0.3.0 de 30 dias conserva dinheiro e termina com oferta nos dez produtos. Trinta novos concorrentes participam, 28 mantêm operação ativa; duas indústrias pausam por falta de caixa. Compras públicas recirculam parte da arrecadação estadual. Esse resultado motivou a recuperação, a referência por negócios e o cenário iniciante entregues na 0.4.0. A resistência geral a conluio e o equilíbrio de season pública ainda precisam de validação. Ver `docs/product/GAME-DESIGN-AUDIT.md`.

Para a fase 03: manter comandos financeiros, separar identidade de desenvolvimento, introduzir repositórios relacionais com restrições e bloqueio de estoque. Migrar preservando o laboratório e validar concorrência por lote/imóvel em duas conexões independentes.

Fontes externas calibram apenas a abertura e futuras temporadas. Nunca corrigir rupturas conectando cotações externas ao motor durante uma season.

## Prioridade de recursos · 27/10/2026

Auditoria matemática retomada e reproduzida em `docs/product/MATHEMATICS-AUDIT.md`: três erros de fórmula (recuperação/cadência/demanda fracionária), dois pontos de calibração e duas políticas implícitas. Corrigir as fórmulas e decidir o rateio varejista antes de calibrar a cadeia e os alvos de estoque. A referência de 90 dias permanece preservada; nenhuma regra ou parâmetro da season foi alterado.

O usuário pediu estabelecer obtenção, fabricação, venda e padrão matemático antes de ampliar conteúdo. A frente `phases/05-resource-balance` entrega o catálogo verificável, auditoria estrutural e ficha de admissão. A fase 05 permanece parcial: dez itens têm origem e caminho ao consumo, mas a escala mínima de cinco receitas e a absorção de farelo precisam de calibração. Próximo experimento é óleo/farelo/leite em conjunto, seguido da operação iniciante por especialidade; ver `docs/product/RESOURCE-STANDARD.md`. Não recalibrar a season salva ao editar os templates.

## Frente 06 antecipada · 0.3.0

Pedidos e contrapropostas de humanos/bots, abastecimento completo, transferências próprias, equipe/educação, logística por pedido e licitações estaduais foram antecipados pelo usuário. Ver planos e validação em `phases/06-business-operations`. Nenhuma dessas entregas substitui autenticação/persistência da fase 03.

## Frente 04 antecipada · 0.4.0

Revisão de regras e interface autorizada pelo usuário em 27/10/2026. Rotas reais salvas, fila/retry sem contratação de linha reta, correção visual de legado, gráficos com ferramentas, insolvência/compromissos/referência pública, instalação explícita e cenário iniciante. O refinamento seguinte inclui cartões de frota com limite por produto/estoque/destino, conexão fixa por insumo e alertas visíveis no modal/agrupados por pedido. Ver `phases/04-road-routing`.

O critério territorial completo da fase 04 permanece parcial: perfil de caminhão e ciclo coleta/retorno vazio não foram entregues. A fase 05 também continua parcial: conservação e recuperação não comprovam equilíbrio de uma season. Próximo experimento é progressão humana iniciante e concentração por item, sem ampliar catálogo antes de compreender atrasados/rupturas.
