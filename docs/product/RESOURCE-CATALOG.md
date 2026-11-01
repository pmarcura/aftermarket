# Catálogo verificável de recursos

Fonte: abertura do código em 27/10/2026. Gerado por `npm run resources:catalog`. Não editar tabelas manualmente.

Parâmetros de jogo; nenhuma cotação externa foi verificada. Valores de abertura não são ofertas garantidas. Estoques são a observação desta fonte, não reposição gratuita. Veja [padrão matemático e admissão](RESOURCE-STANDARD.md).

Estrutura: **válida**. Equilíbrio: **não demonstrado**. 20 itens / 14 receitas.

## Itens, obtenção e destinos

| Item / ID                            | Unidade; kg; m³  |      Abertura | Receita de origem           | Uso produtivo                      | Destino final alcançável | Estoque; ofertado; fornecedores |
| ------------------------------------ | ---------------- | ------------: | --------------------------- | ---------------------------------- | ------------------------ | ------------------------------- |
| Minério de ferro / `iron`            | t; 1.000; 0,45   |     R$ 500,00 | iron-extraction             | steel-bars                         | iron → steel             | 976,7; 148,5; 4                 |
| Carvão mineral / `coal`              | t; 1.000; 1,3    |   R$ 1.850,00 | coal-extraction             | steel-bars, steel-recycling        | coal → steel             | 237; 80; 1                      |
| Aço em barras / `steel`              | t; 1.000; 0,15   |   R$ 5.000,00 | steel-bars, steel-recycling | utensils, truck-heavy, truck-light | steel                    | 89,8; 0; 0                      |
| Soja em grão / `soy`                 | t; 1.000; 1,4    |   R$ 2.340,00 | soy-harvest                 | soy-oil                            | soy → oil                | 280,5; 37,5; 1                  |
| Farelo de soja / `soymeal`           | kg; 1; 0,0017    |       R$ 2,20 | soy-oil                     | feed-mill                          | soymeal → feed → milk    | 6.000; 0; 0                     |
| Óleo de soja 1 L / `oil`             | un; 0,92; 0,0013 |       R$ 8,90 | soy-oil                     | —                                  | oil                      | 32.504; 2.600; 1                |
| Arroz 5 kg / `rice`                  | un; 5; 0,007     |      R$ 24,50 | rice-harvest                | —                                  | rice                     | 21.498; 2.000; 1                |
| Feijão 1 kg / `beans`                | un; 1; 0,0015    |       R$ 9,25 | beans-harvest               | —                                  | beans                    | 57.162; 1.500; 1                |
| Açúcar 5 kg / `sugar`                | un; 5; 0,006     |      R$ 18,50 | sugar-harvest               | —                                  | sugar                    | 15.702; 1.500; 1                |
| Leite 1 L / `milk`                   | un; 1,03; 0,0012 |       R$ 6,17 | milk-production             | —                                  | milk                     | 324.215; 1.800; 1               |
| Sucata de aço / `scrap`              | t; 1.000; 2,5    |   R$ 1.200,00 |                             | steel-recycling                    | scrap → steel            | 0; 0; 0                         |
| Utensílios de aço (kit) / `utensils` | un; 5; 0,02      |      R$ 70,00 | utensils                    | —                                  | utensils                 | 11.522; 0; 0                    |
| Caminhão pesado 30 t / `truckHeavy`  | un; 9.000; 60    | R$ 290.000,00 | truck-heavy                 | —                                  | truckHeavy               | 2; 0; 0                         |
| Caminhão leve 8 t / `truckLight`     | un; 3.500; 25    | R$ 140.000,00 | truck-light                 | —                                  | truckLight               | 3; 0; 0                         |
| Semente de soja / `soySeed`          | t; 1.000; 1,4    |   R$ 5.850,00 | soy-harvest                 | soy-harvest                        | soySeed → soy → oil      | 12,825; 0; 0                    |
| Ração para gado / `feed`             | kg; 1; 0,0016    |       R$ 3,11 | feed-mill                   | milk-production                    | feed → milk              | 91.552,5; 0; 0                  |
| Vaca leiteira / `cow`                | un; 550; 3       |   R$ 2.500,00 | milk-production             | —                                  | cow                      | 2.250; 0; 0                     |
| Semente de arroz / `riceSeed`        | kg; 1; 0,0017    |       R$ 7,30 | rice-harvest                | rice-harvest                       | riceSeed → rice          | 3.400; 0; 0                     |
| Semente de feijão / `beanSeed`       | kg; 1; 0,0015    |      R$ 13,90 | beans-harvest               | beans-harvest                      | beanSeed → beans         | 4.200; 0; 0                     |
| Muda de cana / `caneSeedling`        | t; 1.000; 1,6    |     R$ 250,00 | sugar-harvest               | sugar-harvest                      | caneSeedling → sugar     | 144; 0; 0                       |

