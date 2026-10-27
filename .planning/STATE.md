# Estado da continuidade

Atualizado em **27/10/2026**, America/Sao_Paulo.

## Onde estamos

Laboratório local **0.4.0**, projeto canônico `D:\Novidade`, branch `main`. Fases 01/02 entregues; frentes antecipadas 04/05/06 têm entregas locais, sem conclusão de MMO público. React/TypeScript/MapLibre/ECharts, API Node/Express e SQLite `.runtime/world.sqlite`. GDD/imagens preservados. Nenhuma publicação externa. Checkpoints de implementação: `53e71de` (regras/rotas) e `0b23b5f` (interface e testes).

## Entregue nesta revisão

- Servidor exige geometria rodoviária OSRM para novos despachos: fila/cache/validação, espera sem cobrança se indisponível, arquivo compartilhado imutável. Legado estimado recebe só correção visual, mantendo preços/datas. Todos os caminhões acompanham o tempo salvo sobre a linha, com destaque individual e trechos de ruas.
- Cartões de frota pesquisáveis em compra, transferência, proposta, edital e abastecimento: livres/total/ocupados/manutenção, massa/volume, máximo do produto e da operação, custo/prazo/manifesto e Usar máximo. Espaço considera entregas/produção comprometidas; propostas mostram impedimentos antes de enviar.
- Conexão fixa por insumo: origem → produto → destino, mínimos/alvos, orçamento e frota. Sem estoque na origem fixa, aguarda. Respeita os mesmos comandos e limites da reposição. Meus Negócios reúne a rede e permite criar conexões com campos vazios. Orçamento e frota são compartilhados pelo destino; outras regras ativadas aparecem na revisão.
- Erros dentro da camada do modal, persistentes até fechar/substituir. Central separa pendências de recebimentos não lidos, agrupa caminhões por pedido e salva leitura local por empresa/dispositivo.
- Gráficos padronizados, números pt-BR, zoom/escala, tela cheia, tabela/CSV/PNG; caixa por eventos reais e cenários baixo/base/alto limitados pela capacidade. Busca/paginação nas listas operacionais.
- Obrigações não pagas, pagamento sem duplicar despesa, suspensão, crédito estadual com garantia/verba finita, taxa explícita e venda de veículos respeitando garantias. Pedidos podem vincular caixa opcionalmente até aceite/cancelamento/expiração.
- Referência pública usa negócios diversos, janela de sete dias e ±5% ao dia; anúncios não elevam tetos, contratos existentes mantidos.
- Novas aquisições separam imóvel/equipamento/equipe/operação. Legado preserva instalação/equipe. Cenário iniciante em banco separado, sem reset do mundo principal.
- Bots atualizados para caixa protegido, custo total, educação, recuperação, instalação e oferta de estoque pausado. Mantidos os 30 novos rivais + oito anteriores e 27 tesouros.

## Migração e evidência

`designVersion=2`, aditiva. Relatório `.runtime/review/migration-main.json`: integridade OK, dinheiro conservado, **44.700 lançamentos antes/depois**, 57 recibos, 604 remessas e 829 jobs preservados; nenhum novo capital de abertura nem rival. Parâmetros existentes da season, proprietários, saldos humanos, estoques, equipe/frota e termos contratados preservados. Tick vencido da atualização não cobra regras novas retroativamente. Operação normal continua avançando depois disso; esses números são o checkpoint, não totais atuais.

Backups: `world-2026-10-27T02-59-16.925Z.sqlite` antes da migração e `world-2026-10-27T05-57-11.135Z.sqlite` antes do último reinício. Nunca apagar `.runtime` para atualizar.

Rota real FerroVale → Indústria de Aço: 31,4277 km, 630 pontos, 18 trechos, screenshot e JSON em `.runtime/review/road-real*`, sem erro JavaScript. Inspeção usou pedido existente, sem compra adicional. Testes de navegador usam curva controlada local; não confundir fixture com ruas reais.

Ver `phases/04-road-routing/04-VALIDATION.md`: compilação, 93 testes de domínio, 12 fluxos de navegador e validação específica da rede/alertas. Suítes e simulações não abrem o banco principal.

## O que os 90 dias mostram

Baseline seed 0: dinheiro conservado, 1.935 viagens, 1.362 jobs concluídos, 76 contratos, R$ 17.364.174,03 de gasto público e 3.000 t de aço consumidas. Dez itens com oferta no final, 21/30 novos rivais ativos, sete estruturas suspensas, R$ 3.226.858,34 em atrasados e HHI agregado 7.752,48. Cenários de baixa demanda, outra semente e iniciante também registrados. Ações humanas ficam desligadas; geografia é explicitamente estimada no teste offline. Há concentração e insolvência: **não declarar equilíbrio integral**. Ver auditoria e tabela de cenários da validação.

## Próxima ação concreta

Playtest humano iniciante: medir primeira compra/entrega/venda, entendimento dos máximos e recuperação, margem após frete/fixos e concentração por item. Definir política de inadimplência/garantias e reação a conluio com negócios reais. Medir o cliente em hardware modesto antes de ampliar catálogo/mapa. Autenticação e Postgres/PostGIS da fase 03 continuam obrigatórios antes de season pública.

## Limites

Perfis locais sem senha e snapshot JSON transacional em loopback. OSRM automotivo, sem validação truck, retorno vazio planejado ou rota rodoviária da coleta vazia; demonstrador público sem SLA. Preços/taxas do jogo não consultam dados econômicos externos durante a season.

Qualidade média por produto e agricultura agregada, sem lotes/validade/clima/profissões. Estoque não fica reservado na proposta. Crédito sem execução automática de garantia. Instalação imediata no laboratório. Sem aluguel, contratos recorrentes ou aceite humano de fretes. Histórico móvel, bundles MapLibre/ECharts grandes e escala MMO pendentes. Pontos municipais, propriedades e reservas são virtuais; catálogo IBGE não implica economia nacional ativa.

## Continuidade

Ler AGENTS, estado, roteiro, requisitos e plano. Uma implementação ativa por função; histórico no Git. Nova mecânica precisa atualizar bot, comando, capacidade e testes. Fontes externas calibram apenas abertura/futuras seasons. Não rebalancear a season salva ao editar templates e não criar resgate invisível.
