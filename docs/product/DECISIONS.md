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

### D-033 · Balanceamento da versão 2 e começo do jogo (28/10/2026)

Pedido do Pedro: "faça todos os balanceamentos necessários e deixe a interface mais intuitiva e boa para começar o jogo". Decisões de rotina da fatia 10, reversíveis e válidas só no mundo versão 2, medidas por `npm run economy:proof` (resultado em [PROVA-V2](PROVA-V2.md)):

- **Preço dos bots mira a referência de fábrica.** O bot vende 8% abaixo do preço de referência quando tem estoque sobrando e até 8% acima quando falta, nunca abaixo do próprio custo. Antes cobrava custo mais margem: o arroz no atacado passava do preço de prateleira (R$ 31,92 contra R$ 24,50) e o leite despencava para R$ 2,16 (referência R$ 5,08). A loja-bot mira o preço de prateleira da referência. O estoque inicial dos produtores passou a ser custeado pelo preço de fábrica.
- **Empresas antigas alinhadas.** As minas, a fazenda e a fábrica de óleo das empresas da versão 1 passam a ter uma linha de equipamento e a equipe do perfil, como os rivais. Produziam sem limite e abriam com semanas de estoque, derrubando o preço do ferro e da soja.
- **Bots não compram imóveis.** A abertura já cobre a parte deles; os lotes livres ficam para os jogadores. Antes os bots levavam todos os lotes baratos nas duas primeiras horas.
- **Lotes livres do tamanho de poucas linhas.** Fazenda de 80 ha, mina para 2 linhas, indústria de 12 mil m², loja de 600 m², armazém e pátio de 15 mil m², ao preço de terra da calculadora (R$ 45 mil a R$ 132 mil). Antes uma fazenda custava R$ 22 milhões.
- **Editais públicos menores.** Lotes a 1/4 do tamanho (média de 14 t de aço) e oferta de 2,2× as 16 t/dia de aço público, porque metade expira sem proposta válida. Antes os editais pediam 56 t de uma vez e só 10% eram atendidos.
- **Caminhão com vida útil comprimida.** Pesado 25 mil km e leve 15 mil km (parâmetro simulado), e a frota inicial espalhada até 95% da vida. No jogo um caminhão roda cerca de 190 km por dia; com a vida real nenhum chegaria ao fim numa temporada e as montadoras ficavam sem clientes.
- **Sucata da coleta municipal** volta a custar R$ 1.200/t; um defeito a anunciava a R$ 0,01.
- **Começo enxuto no mundo jogável.** Cada jogador começa com uma loja vazia, 8 funcionários e R$ 1 milhão livre. Os outros negócios voltam ao mapa como lotes à venda. Só no cenário jogável (`npm run dev:v2`); o mundo dos testes automáticos segue igual.
- **Primeiros passos na interface.** Guia de 5 etapas conferidas pelo estado do jogo (comprar, receber, vender, abrir produção, produzir), aberto na primeira visita e no menu lateral. Mercado mostra primeiro o que o destino usa, com margem sobre a prateleira e quantidade sugerida; Oportunidades mostra quanto custa e quanto rende abrir cada negócio.

### D-034 · Brasil real, 500 bots e motor leve (30/10/2026)

Pedido do Pedro: mapa leve, negócios onde existem de verdade, 500 bots. Decisões de rotina, válidas para mundos novos (versão 2); o mundo principal salvo não muda:

- **Pacote enxuto do navegador:** cada jogador recebe o próprio extrato de 7 dias, o recente dos outros e totais calculados no servidor. No dia 30, 32 MB viraram 477 KB (67 KB comprimidos); com 557 empresas, 1,5 MB (197 KB) uma vez por rodada.
- **Servidor com o mundo na memória:** grava a cada 5 s e a cada comando; comando recusado no meio volta ao estado anterior. O histórico com mais de 15 dias vai para tabelas de arquivo, sem apagar nada.
- **Centro-Sul real:** 59 municípios com código do IBGE (coordenadas aproximadas da sede, Censo 2022 arredondado). Cada atividade nasce no seu polo real: ferro no Quadrilátero, carvão em SC e RS, aço em Ipatinga, Ouro Branco, Volta Redonda e Serra, soja em MT, GO e PR, arroz em Uruguaiana, cana em Ribeirão Preto e assim por diante.
- **Escala do mundo:** a abertura sai da calculadora vezes a escala (1 = mundo de referência; 20 = cerca de 500 empresas-bot). Bots ficam com 80% das linhas, em empresas de 1 a 4 linhas; lojas-bot por cidade conforme a procura; distribuidores regionais nas cidades acima de 600 mil habitantes; 22 transportadoras regionais nos polos.
- **Frete pela estrada estimada nos mundos novos:** a prova da economia sempre usou distância estimada; esperar o serviço público de rotas (1 pedido por segundo) travaria as compras com dezenas de cidades. A rota real só desenha o caminho.
- **Defeitos achados no caminho:** compra de quantidade quebrada em toneladas era sempre recusada como carga incompatível (estrangulava a cadeia do metal desde a versão 2); o teto de frete dos bots usava o insumo mais barato para todos (carvão distante sempre recusado), agora é por produto; lojas da mesma cidade estocavam a cidade inteira cada uma.
- **Busca de fornecedor em escala:** cada compra cota a própria empresa, as transportadoras, o vendedor e as 4 frotas mais próximas da carga, e só as 6 ofertas mais baratas com frete estimado. Com 260 bots, o dia de jogo caiu de 36 s para 1,2 s; com 486 bots fica perto de 8 s.

