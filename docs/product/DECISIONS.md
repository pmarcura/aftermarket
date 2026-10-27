# Decisões de implementação

| ID    | Decisão                                                | Motivo e consequência                                                                                                                                                                                      |
| ----- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-001 | Iniciar projeto limpo                                  | A pasta fornecida estava vazia. O trecho do GDD que menciona base existente não correspondia ao workspace; nada foi reescrito ou descartado.                                                               |
| D-002 | Preservar as referências, construir interface real     | As imagens orientam composição e paleta. Não viram plano de fundo clicável; dados e ações vêm do servidor.                                                                                                 |
| D-003 | Comprar Hortolândia por 1.850.000 cr                   | As referências divergem entre 1,85 milhão e 18,5 milhões. A tela específica de compra usa 1,85 milhão e é compatível com o saldo inicial de 2,85 milhões. O cenário adota esse valor de forma consistente. |
| D-004 | Um relógio de laboratório a 120×                       | Permite verificar transporte e produção em minutos reais. A conversão é exibida e compartilhada por custos e eventos; será calibrada no playtest.                                                          |
| D-005 | SQLite antes de PostGIS                                | Entrega uma fatia transacional executável sem infraestrutura externa. O modelo por snapshot é temporário e tem migração relacional explícita no roteiro.                                                   |
| D-006 | Duas contas locais, sem login público                  | Demonstra propriedade e mercado compartilhados em uma instância. Não equivale a MMO autenticado. A API escuta apenas `127.0.0.1`.                                                                          |
| D-007 | Mapa claro, controles azul-escuros e ações douradas    | Hierarquia fiel aos arquivos numerados; Lucide e Inter mantêm consistência. O mapa usa dados reais e geometrias do jogo na escala geográfica.                                                              |
| D-008 | Preview cartográfico em vez de foto aérea sintética    | Não há imagem de satélite licenciada vinculada à propriedade. O preview mostra o lote virtual no mapa e é identificado como cartografia.                                                                   |
| D-009 | Frota dimensionada por peso e volume reais do catálogo | Quantidades acima da capacidade não cabem em um único frete. A compra padrão industrial é de 24 t, adequada a um caminhão de 30 t.                                                                         |
| D-010 | Resultado calculado, sem copiar KPIs decorativos       | Valores das imagens são referência visual. O saldo, receita, custos e patrimônio exibidos são derivados do estado do laboratório.                                                                          |
| D-011 | Oportunidades como cenário explícito                   | Índices e projeções ainda não refletem toda a economia. São identificados como parâmetros simulados; realimentação está na fase 04.                                                                        |
| D-012 | Pagamento imediato e sem escrow                        | A compra inicial liquida mercadoria e frete no fechamento; o estoque chega depois. Condições mais complexas dependem do sistema de contratos.                                                              |
| D-013 | Preservar área física ao desenhar propriedades         | Marcadores mantêm tamanho legível, mas os polígonos não são artificialmente ampliados para reproduzir as proporções ilustrativas dos mockups.                                                              |

Essas decisões não alteram o GDD original. Elas definem o que a versão 0.1 demonstra e onde a implementação ainda precisa evoluir.

### D-014 · Cartografia limpa com malha viária e natureza

Em 26/10/2026, a pedido do usuário, o mapa principal e os previews passaram a usar um estilo local de 10 camadas, substituindo as 119 camadas do Bright. Exibe água, matas, areia/gelo e a malha viária: autoestradas, estradas principais/secundárias, vias locais e acessos. Retira rótulos, ícones, aeroportos, prédios e zoneamento urbano. Gramados também ficam fora porque podem reproduzir silhuetas de pistas e equipamentos urbanos.

O usuário refinou o pedido para preservar estradas de ligação e melhorar cores e recortes por zoom. Todas as vias usam a geometria de `transportation`, sem exigir nome/número e sem reutilizar as linhas incompletas de rótulos de `transportation_name`. Classes `motorway/trunk/primary/secondary/tertiary/minor/service/track` têm a mesma curva contínua de espessura em superfície, ponte e túnel. Vias menores recebem menos contraste e ganham espessura ao aproximar; rodovias usam dourado suave, conexões marfim e água azul dessaturado sobre terreno sálvia. Não há cortes artificiais por `maxzoom` nem filtro por `ref`. A generalização e a disponibilidade de detalhes por zoom do provedor continuam limites da base; a apresentação não altera o roteamento de cargas.

