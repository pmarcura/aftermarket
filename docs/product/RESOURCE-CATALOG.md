# Catálogo verificável de recursos

Fonte: abertura do código em 27/10/2026. Gerado por `npm run resources:catalog`. Não editar tabelas manualmente.

Parâmetros de jogo; nenhuma cotação externa foi verificada. Valores de abertura não são ofertas garantidas. Estoques são a observação desta fonte, não reposição gratuita. Veja [padrão matemático e admissão](RESOURCE-STANDARD.md).

Estrutura: **válida**. Equilíbrio: **não demonstrado**. 10 itens / 9 receitas.

## Itens, obtenção e destinos

| Item / ID                  | Unidade; kg; m³  |    Abertura | Receita de origem | Uso produtivo        | Destino final alcançável | Estoque; ofertado; fornecedores |
| -------------------------- | ---------------- | ----------: | ----------------- | -------------------- | ------------------------ | ------------------------------- |
| Minério de ferro / `iron`  | t; 1.000; 0,45   |   R$ 500,00 | iron-extraction   | steel-bars           | iron → steel             | 2.733; 1.855; 7                 |
| Carvão mineral / `coal`    | t; 1.000; 1,3    | R$ 1.800,00 | coal-extraction   | steel-bars           | coal → steel             | 335; 170; 4                     |
| Aço em barras / `steel`    | t; 1.000; 0,15   | R$ 4.800,00 | steel-bars        | —                    | steel                    | 120; 96; 3                      |
| Soja em grão / `soy`       | t; 1.000; 1,4    | R$ 2.500,00 | soy-harvest       | soy-oil, soy-harvest | soy → oil                | 778; 599; 1                     |
| Farelo de soja / `soymeal` | kg; 1; 0,0017    |     R$ 2,30 | soy-oil           | milk-production      | soymeal → milk           | 3.000; 1.500; 3                 |
| Óleo de soja 1 L / `oil`   | un; 0,92; 0,0013 |     R$ 8,49 | soy-oil           | —                    | oil                      | 20.000; 15.600; 4               |
| Arroz 5 kg / `rice`        | un; 5; 0,007     |    R$ 23,45 | rice-harvest      | rice-harvest         | rice                     | 3.388; 2.000; 1                 |
| Feijão 1 kg / `beans`      | un; 1; 0,0015    |     R$ 8,70 | beans-harvest     | beans-harvest        | beans                    | 2.276; 1.500; 1                 |
| Açúcar 5 kg / `sugar`      | un; 5; 0,006     |    R$ 17,45 | sugar-harvest     | sugar-harvest        | sugar                    | 1.986; 1.500; 1                 |
| Leite 1 L / `milk`         | un; 1,03; 0,0012 |     R$ 5,49 | milk-production   | —                    | milk                     | 2.685; 2.400; 4                 |

Todos os itens podem ser anunciados no atacado e negociados/transferidos com estoque, caixa, espaço e frota. Somente os cinco itens nos canais familiares são efetivamente consumidos pelas lojas. Aço é consumido pelos editais; farelo depende da produção de leite. Um caminho no grafo não garante demanda, margem, rota disponível ou compra.

## Fornecedores observados nesta fonte