Todos os itens podem ser anunciados no atacado e negociados/transferidos com estoque, caixa, espaço e frota. Somente os cinco itens nos canais familiares são efetivamente consumidos pelas lojas. Aço é consumido pelos editais; farelo depende da produção de leite. Um caminho no grafo não garante demanda, margem, rota disponível ou compra.

## Fornecedores observados nesta fonte

| Produto          | Unidade anunciante                   | Cidade/UF       | Estoque livre anunciado | Preço por unidade, antes do frete |
| ---------------- | ------------------------------------ | --------------- | ----------------------: | --------------------------------: |
| Minério de ferro | Minas Ferro S.A. / e-minasferro      | Itabira/MG      |                  19,5 t |                         R$ 500,00 |
| Minério de ferro | FerroVale Comercial / e-ferrovale    | Itabira/MG      |                  19,5 t |                         R$ 500,00 |
| Minério de ferro | Metais Horizonte / e-metais          | Itabira/MG      |                  19,5 t |                         R$ 500,00 |
| Minério de ferro | Distribuidora Aurora / e-supplier    | Americana/SP    |                    90 t |                         R$ 500,00 |
| Carvão mineral   | FerroVale Comercial / e-ferrovale    | Itabira/MG      |                    80 t |                       R$ 1.800,00 |
| Soja em grão     | AgroVale Alimentos / e-agro          | Rio Verde/GO    |                  37,5 t |                       R$ 2.500,00 |
| Óleo de soja 1 L | Óleo Brasil Indústria / e-botfactory | Rondonópolis/MT |                2.600 un |                           R$ 6,62 |
| Arroz 5 kg       | Distribuidora Aurora / e-supplier    | Americana/SP    |                2.000 un |                          R$ 18,29 |
| Feijão 1 kg      | Distribuidora Aurora / e-supplier    | Americana/SP    |                1.500 un |                           R$ 6,79 |
| Açúcar 5 kg      | Distribuidora Aurora / e-supplier    | Americana/SP    |                1.500 un |                          R$ 13,61 |
| Leite 1 L        | Distribuidora Aurora / e-supplier    | Americana/SP    |                1.800 un |                           R$ 4,28 |

Lista de anúncios com estoque livre naquele instante; pode incluir unidades pausadas. Transferência própria também pode usar estoque sem anúncio. Insumos/sementes protegidos pela automação não são oferta livre. A contratação revalida tudo.

## Receitas por ciclo

