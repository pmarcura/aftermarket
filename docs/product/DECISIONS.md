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

### D-022 · Recuperação usa dinheiro existente

Obrigações reconhecidas separam caixa e despesa; pagamento não duplica custo. Crédito estadual com garantia e verba finita, taxa única e principal em 30 dias substitui resgate invisível. Suspensão reduz estrutura e preserva estoque/ativos. Venda de veículo respeita garantia remanescente. Inadimplência permanece visível; execução automática de garantia fica pendente. Parâmetros novos são copiados para `season.config.design`; editar o template não rebalanceia seasons já abertas.

### D-023 · Pedidos podem proteger caixa e referência pública exige negócios

Evolui D-012: compra imediata continua paga no despacho; pedidos podem vincular caixa até aceite/cancelamento/expiração. Não reservam estoque antes da aceitação. Referência de editais abandona anúncios em favor de negócios qualificados/diversos e limite diário; não alterar contratos existentes. Mitigação de anúncios não equivale a prova contra conluio com contas independentes.

### D-024 · Trajeto visual respeita estrada e contrato

Novo despacho no servidor exige OSRM salvo. Cache/fila podem adiar ação, nunca cobrar uma linha reta. Geometria contratada é compartilhada e imutável; legado estimado recebe apenas correção visual. Marcadores ficam na estrada, com destaque por caminhão em caso de sobreposição. Perfil automotivo, coleta vazia estimada e ausência de retorno planejado são declarados. A consulta é geográfica e não viola D-015.

### D-025 · Aquisição não contrata uma empresa pronta

Nova propriedade começa sem equipamento/equipe. Jogador revisa instalação, contratação e capital de giro. Unidades anteriores mantêm equipe/instalação sem cobrança duplicada. Instalação é imediata no laboratório. Cenário iniciante usa banco separado, nunca reset do mundo ativo.

### D-026 · Decisão de transporte tem capacidade visível

Substituir lista cega de empresas por cartões com busca, livres/total, massa/volume, máximo por produto e máximo da operação. Arredondamento por caminhão e espaço comprometido são comuns ao motor e à interface. Usar máximo é ação explícita; caixa/prazo/frete são limites adicionais. Informação parcial não se apresenta como cotação completa.

### D-027 · Conexões de insumos e alertas recuperáveis

Regra pode fixar unidade própria como origem; quando esgota, aguarda, sem trocar de fornecedor silenciosamente. Atalho informa que orçamento e frota são compartilhados por todas as regras do destino. Rotas, caixa, propriedade e estoque são revalidados por comandos comuns. Alertas de ação ficam na camada do modal, erros não somem por timeout, recebimentos são agrupados por pedido e leitura fica local por empresa/dispositivo. Pendências operacionais não desaparecem ao marcar recebimentos como lidos.

### D-028 · Direção do playtest e da economia (Pedro, 27/10/2026)

- **Playtest em mundo semanal livre:** o mundo roda a semana toda e cada amigo entra quando puder, sem horário combinado. Automação e proteção de quem fica offline passam a ser obrigatórias, e o relógio de laboratório (D-004, 120×) precisa ser recalibrado para um ritmo semanal.
- **Realismo enxuto, cadeias completas:** só entra o que cria escolha para o jogador, mas cada cadeia fecha do começo ao fim. Semente vira item comprável; o leite vem de vacas que comem ração feita do farelo.
- **Fechar metal e alimentos antes de crescer:** produto novo só entra para fechar um furo.
- **Aço ganha compradores privados:** fábrica de bens de consumo (utensílios para lojas) e caminhões para as frotas, junto com uma melhoria da mecânica de logística. O governo continua comprando para obras.

Proposta de desenho em `docs/economia-proposta.html`. Nenhuma regra do motor mudou nesta decisão.

### D-029 · Proposta 1 aprovada e regras de calibração (27/10/2026)

O Pedro aprovou a proposta 1 das cadeias, incluindo sucata já, carne depois do playtest e relógio de 1 hora real = 6 horas de jogo. Para calibrar: preços dentro das faixas de referência; parcela de consumidores de 1% para 2%, para o mundo comportar cerca de 45 empresas; custo de equipamento por receita como botão de ajuste, com retorno alvo de 35 dias (indústria, mina), 30 (fazenda) e 40 (loja); loja atendendo 50 unidades por pessoa por rodada. Números e hipóteses em `ECONOMIA-ALVO.md`, fonte única em `economy-design.ts`.