| Produto          | Unidade anunciante                   | Cidade/UF                | Estoque livre anunciado | Preço por unidade, antes do frete |
| ---------------- | ------------------------------------ | ------------------------ | ----------------------: | --------------------------------: |
| Minério de ferro | Minas Ferro S.A. / e-minasferro      | Itabira/MG               |                   500 t |                         R$ 500,00 |
| Minério de ferro | FerroVale Comercial / e-ferrovale    | Limeira/SP               |                   180 t |                         R$ 500,00 |
| Minério de ferro | Metais Horizonte / e-metais          | Belo Horizonte/MG        |                   950 t |                         R$ 500,00 |
| Minério de ferro | Distribuidora Aurora / e-supplier    | Americana/SP             |                    90 t |                         R$ 500,00 |
| Minério de ferro | Atlântica Recursos / e-rival-3       | Americana/SP             |                    45 t |                         R$ 600,00 |
| Minério de ferro | Impulso Recursos / e-rival-13        | Itabira/MG               |                    45 t |                         R$ 600,00 |
| Minério de ferro | Vale Verde Recursos / e-rival-23     | Campinas/SP              |                    45 t |                         R$ 600,00 |
| Carvão mineral   | FerroVale Comercial / e-ferrovale    | Limeira/SP               |                    80 t |                       R$ 1.800,00 |
| Carvão mineral   | Caminhos Recursos / e-rival-4        | Limeira/SP               |                    30 t |                       R$ 2.160,00 |
| Carvão mineral   | Bandeirante Recursos / e-rival-14    | Belo Horizonte/MG        |                    30 t |                       R$ 2.160,00 |
| Carvão mineral   | Primavera Recursos / e-rival-24      | Piracicaba/SP            |                    30 t |                       R$ 2.160,00 |
| Aço em barras    | Horizonte Industrial / e-rival-1     | Campinas/SP              |                    32 t |                       R$ 5.760,00 |
| Aço em barras    | Raízes Industrial / e-rival-11       | Sorocaba/SP              |                    32 t |                       R$ 5.760,00 |
| Aço em barras    | Serrana Industrial / e-rival-21      | São Paulo/SP             |                    32 t |                       R$ 5.760,00 |
| Soja em grão     | AgroVale Alimentos / e-agro          | Santa Bárbara d’Oeste/SP |                   599 t |                       R$ 2.500,00 |
| Farelo de soja   | Pioneira Industrial / e-rival-2      | Piracicaba/SP            |                  500 kg |                           R$ 2,76 |
| Farelo de soja   | Planalto Industrial / e-rival-12     | São José dos Campos/SP   |                  500 kg |                           R$ 2,76 |
| Farelo de soja   | Brasil Sul Industrial / e-rival-22   | Curitiba/PR              |                  500 kg |                           R$ 2,76 |
| Óleo de soja 1 L | Óleo Brasil Indústria / e-botfactory | Sumaré/SP                |               12.000 un |                           R$ 6,62 |
| Óleo de soja 1 L | Pioneira Industrial / e-rival-2      | Piracicaba/SP            |                1.200 un |                          R$ 10,19 |
| Óleo de soja 1 L | Planalto Industrial / e-rival-12     | São José dos Campos/SP   |                1.200 un |                          R$ 10,19 |
| Óleo de soja 1 L | Brasil Sul Industrial / e-rival-22   | Curitiba/PR              |                1.200 un |                          R$ 10,19 |
| Arroz 5 kg       | Distribuidora Aurora / e-supplier    | Americana/SP             |                2.000 un |                          R$ 18,29 |
| Feijão 1 kg      | Distribuidora Aurora / e-supplier    | Americana/SP             |                1.500 un |                           R$ 6,79 |
| Açúcar 5 kg      | Distribuidora Aurora / e-supplier    | Americana/SP             |                1.500 un |                          R$ 13,61 |
| Leite 1 L        | Distribuidora Aurora / e-supplier    | Americana/SP             |                1.800 un |                           R$ 4,28 |
| Leite 1 L        | Nova Era Agro / e-rival-10           | Curitiba/PR              |                  200 un |                           R$ 6,59 |
| Leite 1 L        | Cerrado Agro / e-rival-20            | Limeira/SP               |                  200 un |                           R$ 6,59 |
| Leite 1 L        | Avenida Agro / e-rival-30            | Belo Horizonte/MG        |                  200 un |                           R$ 6,59 |

Lista de anúncios com estoque livre naquele instante; pode incluir unidades pausadas. Transferência própria também pode usar estoque sem anúncio. Insumos/sementes protegidos pela automação não são oferta livre. A contratação revalida tudo.

## Receitas por ciclo