O estilo não carrega glyphs, sprites nem um JSON de estilo externo. Os tiles vetoriais e seus dados urbanos continuam sendo baixados; a redução demonstrada é de camadas/recursos de apresentação, sem percentual de FPS ou de tráfego prometido. Antes de introduzir tiles filtrados e infraestrutura própria na fase 03, medir tráfego, memória e fluidez em dispositivo modesto. Busca, camadas do jogo e atribuição do OpenFreeMap/OpenMapTiles/OSM permanecem disponíveis.

### D-015 · Economia interna por temporada

A pedido do usuário, referências externas são usadas apenas para preparar a abertura e os balanceamentos futuros. A configuração econômica é copiada para cada mundo e não muda por uma edição do template. Não há cotações externas durante a season. BRL substitui créditos; fontes/faixas são âncoras simuladas, não preços locais oficiais. Esta decisão substitui o valor imobiliário de D-003 para imóveis ainda disponíveis (Hortolândia: 12.000 m² e R$ 2,4 milhões), preservando imóveis adquiridos e saldos. D-011 evolui para preços/estoques/negócios observados mais demanda modelada, com procedência separada.

### D-016 · Explicação progressiva e decisões comerciais deliberadas

Filtros abrem vazios. Contexto de reposição só preenche produto/destino quando o jogador inicia esse fluxo. Fornecedor e transportadora exigem escolha. Catálogo completo, resumo simples, análise avançada e tabela compartilham a mesma regra. ECharts acrescenta ferramentas analíticas profissionais sem criar histórico fictício; ausência de negócio não produz candles. Mercados próximos agrupam no mapa para preservar legibilidade, sem somar áreas de influência.

### D-017 · Custos e movimento com consequência

Água/energia são consumidas e pagas, folha volta aos consumidores e manutenção permanece ao pausar. Mão de obra e logística expõem componentes. O caminhão interpola a geometria contratada pelo tempo salvo; a chegada visual aguarda confirmação autoritativa. Coprodutos conservam o custo agregado. A simulação de 30 dias denuncia rupturas e não as esconde com estoque infinito. Ver `GAME-DESIGN-AUDIT.md`.

### D-018 · Contratação e formação por estado

A pedido do usuário, substitui-se o pool regional por contratação disponível em todas as praças. Salário por atividade × multiplicador estadual × índice interno semanal. Formação paga é média da equipe, diluída ao contratar; melhora apenas novos lotes. Não usar desemprego externo durante uma season.

### D-019 · Editais estaduais com recebimento municipal

Cada UF mantém saldo/reservas e paga projetos no piloto. O teto por unidade é referência interna +25%, salvo no edital; nunca uma fração alta do tesouro. Janela competitiva, pontuação de qualidade/preço/prazo/frete e revalidação no fechamento. Prefeituras são pontos virtuais de entrega. Contratos anteriores conservam os termos. Sem fornecedor válido, não há gasto.

### D-020 · Pedidos e abastecimento com execução física

Necessidades abertas e propostas usam os mesmos comandos para humanos e bots. Aceitação pela contraparte contrata o transporte; estoque/caixa são revalidados. Política automática por unidade controla origem interna, qualidade, preço, frete, orçamento e caixa protegido. Projeção indica hipóteses e chegada efetiva. Transferência própria não gera venda nem exige operação produtiva ativa. Todos os caminhões pertencem ao mesmo pedido logístico.

### D-021 · Concorrência finita e atualização aditiva

Adicionados 30 bots, financiados por transferência do orçamento existente dos consumidores. Estoque/instalação/frota iniciais são finitos e pagos. Registro de capacidades e teste de cobertura por receita obrigam manutenção explícita do comportamento. Migração com backup conserva patrimônio humano, estoques, históricos e contratos; ticks vencidos da manutenção não recebem regras novas retroativamente. Não há consulta econômica externa nem resgate monetário invisível.
