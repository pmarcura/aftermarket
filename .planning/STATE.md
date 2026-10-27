# Estado da continuidade

Atualizado em **26/10/2026**, America/Sao_Paulo.

## Onde estamos

Laboratório local **0.3.0**, projeto canônico em `D:\Novidade`, branch `main`. Fases 01/02 entregues e frente de operação/concorrência da fase 06 integrada. React/TypeScript/MapLibre/ECharts, API Node/Express, SQLite em `.runtime/world.sqlite`. GDD, 13 imagens e cartografia simplificada preservados. Não há publicação externa.

## Funciona

- Economia em BRL, configuração salva por season, sem cotações econômicas externas durante a partida.
- Compra/produção com caixa/estoque/capacidade, custo médio, qualidade e ledger conservado. Água, energia, salários e manutenção pagos.
- Especialização persistida, capacidade por equipe/área, produção automática com orçamento e estado de espera.
- Pedidos abertos/dirigidos por humanos/bots, propostas, contrapropostas, aceitação da contraparte e despacho transacional.
- Transferência entre unidades próprias, inclusive pausadas, paga só frete; sem receita artificial.
- Reposição de lojas, produtores e armazéns com mínimo/alvo, quantidade/preço, origem interna/mercado, qualidade, distância, frete, orçamento e caixa protegido. Projeção simples/avançada com chegada prevista e resultado hipotético.
- Logística por pedido, todos os caminhões na rota, recebimentos por viagem e conclusão somente após a última.
- Contratação disponível em todas as praças, salários por UF e índice interno semanal. Educação paga melhora novos lotes; novos empregados diluem formação média.
- 27 tesouros estaduais, sete programas municipais, referência interna +25% como teto, disputa por qualidade/preço/prazo/frete e revalidação no fechamento.
- 30 novos bots, além de oito anteriores: pedidos, suprimento, produção, ofertas, educação, licitações e expansão heurística. Painel de atividade real e teste de cobertura por receita.
- Mapa por titularidade e mapa econômico; filtros opcionais vazios; análise dos dez itens com ECharts e exportações.

## Migração real

`operationsVersion=3`. Auditoria contra `.runtime/backups/pre-operations-1793064355616.sqlite` confirmou integridade e conservação. Preservados saldos humanos, estoques, proprietários, frota, 54 recibos, 102 remessas e 227 jobs. Histórico original de 22.658 lançamentos preservado; 150 lançamentos de orçamento explicam capital dos novos bots e regionalização. Há backup anterior adicional `world-2026-10-26T11-38-55.700Z.sqlite` e backup transacional da atualização seguinte.

Ticks vencidos de manutenção não recebem as regras novas retroativamente. Entregas/jobs mantêm horários. Reinício normal continua com simulação offline. Relatório: `.runtime/review/migration-main.json`. Depois da retomada, API processou 82 ações reais de bots, 23 pedidos e 13 contratos no mundo salvo, sem erros de regra nos logs; números continuam mudando.

## Validação

Ver `phases/06-business-operations/06-VALIDATION.md`. Build, testes de domínio, fluxos reais de negociação/transferência/educação, licitação com vários caminhões, navegação móvel e simulação de 30 dias. Artefatos locais em `test-results/competition` e `.runtime/balance`.

No cenário de 30 dias: dinheiro conservado, 742 viagens, 916 jobs concluídos, 35 contratos públicos, R$ 8.938.005,39 de gasto público e 1.488 t de aço consumidas. Os dez itens terminam com oferta, e 28/30 novos concorrentes mantêm operação ativa. Duas novas indústrias e uma expansão pausam por falta de caixa; Armazém Sul começa pausado. Não declarar equilíbrio integral.

## Próxima ação concreta

Priorizar recuperação de insolvência e proteção da referência de editais contra anúncios coordenados. Simular 30/90 dias com cenários iniciante, baixa demanda e diferentes sementes antes de expandir catálogo. Ver `docs/product/GAME-DESIGN-AUDIT.md`. Autenticação/persistência relacional da fase 03 continuam obrigatórias antes de season pública.

## Limites conhecidos

Perfis locais sem senha, snapshot JSON transacional e API em loopback. Rotas OSRM automotivas ou estimadas; sem restrições truck, retorno vazio planejado ou aceite humano de fretes. Pontos de prefeitura, propriedades e reservas são virtuais. Atividade econômica limitada ao piloto; catálogo nacional geográfico não equivale a economia nacional.

Qualidade por média de produto, sem lotes/validade. Agricultura e beneficiamento agregados. Pedidos sem escrow: orçamento/estoque podem mudar antes do aceite. Educação é formação média, sem profissões individuais. Referência pública usa ofertas, vulnerável a coordenação. Resultado de abastecimento é cenário de capacidade/preço, não garantia. Sem aluguel, crédito, contratos recorrentes ou recuperação de atrasados. Histórico móvel e feed limitado; escala MMO/desempenho em hardware modesto pendentes.

## Regras de continuidade

Ler AGENTS, estado, roteiro e requisitos. Um código ativo por função; histórico no Git. Banco/backups em `.runtime`, nunca apagar para atualizar. Fontes externas calibram abertura/futuras seasons. Nova mecânica precisa atualizar bot, capacidade, comando e testes; o registro de capacidades não programa comportamentos futuros sozinho.