| Receita           | Entradas → saídas brutas                                           | Horas virtuais | Pessoas; m² por linha | kWh; m³ água | Processamento | Energia + água/SP |
| ----------------- | ------------------------------------------------------------------ | -------------: | --------------------- | ------------ | ------------: | ----------------: |
| `steel-bars`      | 12 t Minério de ferro + 3 t Carvão mineral → 8 t Aço em barras     |              1 | 18; 6.000             | 4.400; 24    |  R$ 12.000,00 |       R$ 4.528,00 |
| `soy-oil`         | 1 t Soja em grão → 200 un Óleo de soja 1 L + 760 kg Farelo de soja |              1 | 8; 1.800              | 150; 0,5     |     R$ 160,00 |         R$ 148,00 |
| `soy-harvest`     | 1 t Soja em grão → 26 t Soja em grão                               |             24 | 6; 200.000            | 80; 25       |  R$ 12.800,00 |         R$ 573,60 |
| `iron-extraction` | Sem item de entrada → 1 t Minério de ferro                         |            0,1 | 12; 90.000            | 30; 0,8      |     R$ 145,00 |          R$ 43,60 |
| `coal-extraction` | Sem item de entrada → 1 t Carvão mineral                           |            0,2 | 12; 90.000            | 50; 1        |     R$ 700,00 |          R$ 66,00 |
| `rice-harvest`    | 1 un Arroz 5 kg → 160 un Arroz 5 kg                                |             72 | 6; 200.000            | 160; 50      |   R$ 1.900,00 |       R$ 1.147,20 |
| `beans-harvest`   | 1 un Feijão 1 kg → 400 un Feijão 1 kg                              |             72 | 6; 200.000            | 90; 25       |   R$ 1.600,00 |         R$ 582,80 |
| `sugar-harvest`   | 1 un Açúcar 5 kg → 180 un Açúcar 5 kg                              |             72 | 6; 200.000            | 160; 30      |   R$ 1.500,00 |         R$ 747,20 |
| `milk-production` | 50 kg Farelo de soja → 300 un Leite 1 L                            |             24 | 6; 20.000             | 90; 4        |     R$ 700,00 |         R$ 162,80 |

Horas são do jogo: dividir por 120 para tempo real do laboratório. Receitas agrícolas com autorreposição retêm a entrada do próximo ciclo; a saída bruta não é toda excedente vendável. Reserva mineral cai uma unidade por ciclo, antes de produzir.

## Comparação econômica padronizada

Uma linha instalada em SP, equipe mínima, índice salarial 1, ciclos unitários automáticos, custos/receitas aos preços de abertura e venda de toda saída. Sem frete, CAPEX, financiamento, estoque ocioso, escassez, limite de demanda ou caixa. A coluna de resultado é sensibilidade matemática, não lucro esperado. O custo da semente retida é contabilizado como entrada e sua saída bruta como valor: não representa uma venda dessa semente.

