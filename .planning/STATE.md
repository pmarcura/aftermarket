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

Auditoria matemática retomada: `npm run mathematics:audit -- --write-doc`, relatório `docs/product/MATHEMATICS-AUDIT.md` e JSON `.runtime/mathematics/audit.json`. Sete achados reproduzidos: três erros de fórmula, dois limites de calibração e duas políticas implícitas. Recuperação do leite projeta +R$ 4.508,72/dia contra −R$ 626,58 respeitando duração; aço de 2 linhas/lotes de 5 projeta 48 ciclos/dia mas executa 30; demanda fracionária pode desaparecer ao dividir entre lojas. Quatro receitas agrícolas não cobrem a folha mínima mesmo ignorando entradas físicas/utilidades/frete/manutenção/CAPEX nos preços inaugurais de SP. Referência A:0 de 90 dias atual (`52a839803fa7…`), farelo fecha `3.000 + 182.400 − 550 = 184.850 kg`; reduzir velocidade de óleo isoladamente continua rejeitado. Nenhuma mudança no motor/configuração/banco. Próxima ação: corrigir capacidade compartilhada e demanda fracionária, explicitar rateio de serviço e só então comparar margem agrícola/alvos/coprodutos em mundos isolados. Ver validação da fase 05 para checks finais.

Prioridade seguinte do usuário: **velocidade para compreender e refinar o jogo completo**, incluindo economia, bots e todas as interfaces. Usar `/lab` (`npm run lab`) e começar por `.runtime/lab/context.json`/`review.json`; `lab:refresh` gera as evidências e `lab:watch` mantém a coleta em alterações. Ver `phases/07-development-lab` para medição e limites. O próximo experimento de recursos abaixo passa a usar essa bancada; não reequilibrar a season salva.

Prioridade do usuário em 27/10: estabelecer recursos/cadeias e regras matemáticas antes de ampliar conteúdo. Ler `docs/product/RESOURCE-STANDARD.md` e o catálogo gerado. Primeiro experimento: balancear óleo/farelo/leite em conjunto, medindo produção, consumo familiar/público, estoque e margem após fixos/frete; depois testar menor operação viável por especialidade. Não alterar a season salva para testar templates. Ver `phases/05-resource-balance`.

O playtest humano iniciante continua necessário: primeira compra/entrega/venda, entendimento dos máximos e recuperação, margem e concentração por item. Definir inadimplência/garantias e reação a conluio com negócios reais. Medir hardware modesto antes de ampliar catálogo/mapa. Autenticação e Postgres/PostGIS da fase 03 continuam obrigatórios antes de season pública.

## Base de recursos · 27/10

Catálogo regenerável: dez itens, nove receitas, cinco canais familiares e sete programas públicos, com fornecedores/unidades/massa/volume, custos e fronteiras agregadas. `resources:check` integrado ao check, exigindo catálogo sincronizado. Foram adicionados 42 testes; total de 135 aprovados. `resources:audit -- --world=.runtime/world.sqlite` lê o snapshot em conexão somente leitura, sem store/migração/tick; relatório em `.runtime/resources/saved-world.*`. Unidade/massa/volume/canais ainda não são congelados na season: resolver versionamento antes de expandi-los. Ver limitações da verificação global por alterações concorrentes de UI em `05-VALIDATION.md`.

Cobertura estrutural válida, sem conclusão de equilíbrio. Cinco receitas dão resultado negativo no comparativo de uma linha/SP/lotes automáticos unitários; o diagnóstico depende de escala/hipóteses. Farelo/leite/óleo têm proporção de consumo incompatível sem destinos adicionais: excesso teórico de 56,14% do farelo na hipótese apenas familiar. Leitura da revisão 5.132: 215.060 kg de farelo físico. Nenhum saldo, receita, preço ou banco foi alterado nesta frente. Ficha de admissão obrigatória em `RESOURCE-TEMPLATE.md`.

## Limites

Complemento de recursos solicitado: `docs/product/MECHANICS-REPORT.md` reúne os números por mecânica, origem/valor das sementes, óleo/farelo/leite e 36 fluxos/limites incompletos. `npm run mechanics:report -- --world=.runtime/world.sqlite --write-doc` regenera o relatório e anexos em `.runtime/mechanics`, usando SELECT somente leitura e sem tick. A abertura é separada do snapshot; números declarados sem uso e campos legados da season aparecem identificados. O relatório não implementa nem aprova rebalanceamento.

Laboratório completo local em `/lab`: trace de tentativas/recusas/gates, consulta por bot/item/dia, parâmetros/choques A/B, diário e investigação registrada, 29 contratos/58 execuções de UI e referência PNG/estrutural/funcional preservada. `npm run lab` inicia apresentação e coleta automática. Benchmark 30/90/365 dias: 2,71/10,29/84,40 s; consultas com leitura 21/47/211 ms. Dinheiro e fluxos físicos conservados; 160 testes de domínio e cinco fluxos de navegador passaram. Estudo de reduzir velocidade de óleo foi rejeitado (farelo final igual); compra de caminhão agora impede tentativa sem caixa e mantém compra viável. Ver `phases/07-development-lab/07-VALIDATION.md`. O auditor matemático interrompido foi concluído e o TypeScript global voltou a passar; conferir verificações finais na fase 05. Concentração/inadimplência da economia seguem em investigação.

Perfis locais sem senha e snapshot JSON transacional em loopback. OSRM automotivo, sem validação truck, retorno vazio planejado ou rota rodoviária da coleta vazia; demonstrador público sem SLA. Preços/taxas do jogo não consultam dados econômicos externos durante a season.

Qualidade média por produto e agricultura agregada, sem lotes/validade/clima/profissões. Estoque não fica reservado na proposta. Crédito sem execução automática de garantia. Instalação imediata no laboratório. Sem aluguel, contratos recorrentes ou aceite humano de fretes. Histórico móvel, bundles MapLibre/ECharts grandes e escala MMO pendentes. Pontos municipais, propriedades e reservas são virtuais; catálogo IBGE não implica economia nacional ativa.

## Continuidade

Ler AGENTS, estado, roteiro, requisitos e plano. Uma implementação ativa por função; histórico no Git. Nova mecânica precisa atualizar bot, comando, capacidade e testes. Fontes externas calibram apenas abertura/futuras seasons. Não rebalancear a season salva ao editar templates e não criar resgate invisível.