| Receita           | Entradas → saídas brutas                                                   | Horas virtuais | Pessoas; m² por linha | kWh; m³ água | Processamento | Energia + água/SP |
| ----------------- | -------------------------------------------------------------------------- | -------------: | --------------------- | ------------ | ------------: | ----------------: |
| `iron-extraction` | Sem item de entrada → 1,5 t Minério de ferro                               |              2 | 4; 90.000             | 30; 0,5      |      R$ 70,00 |          R$ 37,60 |
| `coal-extraction` | Sem item de entrada → 0,5 t Carvão mineral                                 |              2 | 4; 90.000             | 30; 0,5      |     R$ 120,00 |          R$ 37,60 |
| `steel-bars`      | 1,6 t Minério de ferro + 0,5 t Carvão mineral → 1 t Aço em barras          |              4 | 10; 6.000             | 500; 4       |     R$ 250,00 |         R$ 540,00 |
| `steel-recycling` | 1,1 t Sucata de aço + 0,05 t Carvão mineral → 1 t Aço em barras            |              4 | 10; 6.000             | 650; 2       |     R$ 250,00 |         R$ 638,00 |
| `utensils`        | 0,32 t Aço em barras → 60 un Utensílios de aço (kit)                       |              4 | 8; 3.000              | 120; 1       |     R$ 600,00 |         R$ 130,40 |
| `truck-heavy`     | 8 t Aço em barras → 1 un Caminhão pesado 30 t                              |             24 | 20; 12.000            | 2.500; 10    | R$ 215.000,00 |       R$ 2.500,00 |
| `truck-light`     | 3 t Aço em barras → 1 un Caminhão leve 8 t                                 |             12 | 20; 12.000            | 1.200; 5     | R$ 108.000,00 |       R$ 1.204,00 |
| `soy-harvest`     | 0,6 t Semente de soja → 30 t Soja em grão + 0,66 t Semente de soja         |             96 | 5; 200.000            | 400; 100     |  R$ 26.000,00 |       R$ 2.368,00 |
| `soy-oil`         | 1 t Soja em grão → 200 un Óleo de soja 1 L + 760 kg Farelo de soja         |              2 | 6; 1.800              | 100; 0,5     |     R$ 120,00 |         R$ 102,00 |
| `feed-mill`       | 1.000 kg Farelo de soja → 990 kg Ração para gado                           |              2 | 4; 1.500              | 60; 0,4      |      R$ 40,00 |          R$ 63,20 |
| `milk-production` | 1.687,5 kg Ração para gado → 4.500 un Leite 1 L                            |             24 | 7; 45.000             | 180; 12      |   R$ 1.500,00 |         R$ 405,60 |
| `rice-harvest`    | 100 kg Semente de arroz → 1.200 un Arroz 5 kg + 110 kg Semente de arroz    |             96 | 5; 200.000            | 200; 120     |   R$ 7.000,00 |       R$ 2.584,00 |
| `beans-harvest`   | 100 kg Semente de feijão → 2.000 un Feijão 1 kg + 110 kg Semente de feijão |             72 | 5; 200.000            | 150; 50      |   R$ 5.500,00 |       R$ 1.138,00 |
| `sugar-harvest`   | 8 t Muda de cana → 1.800 un Açúcar 5 kg + 8,8 t Muda de cana               |            120 | 6; 200.000            | 600; 60      |   R$ 9.000,00 |       R$ 1.752,00 |

Horas são do jogo: dividir por 120 para tempo real do laboratório. Receitas agrícolas com autorreposição retêm a entrada do próximo ciclo; a saída bruta não é toda excedente vendável. Reserva mineral cai uma unidade por ciclo, antes de produzir.

## Comparação econômica padronizada

Uma linha instalada em SP, equipe mínima, índice salarial 1, ciclos unitários automáticos, custos/receitas aos preços de abertura e venda de toda saída. Sem frete, CAPEX, financiamento, estoque ocioso, escassez, limite de demanda ou caixa. A coluna de resultado é sensibilidade matemática, não lucro esperado. O custo da semente retida é contabilizado como entrada e sua saída bruta como valor: não representa uma venda dessa semente.