| Receita           |    Materiais | Variável/ciclo, com utilidades | Valor bruto/ciclo | Contribuição/ciclo |   Fixos/dia | Ciclos/dia automáticos | Resultado/dia | Utilização de equilíbrio |
| ----------------- | -----------: | -----------------------------: | ----------------: | -----------------: | ----------: | ---------------------: | ------------: | -----------------------: |
| `steel-bars`      | R$ 11.400,00 |                   R$ 27.928,00 |      R$ 38.400,00 |       R$ 10.472,00 | R$ 5.339,40 |                     12 | R$ 120.324,60 |                  4,2489% |
| `soy-oil`         |  R$ 2.500,00 |                    R$ 2.808,00 |       R$ 3.446,00 |          R$ 638,00 | R$ 2.928,60 |                     12 |   R$ 4.727,40 |                 38,2524% |
| `soy-harvest`     |  R$ 2.500,00 |                   R$ 15.873,60 |      R$ 65.000,00 |       R$ 49.126,40 | R$ 1.203,00 |                      1 |  R$ 47.923,40 |                  2,4488% |
| `iron-extraction` |      R$ 0,00 |                      R$ 188,60 |         R$ 500,00 |          R$ 311,40 | R$ 4.688,64 |                     12 |    -R$ 951,84 |                125,4721% |
| `coal-extraction` |      R$ 0,00 |                      R$ 766,00 |       R$ 1.800,00 |        R$ 1.034,00 | R$ 4.688,64 |                     12 |   R$ 7.719,36 |                 37,7872% |
| `rice-harvest`    |     R$ 23,45 |                    R$ 3.070,65 |       R$ 3.752,00 |          R$ 681,35 | R$ 1.203,00 |                 0,3333 |    -R$ 975,88 |                529,6837% |
| `beans-harvest`   |      R$ 8,70 |                    R$ 2.191,50 |       R$ 3.480,00 |        R$ 1.288,50 | R$ 1.203,00 |                 0,3333 |    -R$ 773,50 |                280,0931% |
| `sugar-harvest`   |     R$ 17,45 |                    R$ 2.264,65 |       R$ 3.141,00 |          R$ 876,35 | R$ 1.203,00 |                 0,3333 |    -R$ 910,88 |                411,8218% |
| `milk-production` |    R$ 115,00 |                      R$ 977,80 |       R$ 1.647,00 |          R$ 669,20 | R$ 1.203,00 |                      1 |    -R$ 533,80 |                179,7669% |

Cadência automática: 12 / teto(duração em horas / 2) ciclos por dia para esta hipótese de uma linha e um ciclo por lote; não usar esse número para lotes/linhas diferentes. Utilização acima de 100% exige mudar a hipótese/preço/custo; não é uma recomendação de aumentar produção sem compradores.

## Consumo final e transporte

| Item             | Consumo familiar mensal por pessoa representada | Programas públicos                                                                                                                                             | Máximo num caminhão 30 t / 85 m³ |
| ---------------- | ----------------------------------------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------: |
| Minério de ferro |                                             0 t | —                                                                                                                                                              |                             30 t |
| Carvão mineral   |                                             0 t | —                                                                                                                                                              |                             30 t |
| Aço em barras    |                                             0 t | Reforço de pontes e acessos; Estruturas para escola municipal; Ampliação de unidade de saúde; Passarelas e drenagem urbana; Cobertura de equipamentos públicos |                             30 t |
| Soja em grão     |                                             0 t | —                                                                                                                                                              |                             30 t |
| Farelo de soja   |                                            0 kg | —                                                                                                                                                              |                        30.000 kg |
| Óleo de soja 1 L |                                          0,8 un | —                                                                                                                                                              |                        32.608 un |
| Arroz 5 kg       |                                          0,3 un | Abastecimento de cozinhas comunitárias                                                                                                                         |                         6.000 un |
| Feijão 1 kg      |                                            1 un | —                                                                                                                                                              |                        30.000 un |
| Açúcar 5 kg      |                                          0,2 un | —                                                                                                                                                              |                         6.000 un |
| Leite 1 L        |                                            8 un | Programa de alimentação escolar                                                                                                                                |                        29.126 un |

População representada = população configurada × participação de consumidores da season (abertura: 1%). Demanda diária é consumo mensal / 30; vendas ainda sofrem qualidade, elasticidade, calendário, capacidade e caixa. Programas exigem verba, qualidade e entrega: não são consumo diário fixo. Caminhão padrão é exemplo, não disponibilidade de frota.

## Fronteiras materiais declaradas