### D-035 · Jogador é um empresário com grupo de empresas (Pedro, 30/10/2026)

Decisão do Pedro, que substitui a regra antiga de "nenhum sistema de fusões":

- **Empresário:** cada jogador (e cada bot) é um empresário com nome, descrição e imagem, e caixa pessoal.
- **Grupo:** o empresário tem uma ou mais empresas, cada uma com caixa, unidades e dívidas próprias. Começa com uma (a loja). Abrir ou comprar empresas exige muito dinheiro: não pode ser fácil ter muitas.
- **Dividendos e capital:** lucro sobe para o caixa pessoal; o caixa pessoal põe capital nas empresas.
- **Quebra só da empresa:** aviso → crédito do tesouro com garantia → venda de unidades → leilão aberto. O empresário segue com as outras empresas e o caixa pessoal; sem recomeço artificial.
- **Compra de empresas inteiras** entre grupos (jogadores e bots), com dívidas e tudo; as empresas não se fundem.
- **Contra abuso:** dívida de empresa quebrada cobra primeiro os dividendos tirados dela nos dias anteriores e bloqueia crédito por um tempo; limite de concentração de 40% de um produto por grupo (como o CADE).
- **Ranking por grupo**, com bots e jogadores juntos. Bots usam exatamente os mesmos comandos.

Detalhes de implementação e números no documento de passagem (`.planning/HANDOFF.md`).

### D-036 · Frete do Brasil real nos preços e defeitos de escala (30/10/2026)

Pedido do Pedro: calibrar a economia versão 2 no Brasil real com cerca de 500 bots (escala 20). Decisões de rotina, válidas para mundos novos; o mundo principal salvo não muda. Medição em [PROVA-V2-ESCALA-20](PROVA-V2-ESCALA-20.md).

- **Preço de fábrica desconta o frete real.** A calculadora supunha 110 km por carga; no mapa real a média é perto de 730 km. Agora cada item tem a distância média entre os polos que produzem e os que compram (cada polo manda para o comprador mais perto que ainda precisa) e o frete de caminhão pesado cheio (R$ 0,28 por tonelada-km com metade da volta vazia, mais carga e descarga; consumo final paga ainda a entrega na cidade). Arroz viaja ~1.530 km, carvão ~1.400 km, farelo ~580 km, leite ~430 km. Como no mundo real, a porta da fazenda longe do mercado vale menos: arroz R$ 17,37 (era R$ 20,39), leite R$ 4,75 por litro na fábrica.
- **Ajustes de faixa para manter 8% de margem:** soja na porta da fazenda no ponto 0,4 da faixa (R$ 2.340/t), ração no ponto 0,75 (R$ 2,98/kg, paga o farelo de longe) e leite no ponto 0,62 da faixa de varejo (R$ 6,17). Todas as verificações da calculadora passam.
- **Atacadista tem margem própria:** distribuidor-bot vende pelo custo posto (que já inclui o frete longo) mais 4%, até 8% com falta no mercado. Antes vendia a ±8% da referência de fábrica, às vezes acima da prateleira (arroz a R$ 24,72 contra R$ 24,50 na loja).
- **Distribuidor compra caminhão cheio:** pede quando falta uma carga de caminhão pesado para o alvo. Antes pedia o que faltava, às vezes 4 t para 1.300 km, e o frete passava do teto.
- **Defeitos de escala corrigidos:** (1) o bot comparava o próprio estoque com a procura do país inteiro e todo vendedor se achava em falta, cobrando 8% acima da referência; agora conta o estoque do mercado todo. (2) Os editais de aço e a reserva de obras dos tesouros não cresciam com a escala; com 20× siderúrgicas o governo pedia 1/20 do aço. (3) Pedido aberto do bot pedia o alvo inteiro (400 t de arroz), não achava vendedor e travava a reposição por dias; agora pede até duas cargas e pedido aberto sem vendedor não conta como compra feita.
- **Régua da prova:** o resultado por especialidade soma o estoque formado e deixa de fora caminhões comprados e educação da equipe (investimentos); empresa com duas unidades contava duas vezes. Lojas e distribuidores entram na tabela.

