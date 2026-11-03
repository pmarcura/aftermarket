# Mapa real com estética pixel

Pesquisa de **30/10/2026**, para o pedido do Pedro de usar a geração de mapas do
OpenPixel-RPG como referência. O resultado desejado é o mapa geográfico real com
construções, natureza e estradas em pixel art, mantendo as operações do jogo.

## Fonte examinada

Repositório [tensor2023/OpenPixel-RPG](https://github.com/tensor2023/OpenPixel-RPG),
fixado no commit
[`12e6feddcea5b4b2283826ec135ec07e6ee7ea50`](https://github.com/tensor2023/OpenPixel-RPG/tree/12e6feddcea5b4b2283826ec135ec07e6ee7ea50),
de 15/06/2026. Foram lidos o README e os arquivos abaixo; o projeto não foi clonado
nem incorporado ao AFTERMARKET. As imagens e demonstrações citadas nesta pesquisa
também foram abertas e inspecionadas visualmente no Chrome.

| Arquivo na referência                                                                                                                                                                                        | Comportamento observado                                                                                                                                                                 | Princípio aproveitado                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [G_gen_pixel/whitebox/osm_whitebox_global.py](https://github.com/tensor2023/OpenPixel-RPG/blob/12e6feddcea5b4b2283826ec135ec07e6ee7ea50/G_gen_pixel/whitebox/osm_whitebox_global.py)                         | Consulta edifícios no Overpass; projeta footprints e alturas em um PNG 1280 × 960 com faces claras e escuras.                                                                           | A geometria real define a planta; a aparência é uma etapa separada.                                    |
| [G_gen_pixel/global_server.py](https://github.com/tensor2023/OpenPixel-RPG/blob/12e6feddcea5b4b2283826ec135ec07e6ee7ea50/G_gen_pixel/global_server.py)                                                       | Envia whitebox, imagem de satélite/3D e descrição de estilo para um modelo gerar a imagem. O estilo padrão pede paleta limitada, dithering e bordas nítidas, sem aparência fotográfica. | Paleta curta, texturas discretas e desenho coerente com a geografia.                                   |
| [GeoPixel/generators/map/src/steps/step2-compress.mjs](https://github.com/tensor2023/OpenPixel-RPG/blob/12e6feddcea5b4b2283826ec135ec07e6ee7ea50/GeoPixel/generators/map/src/steps/step2-compress.mjs)       | Escolhe o menor PNG entre original, recompressão e paleta de até 256 cores com dithering 0,25; preserva a resolução.                                                                    | A compressão é posterior à criação da arte; não é um filtro que transforma mapa vetorial em pixel art. |
| [GeoPixel/generators/map/src/utils/tmj-builder.mjs](https://github.com/tensor2023/OpenPixel-RPG/blob/12e6feddcea5b4b2283826ec135ec07e6ee7ea50/GeoPixel/generators/map/src/utils/tmj-builder.mjs)             | Exporta imagem de fundo, colisão, regiões e objetos interativos em camadas distintas.                                                                                                   | Separar o desenho do território das entidades e interações do jogo.                                    |
| [GeoPixel/generators/map/src/utils/generation-config.mjs](https://github.com/tensor2023/OpenPixel-RPG/blob/12e6feddcea5b4b2283826ec135ec07e6ee7ea50/GeoPixel/generators/map/src/utils/generation-config.mjs) | Define células de 4, 8 ou 16 pixels para imagens 1K, 2K ou 4K.                                                                                                                          | Escolher uma escala de pixel explícita e consistente.                                                  |

O pipeline global usa geração de imagens por IA; não fornece um filtro pronto para
aplicar ao MapLibre. Seu whitebox é voltado a poucos quarteirões. O README cita
`WorldX-main`, mas essa pasta não está presente no commit examinado: os passos de
mapa disponíveis ficam em `GeoPixel/generators/map`.

O [README](https://github.com/tensor2023/OpenPixel-RPG/blob/12e6feddcea5b4b2283826ec135ec07e6ee7ea50/README.md)
declara MIT; o arquivo de licença encontrado é
[GeoPixel/LICENSE](https://github.com/tensor2023/OpenPixel-RPG/blob/12e6feddcea5b4b2283826ec135ec07e6ee7ea50/GeoPixel/LICENSE),
com copyright de 2026 WorldX Contributors. Esta adaptação usa a referência como
pesquisa, sem copiar código ou imagens. Se trechos substanciais de GeoPixel forem
incorporados no futuro, deverão acompanhar o aviso MIT correspondente.

## O que as imagens mostram

- No [modo global](https://github.com/tensor2023/OpenPixel-RPG/blob/12e6feddcea5b4b2283826ec135ec07e6ee7ea50/video/mode3_demo.gif),
  o quadro de Londres/Westminster mostra fachadas com janelas, telhados em águas,
  torres, jardins e silhuetas arquitetônicas específicas.
- O [demo de cidade](https://github.com/tensor2023/OpenPixel-RPG/blob/12e6feddcea5b4b2283826ec135ec07e6ee7ea50/video/demo.gif)
  mostra construções heterogêneas em quadras densas, árvores volumosas, coberturas,
  cercas e marcas viárias.
- A [vila RPG](https://github.com/tensor2023/OpenPixel-RPG/blob/12e6feddcea5b4b2283826ec135ec07e6ee7ea50/GeoPixel/docs/screenshot2_en.png)
  tem telhas individuais, estrutura de madeira, bases de pedra, portas, objetos de
  cena e sombras de contato. Já
  [screenshot3.png](https://github.com/tensor2023/OpenPixel-RPG/blob/12e6feddcea5b4b2283826ec135ec07e6ee7ea50/GeoPixel/docs/screenshot3.png)
  mostra uma vila Naruto ilustrada, de menor relevância para a cartografia real.

A inspeção do tree completo do commit não encontrou atlas de construções ou
tiles ambientais separados. Há sprites de personagens e duas imagens inteiras
`GeoPixel/library/worlds/.../map/06-background.png`, com seus TMJs. Não existe um
pacote de sprites de prédios pronto para incorporar.

## Experimento e decisão

**Observação:** reduzir a resolução da cartografia entrega pixels visíveis, mas não
produz o acabamento arquitetônico da referência. Após a primeira implementação
com extrusões simples, o Pedro rejeitou a qualidade das construções: os edifícios
do projeto de referência eram mais bonitos e desenvolvidos. Essa tentativa não
foi aceita como entrega estética.

**Hipótese revisada:** preservar os footprints reais e acrescentar formas de
telhado, materiais, aberturas e sombras em uma grade de pixel melhora a leitura de
construção, mantendo as entidades do jogo em uma camada nítida. A aceitação visual
continua pendente de inspeção da implementação final.

| Alternativa                                     | Consequência para este mapa                                                                                                                               |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sprites genéricos ancorados em coordenadas      | Podem ter bom acabamento, mas substituem a forma real de cada edifício por um exemplar. Permanecem adequados aos marcadores de negócios.                  |
| Footprints reais com arquitetura ilustrada      | Preservam posição e planta; telhados, fachadas e detalhes adicionais são interpretação artística. Caminho implementado nesta frente.                      |
| Tiles artísticos por geração de imagens offline | Aproximam a pintura da referência, mas podem mover ou inventar elementos e exigem georreferenciamento, revisão e costura entre tiles. Fora desta entrega. |

## Implementação ativa

- Uma instância MapLibre para a base geográfica, com `pixelRatio: 0.5`: um pixel
  renderizado ocupa dois pixels CSS. A ampliação usa vizinho mais próximo.
- Outra instância para propriedades, cidades, clusters, rotas e caminhões, na
  resolução normal. Controles e texto da interface mantêm a tipografia vigente.
- Câmera, dimensões e padding sincronizados: centro, zoom, bearing e pitch devem
  produzir a mesma projeção nas duas camadas, inclusive com a gaveta aberta.
- Paleta rural para solo, mata, água, areia e gelo, com padrões locais de poucos
  pixels. Cada classe conserva seu padrão; areia e gelo não recebem a textura de
  floresta.
- Recortes reais da camada `landuse` para `residential`, `commercial`, `retail` e
  `industrial`, com cores ilustrativas. Não gerar bairros ou vias por amostragem
  aleatória.
- Construções a partir dos footprints reais da camada vetorial `building`, com
  representação 2D a partir de zoom 13, volumes nativos a partir de zoom 14 como
  fallback e arquitetura detalhada a partir de zoom 15 quando a malha está pronta.
- Perspectiva opcional pelo botão **Vista inclinada** / **Vista de cima**,
  alternando pitch de 0° e 45°. Ao inclinar, o mapa aproxima até pelo menos zoom 18;
  em vista regional, aproxima o município conhecido mais próximo. O zoom máximo
  passa a 20 para tornar os detalhes visíveis. A vista de cima continua disponível.

A implementação canônica está em três módulos:

| Módulo                                                                              | Responsabilidade                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`pixel-buildings.ts`](../../apps/web/src/lib/pixel-buildings.ts)                   | Custom layer WebGL2 pela API pública do MapLibre, consulta de footprints visíveis, atualização da malha, fallback e ciclo de vida dos recursos gráficos próprios.                                              |
| [`pixel-buildings-geometry.ts`](../../apps/web/src/lib/pixel-buildings-geometry.ts) | Paredes sobre a planta real; telhados de duas águas para retângulos baixos de até 16 m, sem pátios; coberturas planas para prédios altos ou formas complexas.                                                  |
| [`pixel-building-shaders.ts`](../../apps/web/src/lib/pixel-building-shaders.ts)     | Arquitetura ilustrada numa grade de 0,20 m: quatro paletas de fachada, fundações, janelas, portas, cornijas, telhas, cumeeiras, parapeitos e equipamentos de cobertura. Sem textura remota ou ruído aleatório. |

As alturas usam `render_height` e `render_min_height` dos tiles OpenMapTiles; na
ausência de altura, o valor gráfico de 6 m é uma aproximação visual. A interface
inclinada identifica **Fachadas ilustradas** e **Alturas aproximadas**, inclusive na
descrição do controle. Janelas, portas, telhados e equipamentos não são observações
levantadas no local.

A deduplicação usa a geometria exata, preservando fragmentos de um mesmo ID em
tiles diferentes. Footprints cortados na borda de tile z14 recebem cobertura plana
para evitar cumeeiras falsas produzidas pelo recorte. A dependência direta
`earcut` 3.2.4, já transitiva do MapLibre, permite triangular formas côncavas e
furos sem preencher pátios e sem acessar os módulos internos do MapLibre. Essa é a
justificativa da dependência explicitada nesta frente.

A D-014 retirou prédios do mapa em 26/10. O pedido atual autoriza reintroduzir
construções reais na apresentação. Isso não transforma footprints cartográficos em
imóveis compráveis nem altera a geração de lotes da simulação.

O dado geográfico continua vindo de OpenFreeMap/OpenMapTiles/OpenStreetMap, com a
atribuição preservada. Cores, padrões, telhados e sombras são uma representação
artística; não demonstram o uso econômico, a altura, o proprietário ou o estado
real de cada edifício. Os imóveis jogáveis continuam identificados pelas entidades
da simulação.

## Limites e custo

- A existência e o detalhe de edifícios dependem da cobertura OSM e dos tiles
  disponíveis. Ausência de footprint não prova ausência de construção. Não há
  promessa de fachada ou telhado idênticos ao lugar real. Alturas cartográficas
  também podem ser estimadas; o fallback de 6 m nunca deve aparecer como medição.
- Cada mapa montado usa dois contextos WebGL. A custom layer compartilha o
  contexto da base e gerencia seu próprio programa, buffers e VAO. Há custo de
  consulta, triangulação, atualização de malha e memória além da segunda
  instância; verificar desmontagem e prévias, sem presumir ganho de desempenho.
- A redução da base pode esconder vias estreitas ou pequenos edifícios em certos
  zooms. A hierarquia viária e a continuidade de pontes, túneis e acessos precisam
  continuar legíveis.
- Uma captura com tiles vazios valida controles e alinhamento de entidades, mas
  não demonstra a estética do território. É necessária captura com base real.
- Sem geração de imagens por IA, reconstrução fiel de fachadas, fotogrametria,
  backend Python, chave externa ou alteração de banco. Nenhum serviço externo
  adicional é necessário para gerar a arte; os tiles geográficos continuam
  externos. `earcut` é a única dependência direta explicitada para a triangulação.

## Experimento e evidência exigida

O plano executável está em
[E-MAPA-PLAN](../../.planning/phases/E-mapa/E-MAPA-PLAN.md). A validação deve combinar
testes do estilo e sincronização com inspeção de um lugar real em desktop e 390 px.
Comparar vista regional e zoom urbano, verificar prédios, costa/rios, estradas,
seleção por teclado, gaveta e caminhão seguindo a rota ao mover a câmera. Alternar
as vistas de cima e inclinada, verificando a sincronização de pitch, a presença do
aviso de fachadas ilustradas e alturas aproximadas, e o retorno à leitura plana.
Inspecionar a transição entre fallback e detalhe, pátios e fragmentos na borda de
tile. A estética deve ser julgada pelo resultado visível, tendo a extrusão lisa
rejeitada como referência de insuficiência.

Registrar os resultados efetivamente observados e os limites na validação. Esta
pesquisa descreve a implementação ativa; a verificação final e a aceitação estética
não estão concluídas aqui. Não substituir a referência anterior do laboratório.