| Receita         | Entrada física kg | Saída física kg | Origem externa agregada kg | Residual não rastreado kg | Limite                                                                                                                                                                       |
| --------------- | ----------------: | --------------: | -------------------------: | ------------------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| steel-bars      |            15.000 |           8.000 |                          0 |                     7.000 | 15 t entram e 8 t saem. As 7 t restantes não têm estoque/destino: fronteira agregada a detalhar; não chamar de resíduo industrial medido.                                    |
| soy-oil         |             1.000 |             944 |                          0 |                        56 | 1 t gera 184 kg de óleo e 760 kg de farelo. Restam 56 kg não rastreados; embalagem não é insumo físico.                                                                      |
| soy-harvest     |             1.000 |          26.000 |                     25.000 |                         0 | 1 t de soja funciona como semente agregada e gera 26 t; 25 t representam crescimento externo implícito. Sem área ocupada por safra, fertilizantes ou calendário agronômico.  |
| iron-extraction |                 0 |           1.000 |                      1.000 |                         0 | Uma unidade da reserva virtual vira 1 t. A reserva atual é genérica por mina, sem teor nem identificação do mineral.                                                         |
| coal-extraction |                 0 |           1.000 |                      1.000 |                         0 | Uma unidade da reserva virtual vira 1 t. Minério e carvão compartilham o mecanismo de reserva; geologia/beneficiamento não são simulados.                                    |
| rice-harvest    |                 5 |             800 |                        795 |                         0 | Um pacote de varejo representa a semente de partida. Cultivo, beneficiamento e embalagem são agregados; crescimento líquido de 795 kg.                                       |
| beans-harvest   |                 1 |             400 |                        399 |                         0 | Um pacote de varejo representa a semente. Cultivo/embalagem agregados; crescimento líquido de 399 kg.                                                                        |
| sugar-harvest   |                 5 |             900 |                        895 |                         0 | Açúcar embalado funciona como entrada de partida fictícia da cana integrada. Crescimento líquido de 895 kg; não representa propagação real de cana.                          |
| milk-production |                50 |             309 |                        259 |                         0 | 50 kg de farelo geram 309 kg de leite; 259 kg são diferença agregada de fronteira. Rebanho, outra alimentação, água incorporada e embalagens não são bens físicos modelados. |

Água de serviço é paga em m³, não item de estoque. Estes termos explicitam a abstração atual e não demonstram conservação físico-química completa nem validam rendimento real. Não criar balanço fictício para aprovar conteúdo.

## Proporção dos coprodutos e demanda

- soy-oil: cada unidade de oil implica 3,8 unidades de soymeal, capazes de gerar 22,8 unidades de milk. Consumo familiar relativo: 10. Excesso teórico do coproduto: 56,1404%, antes de compras públicas, estoques, outras origens e limites de operação.

## Diagnósticos

