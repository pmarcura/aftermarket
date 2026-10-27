# Auditoria de design de jogo · 0.4.0

Atualizada em 27/10/2026, America/Sao_Paulo. Regras e interface foram revisadas juntas. Este documento descreve o laboratório; não aprova uma season pública nem afirma equilíbrio econômico.

## Correções verificadas

| Problema                                                  | Entrega                                                                                                                            | Evidência                                                               |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Rotas em linha reta ou sem geometria confiável            | Despacho exige OSRM; geometria imutável, todos os caminhões sobre a estrada, recarga preserva prazo                                | Testes de roteamento/recarga e rota real de 630 pontos                  |
| Seletor de frota só mostrava nomes                        | Cartões pesquisáveis: livres/total/ocupados/manutenção, massa/volume, máximo do produto e da operação, custo, prazo e manifesto    | Testes de limite por veículo, UI desktop/celular e Usar máximo          |
| Escolha incompatível só falhava no aceite                 | Estoque e espaço comprometido entram no máximo; impedimentos de quantidade, rota, teto de frete e prazo aparecem antes da proposta | Rejeição sem cobrança e teste do formulário                             |
| Repetição manual entre estruturas próprias                | Conexão fixa origem → produto → destino com mínimo/alvo e limites da política de abastecimento                                     | Testes não desviam para outro fornecedor quando a origem esgota         |
| Alertas sob o modal e contador acumulando toda a história | Erro persistente na camada da janela, recebimentos agrupados por pedido, marcação local de leitura e pendências atuais separadas   | Testes de DOM, recarga e capturas                                       |
| Insolvência sem caminho explícito                         | Obrigações reconhecidas, pagamento, suspensão, crédito estadual finito/garantido e venda de veículos                               | Testes de caixa, garantia, taxa, conservação e recuperação no navegador |
| Tetos públicos dependiam de anúncios                      | Negócios qualificados, diversidade por pares e limite diário; editais antigos mantidos                                             | Anúncio caro não altera referência; sem negócios mantém abertura        |
| Necessidades comerciais disputavam todo o caixa           | Vínculo opcional por pedido e em reposições negociadas; cancelamento/expiração liberam                                             | Testes de reserva, pagamento e falha sem mutação                        |
| Compra de imóvel mascarava equipe/equipamento             | Etapas explícitas e CAPEX; novas unidades sem auto contratação                                                                     | Fluxo completo de aquisição, instalação e equipe                        |
| Curvas pouco legíveis ou história uniformizada            | ECharts compartilhado, números pt-BR, escala/zoom, tela cheia, tabela e exportações; caixa usa eventos reais                       | Exportação CSV e inspeção móvel                                         |
| Bots não reagiam às regras novas                          | Orçamento, custo/fixos, educação, recuperação, instalação e venda de estoque pausado                                               | Capabilities e testes de comandos/cenários                              |
| Listas escondiam registros antigos                        | Busca e paginação em pedidos, editais, atividade e logística                                                                       | Navegação real e busca por pedido                                       |

Continuam as correções anteriores: BRL, fórmula de logística, contratação em toda praça, salário estadual interno, água/energia pagas, formação diluída por contratações, 30 novos bots com recursos finitos, 27 tesouros, contratos municipais e reposição em produtores/lojas/armazéns. Fontes reais só calibram abertura e temporadas futuras.

## O que a economia ainda não provou

Para a revisão de obtenção/fabricação/venda e admissão de conteúdo, usar o [catálogo verificável](RESOURCE-CATALOG.md) e o [padrão matemático de recursos](RESOURCE-STANDARD.md). A auditoria estrutural integrada ao check não aprova equilíbrio nem substitui experimentos de absorção dos coprodutos e menor operação viável.

Cenários de 30/90 dias conservam dinheiro, mas mostram atrasados, suspensão de empresas e concentração. Oferta final nos dez itens não significa ausência de rupturas durante todo o período ou concorrência saudável por cidade. A carteira de demonstração tem muitos ativos e ações humanas desligadas na simulação; o iniciante é outra distribuição inicial e não deve ser comparado como experimento controlado de uma única regra.

Relatórios locais em `.runtime/balance/season-0.4-*.json`; comandos e medidas na validação da fase 04. Simulações usam geografia estimada explicitamente e não testam disponibilidade do serviço de rotas. O indicador HHI agregado mede faturamento registrado, não riqueza ou participação de um produto; a interface permite recortar por item.

## Riscos em aberto e critério de próxima etapa

| Prioridade | Risco                                                                        | Próxima ação mensurável                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| P0         | Perfis sem senha e snapshot JSON não são MMO público                         | Autenticação, autorização e migração Postgres/PostGIS; disputar o mesmo lote/imóvel por conexões independentes                                 |
| P0         | Liquidez/concentração ainda frágeis                                          | Playtest humano iniciante e cenário de baixa demanda; medir primeira venda, atrasados, recuperação e margem após todos os custos por 90 dias   |
| P1         | Conluio com transações entre contas pode contornar diversidade de referência | Identidade, auditoria de relações, volume econômico e custo de ataque; ±5% ao dia reduz velocidade, não resolve conluio geral                  |
| P1         | Crédito sem execução de garantia                                             | Definir inadimplência/reestruturação com decisão explícita e provar que não permite extrair dinheiro por empresas descartáveis                 |
| P1         | Estoque não é reservado na proposta                                          | Mostrar/revalidar disponibilidade; avaliar reserva com vencimento apenas após observar falhas reais de negociação                              |
| P1         | Rota automotiva e coleta vazia estimada                                      | Perfil/dados truck, planejamento de coleta/retorno vazio, orçamento de serviço e teste de restrições; sem prometer equivalência ao Google Maps |
| P1         | Projeções usam preços e capacidade atuais                                    | Comparar previsto/realizado; sensibilidade baixa/base/alta não é probabilidade nem garantia de lucro                                           |
| P1         | Agricultura e qualidade agregadas                                            | Avaliar safra/área, perecibilidade, profissões e qualidade por lote conforme decisões úteis de gameplay                                        |
| P1         | Instalação imediata e preços de equipamentos parametrizados                  | Playtest de CAPEX/retorno; avaliar fornecedores e construção com tempo sem criar espera vazia                                                  |
| P1         | Cadência acelerada pode favorecer quem fica conectado                        | Playtest de season lenta, automação justa e janelas de contratos em diferentes horários                                                        |
| P2         | Histórico móvel, grande snapshot e bundles pesados                           | Séries persistidas, medição em hardware modesto e orçamento de renderização/tiles antes de expandir mapa                                       |
| P2         | Falta aluguel e contratos recorrentes                                        | Entregar cadeia contratual completa com prazo, inadimplência e aceitação humana de frete                                                       |

## Manter bots e evidências

Para cada regra nova: o bot descobre, avalia caixa/estoque/frota, executa o mesmo comando, registra resultado e trata rejeição? O registro de capacidades não implementa comportamento sozinho. Testes exigem produtores para cada receita e exercitam negociação, educação e recuperação. Conexões fixas usam o mesmo planejador e comandos; bots podem continuar priorizando suas origens pelo custo sem precisar fixá-las.

Acompanhar dinheiro por setor/UF, giro, salários não pagos, rupturas, concentração por produto, margem depois de frete/fixos, ocupação/km vazios e perdas de licitações. Medir também cliques para reabastecer, compreensão do máximo transportável e resolução dos alertas. Histórico das auditorias anteriores está no Git; não manter cópias concorrentes do documento.