### D-030 · Concessionária de caminhões importados (27/10/2026)

O Pedro aprovou manter uma concessionária institucional que vende caminhões importados 30% acima do preço alvo da montadora. Evita que o mundo trave sem montadora, funciona como teto de preço para quem monta caminhões e o pagamento sai da economia para o tesouro.

### D-031 · Abertura e ciclo do dinheiro no mundo versão 2 (28/10/2026)

Decisões de rotina da fatia 8, reversíveis e válidas só no mundo versão 2:

- **Gasto público com as famílias:** cada tesouro estadual devolve aos consumidores 30% ao dia do saldo livre acima de R$ 1,5 milhão, reservado para obras. Sem isso, as famílias gastavam R$ 654 mil por dia e recebiam R$ 208 mil em salários, e o dinheiro se acumulava nos tesouros até travar o varejo no dia 25. O dinheiro continua se conservando.
- **Rivais da abertura:** 30 empresas cobrindo as 13 especialidades com linhas, equipamento, rebanho e sementes pagos ao tesouro. O capital sai do orçamento dos consumidores. Os bots cobrem de 60% a 90% das linhas da calculadora; o restante fica para os jogadores.
- **Lojas-bot por população:** vão às cidades ainda sem loja, da mais populosa para a menor, com equipe para 60% da procura local. São Paulo tem cerca de 60% da procura e estava sem loja.
- **Caminhão em qualquer unidade própria:** sem transportadora ou armazém, o caminhão comprado fica no pátio de qualquer unidade da empresa. As três transportadoras-bot ganham pátio próprio.
- **Compra em dias de uso e teto de frete:** os bots repõem insumos para 3 dias de consumo e não aceitam frete acima de 30% do preço do item. Carga pequena espera juntar volume.

### D-032 · Telas de frota e venda de caminhão usado no mundo versão 2 (28/10/2026)

Decisões de rotina da fatia 9, reversíveis:

- **Venda ao fundo estadual cai com a quilometragem (só versão 2):** o caminhão vale 65% do preço pago quando novo e perde até metade disso no fim da vida útil (piso de 32,5%). Antes, um caminhão no fim da vida valia os mesmos 65% de um novo, então ninguém desmontaria nada e a sucata dos caminhões não chegaria às siderúrgicas. A versão 1 continua com 65% fixos.
- **Compra de caminhão escolhe o vendedor:** a tela lista as montadoras com o caminhão anunciado, do mais barato ao mais caro, e a concessionária por último, como teto. Montadora própria entrega pelo custo do estoque.
- **Pátio da transportadora tem estoque e vendas:** a sucata de um caminhão desmontado fica no pátio e pode ser anunciada ou enviada a outra unidade.
- **Mundo de teste da versão 2:** `npm run dev:v2` abre um mundo separado (`.runtime/economy-2.sqlite`, porta 5186) sem tocar no mundo principal. O laboratório também aceita o cenário `economy-2`.

### Ideia em avaliação · Genética de cultivares (Pedro, 28/10/2026)

O Pedro propôs um sistema de genética a partir de uma pesquisa sobre a cana. O produtor compra uma pequena quantidade de mudas de alta tecnologia no viveiro e as multiplica numa área própria. Depois replanta com a própria cana por anos e só volta a comprar para trocar de variedade, para limpar o canavial de doenças ou para expandir a área de uma vez.

O motor já cobre a parte de replantar com a própria cana: a colheita devolve 110% da muda. Ainda faltam:

- variedades com atributos (produtividade, resistência, uso de água);
- viveiro licenciado vendendo genética melhor;
- perda gradual de produtividade a cada corte (cultura semiperene);
- doença que obriga a renovar o plantio.

Recomendação: avaliar depois do playtest 1. A ideia cria escolhas reais, mas acrescenta estado por talhão e exige equilíbrio próprio. Antes disso, o playtest precisa provar que as cadeias atuais fecham.