| Receita           |    Materiais | Variável/ciclo, com utilidades | Valor bruto/ciclo | Contribuição/ciclo |   Fixos/dia | Ciclos/dia automáticos | Resultado/dia | Utilização de equilíbrio |
| ----------------- | -----------: | -----------------------------: | ----------------: | -----------------: | ----------: | ---------------------: | ------------: | -----------------------: |
| `iron-extraction` |      R$ 0,00 |                      R$ 107,60 |         R$ 750,00 |          R$ 642,40 | R$ 2.562,84 |                     12 |   R$ 5.145,96 |                 33,2456% |
| `coal-extraction` |      R$ 0,00 |                      R$ 157,60 |         R$ 925,00 |          R$ 767,40 | R$ 2.562,84 |                     12 |   R$ 6.645,96 |                 27,8303% |
| `steel-bars`      |  R$ 1.725,00 |                    R$ 2.515,00 |       R$ 5.000,00 |        R$ 2.485,00 | R$ 3.410,76 |                      6 |  R$ 11.499,24 |                 22,8757% |
| `steel-recycling` |  R$ 1.412,50 |                    R$ 2.300,50 |       R$ 5.000,00 |        R$ 2.699,50 | R$ 3.410,76 |                      6 |  R$ 12.786,24 |                  21,058% |
| `utensils`        |  R$ 1.600,00 |                    R$ 2.330,40 |       R$ 4.200,00 |        R$ 1.869,60 | R$ 2.928,60 |                      6 |   R$ 8.289,00 |                 26,1072% |
| `truck-heavy`     | R$ 40.000,00 |                  R$ 257.500,00 |     R$ 290.000,00 |       R$ 32.500,00 | R$ 5.821,56 |                      1 |  R$ 26.678,44 |                 17,9125% |
| `truck-light`     | R$ 15.000,00 |                  R$ 124.204,00 |     R$ 140.000,00 |       R$ 15.796,00 | R$ 5.821,56 |                      2 |  R$ 25.770,44 |                 18,4273% |
| `soy-harvest`     |  R$ 3.510,00 |                   R$ 31.878,00 |      R$ 74.061,00 |       R$ 42.183,00 | R$ 1.035,84 |                   0,25 |   R$ 9.509,91 |                  9,8223% |
| `soy-oil`         |  R$ 2.340,00 |                    R$ 2.562,00 |       R$ 3.452,00 |          R$ 890,00 | R$ 2.446,44 |                     12 |   R$ 8.233,56 |                 22,9067% |
| `feed-mill`       |  R$ 2.200,00 |                    R$ 2.303,20 |       R$ 3.078,90 |          R$ 775,70 | R$ 1.964,28 |                     12 |   R$ 7.344,12 |                 21,1022% |
| `milk-production` |  R$ 5.248,13 |                    R$ 7.153,73 |      R$ 27.765,00 |       R$ 20.611,28 | R$ 1.370,16 |                      1 |  R$ 19.241,12 |                  6,6476% |
| `rice-harvest`    |    R$ 730,00 |                   R$ 10.314,00 |      R$ 30.203,00 |       R$ 19.889,00 | R$ 1.035,84 |                   0,25 |   R$ 3.936,41 |                 20,8324% |
| `beans-harvest`   |  R$ 1.390,00 |                    R$ 8.028,00 |      R$ 20.029,00 |       R$ 12.001,00 | R$ 1.035,84 |                 0,3333 |   R$ 2.964,49 |                 25,8938% |
| `sugar-harvest`   |  R$ 2.000,00 |                   R$ 12.752,00 |      R$ 35.500,00 |       R$ 22.748,00 | R$ 1.203,00 |                    0,2 |   R$ 3.346,60 |                 26,4419% |

Cadência automática: 12 / teto(duração em horas / 2) ciclos por dia para esta hipótese de uma linha e um ciclo por lote; não usar esse número para lotes/linhas diferentes. Utilização acima de 100% exige mudar a hipótese/preço/custo; não é uma recomendação de aumentar produção sem compradores.

## Consumo final e transporte