### D-037 · Rotas saem e chegam pela entrada dos imóveis (30/10/2026)

Pedido do Pedro: rota do mapa passava longe do imóvel e cortava a cidade em retas. Decisões de rotina:

- **Entrada na via:** cada imóvel é encaixado na rua mais próxima (até 5 km), confirmada com ida e volta no serviço de rotas; a posição do imóvel passa a ser essa entrada. Sem acesso confirmado, o imóvel não pode ser comprado nem receber transporte no mundo principal. O mundo principal ganhou backup antes da primeira validação (`.runtime/backups/pre-road-access-*.sqlite`); economia, estoques e viagens não mudam.
- **Rota só vale entre as duas entradas** (até 25 m de cada ponta); rota antiga que não bate é pedida de novo.
- **Desenho fiel:** o traçado deixa de ser cortado em 150 pontos (retas de ~9 km nas viagens longas) e passa a ter desvio máximo de 10 m, com as pontas exatas. Medido no mundo principal: 0 m entre a ponta e a entrada em todas as viagens; 10 m pesam 58% menos que 2 m.
- **Mundo versão 2:** valida as entradas e desenha as rotas reais dos caminhões dos jogadores, mas o frete segue a distância estimada (D-034): exigir rota real para ~500 bots travaria a economia. Caminhão sem rota confirmada não aparece com linha reta no mapa.
- **Defeito achado no caminho:** os ícones de categoria ganharam `xmlns` duplicado com a versão nova da biblioteca de ícones; o SVG ficava inválido e o mapa não terminava de abrir.

### D-038 · Pedido aberto sem resposta não trava a compra das usinas (28/10/2026)

Calibração da cadeia do metal com ~500 bots. Decisões de rotina:

- **Anúncio de procura não é gasto.** Quando falta insumo, o bot publica um pedido aberto para qualquer vendedor responder. O valor desses pedidos contava como dinheiro já gasto no dia; três anúncios parados de minério, carvão e sucata passavam do orçamento inteiro, e 11 de 12 usinas deixavam de comprar das minas cheias a 100 km. Agora só conta pedido com vendedor ou proposta (como a posição de estoque desde a D-036).
- **Responde quem está perto.** Os bots vendedores que respondem a pedidos abertos são os quatro mais próximos do comprador, não os quatro de menor custo do país (que podiam estar a 1.500 km e nunca cabiam na verba de frete).
- **Testado e descartado: reservar o estoque do lance em edital.** Com o aço separado até o fechamento, cada usina só disputava um edital por vez e o aço ao governo caiu de 217 para 100 t/dia. Fica como está: a usina pode dar lance em vários editais com o mesmo estoque e o lance cai se o estoque acabar.
- **Resultado (escala 20, 2 sementes, últimos 10 de 20 dias):** minério de 9 para 36 linhas, carvão de 9 para 35, aço de 16 para 68 (64% da referência; os bots abrem com 80%); siderúrgicas de −R$ 35 mil para +R$ 475 mil por dia; aço ao governo de 11,7 para 213 t/dia (meta 320); procura atendida de 38% para 50%; nenhuma quebra.
- **Ainda abaixo da meta do governo:** cada edital pede de 6 a 24 t de uma só usina; as fábricas compram o aço assim que sai do forno e os editais de 24 t expiram sem lance. Fica para depois da ração.

### D-039 · Carga que valha a viagem e ração pelo frete real (28/10/2026)

Calibração da ração com ~500 bots. Decisões de rotina:

- **Acima do mínimo, só carga que valha a viagem.** Indústria e atacado (jogadores e bots) só compram acima do estoque mínimo se a carga encher meio caminhão pesado ou cobrir tudo o que falta; abaixo do mínimo aceitam qualquer carga. Antes a fábrica de ração levava cada 1,5 t de farelo que saía da esmagadora vizinha: 175 cargas de menos de 5 t por 48 km, a R$ 228/t, cinco vezes o frete de carga cheia. Lojas ficam de fora (compram pouco e perto).
- **Ração no ponto 0,85 da faixa real (R$ 3,11/kg, era R$ 2,98).** O farelo de ~1.000 km chega em cargas de 15 a 25 t, e o frete pago (~R$ 350/t) é o dobro dos R$ 172/t da calculadora, que supõe caminhão cheio. A ordenha, que lucra R$ 2,5 milhões por dia, absorve os 4%. Todas as 67 verificações da calculadora passam; margem de projeto da ração 16%, do leite 60%.
- **Resultado (escala 20, 2 sementes, últimos 10 de 20 dias):** ração de −R$ 162 mil para −R$ 20 mil por dia; esmagadoras de −R$ 18 mil para +R$ 36 mil; lojas de +R$ 239 mil para +R$ 324 mil; procura atendida 51%; nenhuma quebra.
- **Ruído entre rodadas continua grande:** utensílios variaram de −R$ 16 mil a −R$ 164 mil com mudanças que não tocam a cadeia deles; aço ao governo de 184 a 213 t/dia. Próximo a investigar.

