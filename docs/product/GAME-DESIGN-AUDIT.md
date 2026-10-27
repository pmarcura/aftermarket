# Auditoria de design de jogo · 0.3.0

Atualizada em 26/10/2026 (America/Sao_Paulo). Status refere-se ao laboratório local. Uma economia movimentada e com dinheiro conservado ainda pode ser recessiva, concentrada ou difícil de recuperar.

## Correções demonstradas

| Falha anterior                                                  | Correção e consequência                                                                                           |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Rótulos sem explicação                                          | Fórmulas de logística, custos, capacidade e salário com componentes observáveis                                   |
| Candidatos locais bloqueavam contratação                        | Contratação disponível; salário estadual e índice interno semanal, sem pesquisa externa                           |
| Pouca concorrência visível                                      | Trinta novos bots financiados, painel de ações efetivas e teste de cobertura das receitas                         |
| Bots não negociavam necessidades                                | Pedidos abertos/dirigidos, propostas, contrapropostas e aceitação entre humanos/bots                              |
| Várias viagens pareciam compras distintas                       | Um pedido agrupa caminhões, quantidades e recebimentos; conclusão depende de todos                                |
| Estoque próprio exigia venda artificial                         | Transferência física paga só transporte e conserva custo/qualidade, inclusive com produção pausada                |
| Reposição limitada ao varejo                                    | Política por unidade com mínimos/alvos, origens, qualidade, orçamento, caixa protegido e frete                    |
| Benefício de educação podia ser multiplicado por contratação    | Formação média é diluída por novos empregados; treinamento tem custo/tempo e só afeta novos lotes                 |
| Bot aceitava contraproposta abaixo do custo                     | Reavalia custo e contrapropõe antes de aceitar                                                                    |
| Tesouro central acumulava caixa e premiação escalava pelo saldo | Contas por estado, editais financiados, teto de referência interna +25% e disputa por qualidade/preço/prazo/frete |
| Cadeias dependiam apenas de estoque inicial                     | Receitas agregadas de arroz, feijão, açúcar, leite e carvão; proteção de sementes e reservas minerais finitas     |

## Experimento de 30 dias

Cenário determinístico com carteira demonstrativa e ações humanas desligadas; configuração salva no relatório. Sem consultar o banco do jogador ou fontes econômicas externas.

- Dinheiro conservado e nenhum saldo negativo.
- 742 viagens e 916 lotes concluídos.
- 35 contratos públicos concluídos; R$ 8.938.005,39 pagos, incluindo transporte.
- 1.488 t de aço consumidas em programas públicos.
- Nenhum dos dez produtos terminou sem oferta; isso não comprova disponibilidade contínua em toda cidade.
- 28 dos 30 novos concorrentes mantiveram pelo menos uma operação ativa.
- Duas indústrias novas pausaram por insuficiência de caixa; uma expansão antiga também pausou. Armazém Sul já começa pausado.
- Nove pedidos pendentes ao fim. Estoque anunciado não prova venda, preço justo ou equilíbrio.

Relatório reproduzível: `npm run balance:season -- --days=30`, saída `.runtime/balance/season-2026-10-26-30d-operations.json`. Não há meta artificial de todos os bots lucrarem nem resgate invisível.

## Falhas e próximos experimentos

| Prioridade                 | Falha / risco de estratégia dominante                                                                                | Próxima ação e critério                                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| P0 · recuperação           | Sem venda de ativos, dívida/atrasados ou reestruturação; insolvência pausa e pode deixar folha sem pagar             | Obrigações explícitas e caminho viável de recuperação; playtest de empresa sem caixa consegue retornar sem reset                      |
| P0 · economia pública      | Referência usa anúncios de três empresas, não negócios. Conluio/anúncios caros podem elevar tetos de editais futuros | Comparar mediana de transações, janela, volume mínimo e limite de variação; rejeitar manipulação coordenada sem fixar preços privados |
| P0 · liquidez              | Compras públicas recirculam arrecadação, mas não há política calibrada de reserva, crédito ou emissão                | Medir dinheiro por famílias/empresas/UF e velocidade; simular baixa demanda e retenção institucional por 90 dias                      |
| P0 · lançamento            | Perfis sem senha e snapshot único não representam MMO público                                                        | Identidade real, autorização, Postgres/PostGIS e concorrência entre conexões antes de publicar                                        |
| P1 · compromisso comercial | Pedidos pendentes autorizam gasto, mas não reservam caixa/estoque; proposta pode falhar no aceite                    | Mostrar validade/compromissos e testar escrow opcional com expiração, sem travar todo o mercado                                       |
| P1 · entrada               | Carteira rica de demonstração e compra que agrega instalação/equipe mascaram início real                             | Cenário iniciante e etapas imóvel/equipamento/equipe; antecipar CAPEX e capital de giro                                               |
| P1 · produção              | Agricultura/beneficiamento/envase agregados; sem área por safra, rebanho, validade ou clima                          | Separar etapas conforme testes de diversão; medir custo por hectare/ciclo antes de ampliar catálogo                                   |
| P1 · qualidade             | Uma média por produto mistura todos os lotes; demissão seletiva não existe                                           | Lotes com qualidade/custo/validade e equipe por profissão apenas quando trouxer decisão útil                                          |
| P1 · previsões             | Resultado potencial supõe capacidade, preços atuais e venda; gráfico de cobertura sinaliza uma reposição             | Comparar previsto/realizado e oferecer cenários baixo/base/alto; nunca rotular contribuição como lucro garantido                      |
| P1 · concorrentes          | Heurísticas locais; expansão, estoque e licitações podem competir pelo mesmo caixa/frota                             | Registrar motivos de espera/perda, rodar múltiplas sementes, comparar lucro e concentração com humanos                                |
| P1 · transporte            | OSRM automotivo/estimativa, sem truck profile, retorno vazio planejado ou aceite humano de frete                     | Roteador de caminhão e ciclo completo de serviço; receita/custo sem duplicação                                                        |
| P1 · informação            | Histórico móvel e snapshot; caixa público usado como destino agregado de serviços                                    | Séries persistidas, separar prestadores privados/tributos e medir demanda efetivamente atendida                                       |
| P1 · manutenção            | Tempos de referência e cadência de bots dependem da escala acelerada do laboratório                                  | Playtest de season lenta, ações offline e janelas justas em diferentes horários                                                       |
| P2 · navegação             | Contratos e feed limitam registros recentes; grande frota pode congestionar mapa/lista                               | Paginação, busca por pedido/cidade, agrupamento visual acessível e perfis de desempenho                                               |

## Como manter os bots atualizados

Cada nova regra deve responder: o bot descobre a ação, avalia custo/estoque, executa o mesmo comando, registra o resultado e trata rejeição? `director.ts` mantém capacidades/versão. Os testes exigem produtor e perfil para todas as receitas e exercitam pedidos reais com humano. Recursos humanos futuros precisam de nova cobertura; não existe atualização automática de comportamento por apenas adicionar um botão.

## Métricas de playtest

Acompanhar caixa por setor/UF, velocidade de circulação, salários não pagos, duração das rupturas, concentração de receita, margem depois de frete/fixos, retorno de capital, ocupação/km vazios e motivos de perda de editais. Medir tempo até primeira venda/entrega, cliques para reabastecer e compreensão de custo posto, caixa protegido e resultado potencial.

Próximo marco: recuperação de insolvência e defesa da referência pública contra manipulação, com cenários de 30/90 dias e mundo iniciante. Sem balanceamento por cotação externa durante a season.