| Item                    | Consumo familiar mensal por pessoa representada | Programas públicos                                                                                                                                             | Máximo num caminhão 30 t / 85 m³ |
| ----------------------- | ----------------------------------------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------: |
| Minério de ferro        |                                             0 t | —                                                                                                                                                              |                             30 t |
| Carvão mineral          |                                             0 t | —                                                                                                                                                              |                             30 t |
| Aço em barras           |                                             0 t | Reforço de pontes e acessos; Estruturas para escola municipal; Ampliação de unidade de saúde; Passarelas e drenagem urbana; Cobertura de equipamentos públicos |                             30 t |
| Soja em grão            |                                             0 t | —                                                                                                                                                              |                             30 t |
| Farelo de soja          |                                            0 kg | —                                                                                                                                                              |                        30.000 kg |
| Óleo de soja 1 L        |                                          0,8 un | —                                                                                                                                                              |                        32.608 un |
| Arroz 5 kg              |                                          0,3 un | Abastecimento de cozinhas comunitárias                                                                                                                         |                         6.000 un |
| Feijão 1 kg             |                                            1 un | —                                                                                                                                                              |                        30.000 un |
| Açúcar 5 kg             |                                          0,2 un | —                                                                                                                                                              |                         6.000 un |
| Leite 1 L               |                                            8 un | Programa de alimentação escolar                                                                                                                                |                        29.126 un |
| Sucata de aço           |                                             0 t | —                                                                                                                                                              |                             30 t |
| Utensílios de aço (kit) |                                         0,25 un | —                                                                                                                                                              |                         4.250 un |
| Caminhão pesado 30 t    |                                            0 un | —                                                                                                                                                              |                             1 un |
| Caminhão leve 8 t       |                                            0 un | —                                                                                                                                                              |                             3 un |
| Semente de soja         |                                             0 t | —                                                                                                                                                              |                             30 t |
| Ração para gado         |                                            0 kg | —                                                                                                                                                              |                        30.000 kg |
| Vaca leiteira           |                                            0 un | —                                                                                                                                                              |                            28 un |
| Semente de arroz        |                                            0 kg | —                                                                                                                                                              |                        30.000 kg |
| Semente de feijão       |                                            0 kg | —                                                                                                                                                              |                        30.000 kg |
| Muda de cana            |                                             0 t | —                                                                                                                                                              |                             30 t |

População representada = população configurada × participação de consumidores da season (abertura: 1%). Demanda diária é consumo mensal / 30; vendas ainda sofrem qualidade, elasticidade, calendário, capacidade e caixa. Programas exigem verba, qualidade e entrega: não são consumo diário fixo. Caminhão padrão é exemplo, não disponibilidade de frota.

## Fronteiras materiais declaradas

| Receita         | Entrada física kg | Saída física kg | Origem externa agregada kg | Residual não rastreado kg | Limite                                                                                                                                                                                           |
| --------------- | ----------------: | --------------: | -------------------------: | ------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| iron-extraction |                 0 |           1.500 |                      1.500 |                         0 | Uma unidade da reserva virtual (um ciclo) vira 1,5 t. A reserva é genérica por mina, sem teor nem identificação do mineral.                                                                      |
| coal-extraction |                 0 |             500 |                        500 |                         0 | Uma unidade da reserva virtual (um ciclo) vira 0,5 t. Minério e carvão compartilham o mecanismo de reserva; geologia/beneficiamento não são simulados.                                           |
| steel-bars      |             2.100 |           1.000 |                          0 |                     1.100 | 1,6 t de minério e 0,5 t de carvão viram 1 t de aço; 1,1 t saem como escória e gases, sem estoque nem custo de tratamento.                                                                       |
| steel-recycling |             1.150 |           1.000 |                          0 |                       150 | 1,1 t de sucata e 50 kg de carvão viram 1 t de aço; 150 kg de impurezas saem como escória não rastreada.                                                                                         |
| utensils        |               320 |             300 |                          0 |                        20 | 320 kg de aço viram 60 kits de 5 kg; 20 kg de retalho de estampagem não voltam como sucata.                                                                                                      |
| truck-heavy     |             8.000 |           9.000 |                      1.000 |                         0 | 8 t de aço mais 1 t de motor, pneus e eletrônica pagos como processamento agregado; esses componentes não são itens do mundo.                                                                    |
| truck-light     |             3.000 |           3.500 |                        500 |                         0 | 3 t de aço mais 0,5 t de componentes pagos como processamento agregado; não são itens do mundo.                                                                                                  |
| soy-harvest     |               600 |          30.660 |                     30.060 |                         0 | 600 kg de semente geram 30 t de grão e 660 kg de semente; o crescimento é externo implícito. Sem talhões, fertilizante nem calendário agronômico.                                                |
| soy-oil         |             1.000 |             944 |                          0 |                        56 | 1 t gera 184 kg de óleo e 760 kg de farelo. Restam 56 kg não rastreados; embalagem não é insumo físico.                                                                                          |
| feed-mill       |             1.000 |             990 |                          0 |                        10 | 1 t de farelo vira 990 kg de ração; 10 kg de pó e umidade saem do processo. Minerais e embalagem são processamento agregado.                                                                     |
| milk-production |           1.687,5 |           4.635 |                    2.947,5 |                         0 | 1.687,5 kg de ração sustentam 150 vacas por ciclo e saem 4.500 litros; água, pasto e embalagem são diferença agregada de fronteira. Nascimentos e aposentadorias do rebanho ficam fora da massa. |
| rice-harvest    |               100 |           6.110 |                      6.010 |                         0 | 100 kg de semente geram 1.200 pacotes de 5 kg e 110 kg de semente; cultivo, beneficiamento e embalagem são agregados.                                                                            |
| beans-harvest   |               100 |           2.110 |                      2.010 |                         0 | 100 kg de semente geram 2.000 pacotes de 1 kg e 110 kg de semente; cultivo e embalagem agregados.                                                                                                |
| sugar-harvest   |             8.000 |          17.800 |                      9.800 |                         0 | 8 t de muda geram 1.800 pacotes de 5 kg e 8,8 t de muda; cana, moagem e refino integrados numa receita.                                                                                          |

