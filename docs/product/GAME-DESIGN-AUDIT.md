# Auditoria de design · 26/10/2026

Critério: cada número deve explicar uma decisão; cada ação deve ter custo, consequência e recuperação. A presença de uma tela não demonstra um sistema equilibrado.

## Problemas corrigidos nesta fase

| Falha                                                   | Consequência                                 | Correção observável                                                                  |
| ------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------ |
| “Mão de obra alta” e “logística boa” sem cálculo        | Investimento por rótulo arbitrário           | Componentes, fórmulas, candidatos, salário e capacidade dinâmica                     |
| Energia/água apresentadas apenas como disponíveis       | Margens irreais e custo oculto               | Consumo e cobrança por receita + operação, ledger separado                           |
| Reais usados como créditos sem unidade econômica        | Preços e cadeias inconsistentes              | BRL em centavos; unidades explícitas, faixas de abertura, coproduto do esmagamento   |
| Mudanças de template afetavam mundo em andamento        | Regras da season mudavam sem consentimento   | Configuração persistida por temporada, sem cotação externa ao vivo                   |
| Linha de transporte sem relação com entrega             | Sensação de progresso decorativo             | Geometria contratada e fases sincronizadas com prazo salvo                           |
| Todas as propriedades visualmente misturadas            | Dificuldade de administrar rede própria      | Filtro de titularidade e botão “Minhas propriedades”                                 |
| Filtros e fornecedores escolhidos pelo sistema          | Decisão comercial enviesada                  | Filtros vazios; escolhas deliberadas, contexto explícito de reposição                |
| Gráfico sem procedência e preços de canais misturados   | Falsa precisão                               | Ofertas versus negócios/varejo separados, candles só com transações, tabela e método |
| Ordenar preço de tonelada contra embalagem              | Ranking sem significado                      | Ordenação monetária exige uma mercadoria selecionada                                 |
| Custo de óleo sem reconhecer farelo                     | Esmagamento estruturalmente distorcido       | Coproduto, unidade kg, alocação conservada e oferta finita                           |
| Pausar para evitar toda folha/manutenção                | Estratégia dominante por exploração de regra | Contratos fixos persistem ao pausar                                                  |
| Reposição bot criava expectativa de fornecedor infinito | Economia sem risco físico                    | Mesmos comandos, caixa, frete, orçamento e estoque finitos                           |

## Pendências materiais, por prioridade

| Prioridade          | Problema e impacto                                                                                                                                               | Próxima ação e critério de aceitação                                                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0 · season pública | Cadeias incompletas: arroz, feijão, açúcar, leite e carvão dependem de estoque inicial; aço e farelo não têm destino final suficiente                            | Fechar duas cadeias primeiro. Simular 30 dias com demanda final, reposição e gargalos; nenhum item essencial desaparece sem opção de recuperação                                |
| P0 · season pública | Tesouro acumula serviços enquanto consumidores recebem salários; não há política de recirculação, crédito ou emissão controlada                                  | Modelar orçamento dos agentes institucionais. Monitorar dinheiro por setor e velocidade de circulação; detectar recessão por falta de caixa, sem repor dinheiro silenciosamente |
| P0 · UX             | Compra transfere imóvel e abre 12 contratos automaticamente; não há etapa de instalar equipamento, escolher especialidade ou contratar                           | Separar terreno, instalação e operação com CAPEX, capital de giro e profissão. Antecipar compromisso total antes de confirmar                                                   |
| P0 · recuperação    | Insolvência pausa a operação, sem dívida/atraso ou mecanismo de recuperação; ainda é possível deixar salários sem pagar quando falta caixa                       | Introduzir obrigações e recuperação explícitas, venda de ativos/arrendamento e limite de endividamento. Jogador entende por que parou e tem saída alcançável                    |
| P0 · multiplayer    | Contas de desenvolvimento e snapshot único não suportam MMO público                                                                                              | Autenticação, autorização, Postgres/PostGIS, isolamento transacional e disputa entre conexões independentes antes de publicar                                                   |
| P1 · balanceamento  | Agricultura transforma semente em colheita em um dia virtual, sem área, sazonalidade ou produtividade por hectare                                                | Ciclo agrícola por área e etapa, parâmetros congelados na season e custos distribuídos. Não usar rapidez do laboratório como decisão definitiva                                 |
| P1 · competição     | Bots controlam estoque e preço, mas não avaliam investimento, lucro de longo prazo ou saída do mercado                                                           | Planejador limitado por risco e retorno, transparência de [BOT], nenhum bônus oculto, playtest humano comparável                                                                |
| P1 · informação     | Demanda industrial usa receita inferida pelo nome da empresa; várias indústrias podem escolher qualquer receita da categoria                                     | Persistir especialização/equipamento e taxa de capacidade. Demanda deve derivar do plano operativo, não do nome                                                                 |
| P1 · transporte     | Tempo inicial inclui deslocamento até coleta, mas a animação mostra só a rota da mercadoria; caminhões próprios não aceitam contratos e não há retorno planejado | Rota de serviço com deslocamento vazio, coleta, entrega, retorno; mercado de fretes humanos, custos/receita sem dupla cobrança de motorista                                     |
| P1 · mão de obra    | Pool setorial aproxima qualificação com percentuais e usa praça mais próxima; não há trabalhadores por profissão                                                 | Profissões e mercado regional compartilhado, salários contratuais, treinamento e acesso pendular. Não vender o índice inicial como dado local real                              |
| P1 · análise        | Retenção móvel de observações, ausência de histórico de cada oferta; raio customizado só afeta resumo atual                                                      | Agregações persistidas por dia, negócios imutáveis e snapshots de ofertas. Histórico inteiro da season com proveniência e escopo exato                                          |
| P1 · progressão     | Carteira inicial com várias empresas, custos históricos e muito capital mascara a experiência inicial                                                            | Cenário de iniciante separado: pequeno negócio, reserva de giro, objetivos e saídas de erro; não resetar mundo de demonstração                                                  |
| P2 · fricção        | Algumas decisões repetem compra unitária/embalagem e o catálogo ainda é pequeno                                                                                  | Contratos de reposição, lotes e previsão de cobertura, após validar custos. Evitar expandir itens antes de completar cadeias                                                    |

## Painel mínimo de saúde para playtests

1. Caixa por agente/setor, pagamentos recusados, salários pagos e dinheiro parado no tesouro.
2. Cobertura de estoque, ruptura por item/região, carga atrasada e demanda não atendida.
3. Margem após custos fixos e frete, retorno do capital, custo por ciclo e participação do coproduto.
4. Utilização de caminhões, km vazios, remuneração por hora virtual e concentração de transportadoras.
5. Quota de mercado e concentração por região; preço sem negócio não é evidência de equilíbrio.
6. Tempo até primeira venda e primeira entrega, quantos jogadores entendem “custo posto”, quantidade de ações para reabastecer e recuperação após erro.

Cada mudança de balanceamento deve registrar hipótese, configuração inicial, duração e critério de falha. Preferir comparar duas temporadas simuladas a corrigir preços de um mundo em andamento. A próxima decisão prioritária é fechar consumo final e fornecimento de duas cadeias, antes de acrescentar novos setores.