### D-040 · Preço de referência dos utensílios sobe para 0,6 da faixa (28/10/2026)

Calibração dos utensílios com ~500 bots. Decisões de rotina:

- **Causa:** o aço que as fábricas de utensílios compram custa cerca de 17% acima da referência, porque as usinas produzem ~64% do previsto e o governo disputa o mesmo aço. A margem de projeto era de 11%, então o resultado oscilava de −R$ 16 mil a −R$ 164 mil por dia entre rodadas com o mesmo código.
- **Mudança:** ponto de preço dos utensílios de 0,5 para 0,6 da faixa de R$ 40 a R$ 90 (kit de R$ 65 para cerca de R$ 70 na prateleira). Margem de projeto de 11% para 18%. Todas as verificações da calculadora passam.
- **Custo aceito:** o kit fica mais caro para o jogador. A demanda das famílias no motor não depende do preço, então a receita sobe; os distribuidores pagam mais e perdem cerca de 11%.
- **Resultado (escala 20, 2 sementes, últimos 10 de 20 dias):** fábricas de utensílios de −R$ 164 mil para +R$ 84 mil por dia (sementes: +49 mil e +118 mil); lojas de +R$ 324 mil para +R$ 478 mil; distribuidores de +R$ 1,66 mi para +R$ 1,48 mi; procura atendida 51%; nenhuma quebra.
- **Alternativa não feita:** atacar o aço caro, aumentando a produção das usinas. Fica para quando a cadeia do metal estiver mais perto da referência.
- **Equipamento:** a calculadora fixa o payback em 35 dias para toda linha; o equipamento sobe com o lucro, então o preço maior não encarece o retorno. Verificado em 28/10 (a suspeita inicial estava errada).

### D-041 · Caminhão leve: referência ajustada à procura real (28/10/2026)

Fechamento da calibração. Caminhão leve estava no prejuízo (−R$ 16 mil por dia) porque o projeto previa 8 linhas, e o mundo compra ~4 por dia.

- **Diagnóstico:** a regra de compra de frota só escolhe caminhão leve para empresa que só tem lojas, ou para transportadora com pelo menos duas pesadas para cada leve. As 6 unidades trabalhavam a ~22% da capacidade, com 20 operários e 12 mil m² cada.
- **Testado e descartado: preço do leve de 0,5 para 0,6 da faixa.** Piorou (−R$ 66 mil por dia), porque a compra caiu.
- **Mudança:** a necessidade de caminhão leve da calculadora cai de 0,8 para 0,2 por dia (de 8 para 2 linhas no mundo de 500 bots). A regra de compra não muda.
- **Resultado (escala 20, 2 sementes, últimos 10 de 20 dias):** caminhão leve de −R$ 16 mil para −R$ 2 mil por dia; linhas observadas de 1,8 para 1,4 contra referência de 2,0; compras de leve de 3,5 para 4,1 por dia. Cobertura e aço ao governo sem mudança relevante.
- **Ruído:** utensílios e ração variaram entre as duas rodadas (utensílios de +84 mil para +38 mil; ração de +9 mil para −51 mil), no intervalo que já vimos com código idêntico.
- **Equipamento:** a suspeita inicial estava errada. Toda linha da calculadora tem payback de 35 dias; o equipamento sobe com o lucro por design.

### Ideia em avaliação · Genética de cultivares (Pedro, 28/10/2026)

O Pedro propôs um sistema de genética a partir de uma pesquisa sobre a cana. O produtor compra uma pequena quantidade de mudas de alta tecnologia no viveiro e as multiplica numa área própria. Depois replanta com a própria cana por anos e só volta a comprar para trocar de variedade, para limpar o canavial de doenças ou para expandir a área de uma vez.

O motor já cobre a parte de replantar com a própria cana: a colheita devolve 110% da muda. Ainda faltam:

- variedades com atributos (produtividade, resistência, uso de água);
- viveiro licenciado vendendo genética melhor;
- perda gradual de produtividade a cada corte (cultura semiperene);
- doença que obriga a renovar o plantio.

Recomendação: avaliar depois do playtest 1. A ideia cria escolhas reais, mas acrescenta estado por talhão e exige equilíbrio próprio. Antes disso, o playtest precisa provar que as cadeias atuais fecham.