| Nível   | Código                   | Item/receita    | Diagnóstico                                                                                                                                                                  |
| ------- | ------------------------ | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| warning | AGGREGATE_BOUNDARY       | steel-bars      | 15 t entram e 8 t saem. As 7 t restantes não têm estoque/destino: fronteira agregada a detalhar; não chamar de resíduo industrial medido.                                    |
| warning | AGGREGATE_BOUNDARY       | soy-oil         | 1 t gera 184 kg de óleo e 760 kg de farelo. Restam 56 kg não rastreados; embalagem não é insumo físico.                                                                      |
| warning | AGGREGATE_BOUNDARY       | soy-harvest     | 1 t de soja funciona como semente agregada e gera 26 t; 25 t representam crescimento externo implícito. Sem área ocupada por safra, fertilizantes ou calendário agronômico.  |
| warning | AGGREGATE_BOUNDARY       | rice-harvest    | Um pacote de varejo representa a semente de partida. Cultivo, beneficiamento e embalagem são agregados; crescimento líquido de 795 kg.                                       |
| warning | AGGREGATE_BOUNDARY       | beans-harvest   | Um pacote de varejo representa a semente. Cultivo/embalagem agregados; crescimento líquido de 399 kg.                                                                        |
| warning | AGGREGATE_BOUNDARY       | sugar-harvest   | Açúcar embalado funciona como entrada de partida fictícia da cana integrada. Crescimento líquido de 895 kg; não representa propagação real de cana.                          |
| warning | AGGREGATE_BOUNDARY       | milk-production | 50 kg de farelo geram 309 kg de leite; 259 kg são diferença agregada de fronteira. Rebanho, outra alimentação, água incorporada e embalagens não são bens físicos modelados. |
| warning | PUBLIC_ONLY              | iron            | Consumo final depende de orçamento/contratação pública.                                                                                                                      |
| warning | PUBLIC_ONLY              | coal            | Consumo final depende de orçamento/contratação pública.                                                                                                                      |
| warning | PUBLIC_ONLY              | steel           | Consumo final depende de orçamento/contratação pública.                                                                                                                      |
| warning | OPENING_DEPENDENCY       | soy             | A reposição depende de algum estoque inicial da cadeia; perda da semente pode paralisá-la.                                                                                   |
| warning | OPENING_DEPENDENCY       | soymeal         | A reposição depende de algum estoque inicial da cadeia; perda da semente pode paralisá-la.                                                                                   |
| warning | OPENING_DEPENDENCY       | oil             | A reposição depende de algum estoque inicial da cadeia; perda da semente pode paralisá-la.                                                                                   |
| warning | OPENING_DEPENDENCY       | rice            | A reposição depende de algum estoque inicial da cadeia; perda da semente pode paralisá-la.                                                                                   |
| warning | OPENING_DEPENDENCY       | beans           | A reposição depende de algum estoque inicial da cadeia; perda da semente pode paralisá-la.                                                                                   |
| warning | OPENING_DEPENDENCY       | sugar           | A reposição depende de algum estoque inicial da cadeia; perda da semente pode paralisá-la.                                                                                   |
| warning | OPENING_DEPENDENCY       | milk            | A reposição depende de algum estoque inicial da cadeia; perda da semente pode paralisá-la.                                                                                   |
| warning | SELF_SEED                | soy-harvest     | Parte da saída precisa ser retida; venda manual pode extinguir a semente.                                                                                                    |
| warning | NEGATIVE_STANDARD_RESULT | iron-extraction | Uma linha/SP, ciclos unitários automáticos e preços de abertura não cobrem fixos, mesmo vendendo toda a saída e sem frete.                                                   |
| warning | NEGATIVE_STANDARD_RESULT | rice-harvest    | Uma linha/SP, ciclos unitários automáticos e preços de abertura não cobrem fixos, mesmo vendendo toda a saída e sem frete.                                                   |
| warning | SELF_SEED                | rice-harvest    | Parte da saída precisa ser retida; venda manual pode extinguir a semente.                                                                                                    |
| warning | NEGATIVE_STANDARD_RESULT | beans-harvest   | Uma linha/SP, ciclos unitários automáticos e preços de abertura não cobrem fixos, mesmo vendendo toda a saída e sem frete.                                                   |
| warning | SELF_SEED                | beans-harvest   | Parte da saída precisa ser retida; venda manual pode extinguir a semente.                                                                                                    |
| warning | NEGATIVE_STANDARD_RESULT | sugar-harvest   | Uma linha/SP, ciclos unitários automáticos e preços de abertura não cobrem fixos, mesmo vendendo toda a saída e sem frete.                                                   |
| warning | SELF_SEED                | sugar-harvest   | Parte da saída precisa ser retida; venda manual pode extinguir a semente.                                                                                                    |
| warning | NEGATIVE_STANDARD_RESULT | milk-production | Uma linha/SP, ciclos unitários automáticos e preços de abertura não cobrem fixos, mesmo vendendo toda a saída e sem frete.                                                   |
| warning | JOINT_DEMAND_MISMATCH    | soymeal         | A proporção dos consumos familiares não absorve todo o coproduto se esta cadeia for a única destinação; medir também compras públicas e estoques.                            |
| warning | GENERIC_RESERVE          | mine            | A reserva não identifica mineral. O comando manual aceita receitas da mesma categoria sem exigir especialização.                                                             |
| warning | SCHEMA_NOT_FROZEN        | season          | Massa/volume dos produtos e canais de consumo ainda vêm do código; só os parâmetros/receitas estão na configuração persistida. Versionar o esquema antes de ampliá-lo.       |