Água de serviço é paga em m³, não item de estoque. Estes termos explicitam a abstração atual e não demonstram conservação físico-química completa nem validam rendimento real. Não criar balanço fictício para aprovar conteúdo.

## Proporção dos coprodutos e demanda

## Diagnósticos

| Nível   | Código             | Item/receita    | Diagnóstico                                                                                                                                                                                      |
| ------- | ------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| warning | AGGREGATE_BOUNDARY | steel-bars      | 1,6 t de minério e 0,5 t de carvão viram 1 t de aço; 1,1 t saem como escória e gases, sem estoque nem custo de tratamento.                                                                       |
| warning | AGGREGATE_BOUNDARY | steel-recycling | 1,1 t de sucata e 50 kg de carvão viram 1 t de aço; 150 kg de impurezas saem como escória não rastreada.                                                                                         |
| warning | AGGREGATE_BOUNDARY | utensils        | 320 kg de aço viram 60 kits de 5 kg; 20 kg de retalho de estampagem não voltam como sucata.                                                                                                      |
| warning | AGGREGATE_BOUNDARY | truck-heavy     | 8 t de aço mais 1 t de motor, pneus e eletrônica pagos como processamento agregado; esses componentes não são itens do mundo.                                                                    |
| warning | AGGREGATE_BOUNDARY | truck-light     | 3 t de aço mais 0,5 t de componentes pagos como processamento agregado; não são itens do mundo.                                                                                                  |
| warning | AGGREGATE_BOUNDARY | soy-harvest     | 600 kg de semente geram 30 t de grão e 660 kg de semente; o crescimento é externo implícito. Sem talhões, fertilizante nem calendário agronômico.                                                |
| warning | AGGREGATE_BOUNDARY | soy-oil         | 1 t gera 184 kg de óleo e 760 kg de farelo. Restam 56 kg não rastreados; embalagem não é insumo físico.                                                                                          |
| warning | AGGREGATE_BOUNDARY | feed-mill       | 1 t de farelo vira 990 kg de ração; 10 kg de pó e umidade saem do processo. Minerais e embalagem são processamento agregado.                                                                     |
| warning | AGGREGATE_BOUNDARY | milk-production | 1.687,5 kg de ração sustentam 150 vacas por ciclo e saem 4.500 litros; água, pasto e embalagem são diferença agregada de fronteira. Nascimentos e aposentadorias do rebanho ficam fora da massa. |
| warning | AGGREGATE_BOUNDARY | rice-harvest    | 100 kg de semente geram 1.200 pacotes de 5 kg e 110 kg de semente; cultivo, beneficiamento e embalagem são agregados.                                                                            |
| warning | AGGREGATE_BOUNDARY | beans-harvest   | 100 kg de semente geram 2.000 pacotes de 1 kg e 110 kg de semente; cultivo e embalagem agregados.                                                                                                |
| warning | AGGREGATE_BOUNDARY | sugar-harvest   | 8 t de muda geram 1.800 pacotes de 5 kg e 8,8 t de muda; cana, moagem e refino integrados numa receita.                                                                                          |
| warning | PUBLIC_ONLY        | iron            | Consumo final depende de orçamento/contratação pública.                                                                                                                                          |
| warning | PUBLIC_ONLY        | coal            | Consumo final depende de orçamento/contratação pública.                                                                                                                                          |
| warning | PUBLIC_ONLY        | steel           | Consumo final depende de orçamento/contratação pública.                                                                                                                                          |
| warning | OPENING_DEPENDENCY | soy             | A reposição depende de algum estoque inicial da cadeia; perda da semente pode paralisá-la.                                                                                                       |
| warning | OPENING_DEPENDENCY | soymeal         | A reposição depende de algum estoque inicial da cadeia; perda da semente pode paralisá-la.                                                                                                       |
| warning | OPENING_DEPENDENCY | oil             | A reposição depende de algum estoque inicial da cadeia; perda da semente pode paralisá-la.                                                                                                       |
| warning | OPENING_DEPENDENCY | rice            | A reposição depende de algum estoque inicial da cadeia; perda da semente pode paralisá-la.                                                                                                       |
| warning | OPENING_DEPENDENCY | beans           | A reposição depende de algum estoque inicial da cadeia; perda da semente pode paralisá-la.                                                                                                       |
| warning | OPENING_DEPENDENCY | sugar           | A reposição depende de algum estoque inicial da cadeia; perda da semente pode paralisá-la.                                                                                                       |
| warning | OPENING_DEPENDENCY | milk            | A reposição depende de algum estoque inicial da cadeia; perda da semente pode paralisá-la.                                                                                                       |
| warning | PUBLIC_ONLY        | scrap           | Consumo final depende de orçamento/contratação pública.                                                                                                                                          |
| warning | PUBLIC_ONLY        | truckHeavy      | Consumo final depende de orçamento/contratação pública.                                                                                                                                          |
| warning | PUBLIC_ONLY        | truckLight      | Consumo final depende de orçamento/contratação pública.                                                                                                                                          |
| warning | OPENING_DEPENDENCY | soySeed         | A reposição depende de algum estoque inicial da cadeia; perda da semente pode paralisá-la.                                                                                                       |
| warning | OPENING_DEPENDENCY | feed            | A reposição depende de algum estoque inicial da cadeia; perda da semente pode paralisá-la.                                                                                                       |
| warning | OPENING_DEPENDENCY | cow             | A reposição depende de algum estoque inicial da cadeia; perda da semente pode paralisá-la.                                                                                                       |
| warning | PUBLIC_ONLY        | cow             | Consumo final depende de orçamento/contratação pública.                                                                                                                                          |
| warning | OPENING_DEPENDENCY | riceSeed        | A reposição depende de algum estoque inicial da cadeia; perda da semente pode paralisá-la.                                                                                                       |
| warning | OPENING_DEPENDENCY | beanSeed        | A reposição depende de algum estoque inicial da cadeia; perda da semente pode paralisá-la.                                                                                                       |
| warning | OPENING_DEPENDENCY | caneSeedling    | A reposição depende de algum estoque inicial da cadeia; perda da semente pode paralisá-la.                                                                                                       |
| warning | SELF_SEED          | soy-harvest     | Parte da saída precisa ser retida; venda manual pode extinguir a semente.                                                                                                                        |
| warning | SELF_SEED          | rice-harvest    | Parte da saída precisa ser retida; venda manual pode extinguir a semente.                                                                                                                        |
| warning | SELF_SEED          | beans-harvest   | Parte da saída precisa ser retida; venda manual pode extinguir a semente.                                                                                                                        |
| warning | SELF_SEED          | sugar-harvest   | Parte da saída precisa ser retida; venda manual pode extinguir a semente.                                                                                                                        |
| warning | GENERIC_RESERVE    | mine            | A reserva não identifica mineral. O comando manual aceita receitas da mesma categoria sem exigir especialização.                                                                                 |
| warning | SCHEMA_NOT_FROZEN  | season          | Massa/volume dos produtos e canais de consumo ainda vêm do código; só os parâmetros/receitas estão na configuração persistida. Versionar o esquema antes de ampliá-lo.                           |
