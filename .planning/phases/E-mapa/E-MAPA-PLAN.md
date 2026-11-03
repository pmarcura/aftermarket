# E · Mapa real em pixel

## Continuidade solicitada em 31/10 · carregamentos sem bloquear a navegação

O Pedro relatou travadas nos carregamentos após o refinamento. Duas causas no
código: sair da página desmonta os dois mapas, descartando tiles, atlas e contextos
WebGL; conjuntos novos de construções ainda calculam chaves, triangulação e malha
na thread da interface. O cache quente não resolve a primeira visita a uma área.

Resultado observável: visitar Comércio e voltar ao Mapa conserva a mesma instância,
câmera e camadas; a chegada de construções novas não executa sua triangulação na
thread do mouse. Uma página de mapa é mantida após a primeira visita, oculta e
inativa fora dela. Um worker nativo do navegador recebe os dados geográficos
necessários e conserva o cache limitado existente. Pedidos são agrupados, respostas
obsoletas são descartadas e o último desenho válido permanece enquanto se prepara
o próximo. Falha do worker usa a representação cartográfica nativa.

Critérios: identidade dos dois mapas preservada entre telas, ausência de foco e
animação na página oculta, dados atuais e resize corretos ao retornar; fila limitada
e encerramento limpo; mesma geometria/pátios; benchmark isolado de carregamento
com tempo bloqueado da interface separado de duração total. Nenhuma mudança em
economia, servidor, banco ou geografia, nem serviço ou dependência adicional.
Downloads inéditos ainda dependem da rede e da cobertura do provedor.

## Refinamento solicitado em 31/10 · desempenho e materiais

O Pedro pediu mais fluidez, melhor renderização das texturas e acabamento. O
refinamento mantém geografia, titularidade, cargas, prazos e controles existentes.
Hipóteses: comparar conteúdo antes da triangulação evita reconstruções inúteis;
reutilizar malhas com limite de memória reduz trabalho durante a câmera; materiais
com detalhe proporcional ao tamanho do pixel eliminam informação subpixel e
repetição visual. Mata/água e contexto urbano devem ficar menos regulares.

Critérios de saída desta revisão: antes/depois reproduzível para 500 footprints
controlados, invariantes da malha e pátios mantidos, cache invalidado por dados
reais/alturas, sem reconstrução por rotação simples; câmera e cargas alinhadas;
materiais legíveis perto/longe; desktop, 390 px e revisão na tela aberta. Distinguir
tempo de CPU de FPS/GPU e registrar limites de medição. Não alegar aprovação
estética com base em testes. Evidência em `test-results/map-refinement`.

**Data:** 30/10/2026. **Estado:** implementação e verificação técnica concluídas;
acabamento visual da nova versão em revisão com o Pedro. Evidência em
[E-MAPA-VALIDATION](E-MAPA-VALIDATION.md).

**Problema do jogador:** o território ainda parece cartografia vetorial suave;
sprites isolados não entregam o mapa real em pixel, com construções e natureza,
solicitado pelo Pedro.

**Resultado observável:** abrir o Mapa, reconhecer ruas, rios e construções reais
com estética pixel, aproximar de uma cidade e escolher entre a vista de cima e a
inclinada. Selecionar um imóvel e acompanhar uma carga na estrada sem perder
precisão nem legibilidade.

**Requisitos relacionados:** GEO-01 (mapa navegável com camadas), UX-03 (desktop,
celular e foco visível), UX-05 (próprias propriedades e mapa econômico) e LOG-04
(animação segundo prazo persistido e distância da rota).

## Contexto e fontes de verdade

- O pedido atual amplia a apresentação da D-014: construções reais voltam ao mapa.
  A alteração não autoriza inventar cidades ou mudar imóveis jogáveis.
- [Pesquisa MAPA-PIXEL](../../../docs/research/MAPA-PIXEL.md): código do
  OpenPixel-RPG examinado em commit fixo, imagens inspecionadas e limites da
  adaptação. Seu pipeline gera imagens por IA; aqui a cartografia recebe uma
  apresentação própria sobre footprints reais.
- O Pedro rejeitou as primeiras extrusões simples por não atingirem a qualidade
  das construções da referência. A revisão adiciona arquitetura ilustrada; sua
  aceitação não pode ser inferida de build ou testes funcionais aprovados.
- `packages/world` e os tiles descrevem geografia; a simulação define empresas,
  propriedades, cargas e prazos. O mapa representa esses dados.
- Preservar alterações em andamento de outros trabalhos. Esta frente não altera
  regras econômicas, servidor, banco, receitas ou recursos.

## Fluxo jogável

1. Abrir o Mapa com os filtros existentes e reconhecer o território em pixel.
2. Mover e aproximar a câmera: construções aparecem a partir de zoom 13, na posição
   dos footprints cartográficos reais. O botão **Vista inclinada** / **Vista de
   cima** alterna a perspectiva e aproxima até pelo menos zoom 18. Numa vista
   regional, aproxima o município conhecido mais próximo. O limite de zoom 20
   permite inspecionar fachadas e telhados. A inclinada identifica **Fachadas
   ilustradas** e **Alturas aproximadas**.
3. Selecionar um imóvel com ponteiro ou teclado; a gaveta e o destaque mantêm a
   posição correta mesmo quando o espaço disponível muda.
4. Consultar uma carga e acompanhar o caminhão sobre a rota persistida, movendo e
   aproximando a câmera sem separar o veículo da estrada.
5. Alternar as camadas e o filtro de titularidade; as ações e informações
   existentes continuam acessíveis em desktop e largura de 390 px.

Não há nova consequência financeira neste fluxo. Comprar ou despachar continua
passando pelos comandos autoritativos existentes.

## Implementação

| Responsabilidade | Implementação ativa                                                                                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base geográfica  | Estilo local MapLibre, paleta rural e padrões naturais separados; recortes reais de `landuse` residential/commercial/retail/industrial com cores ilustrativas. Footprints `building` desde zoom 13. |
| Construções      | `pixel-buildings.ts` usa a API pública de custom layers WebGL2. A malha detalhada aparece desde zoom 15 quando pronta; volumes nativos desde zoom 14 são fallback.                                  |
| Geometria        | `pixel-buildings-geometry.ts`: paredes sobre footprints reais, duas águas para retângulos baixos de até 16 m, cobertura plana para formas complexas/altas e recortes na borda de tile z14.          |
| Materiais        | `pixel-building-shaders.ts`: grade de 0,20 m, quatro fachadas, janelas, portas, cornijas, telhas, cumeeiras, parapeitos e equipamentos ilustrados.                                                  |
| Perspectiva      | Alternância opcional pitch 0°/45°, aproximação até pelo menos zoom 18, limite 20 e indicação explícita de fachadas ilustradas/alturas aproximadas.                                                  |
| Renderização     | Base em `pixelRatio: 0.5`, ampliada sem suavização. Gameplay em outra instância, com resolução normal e fundo transparente.                                                                         |
| Sincronização    | Mesmas dimensões, centro, zoom, bearing, pitch e padding; considerar seleção, gaveta, resize, restauração de câmera e prévias.                                                                      |
| Interação        | Gameplay recebe a interação; a base acompanha a câmera. Preservar foco, filtros, seleção, agrupamentos e recuperação de carregamento.                                                               |
| Ciclo de vida    | Destruir instâncias e listeners juntos; a custom layer libera programa, buffers, VAO e atualização agendada.                                                                                        |

O segundo contexto WebGL resolve a separação entre pixel do território e nitidez do
jogo. A custom layer compartilha o contexto da base e acrescenta triangulação,
malha e recursos GL próprios. Verificar esse custo no fluxo real; não presumir
melhoria global de desempenho. `earcut` 3.2.4, já transitiva do MapLibre, passa a
dependência direta para triangular polígonos côncavos com furos, preservar pátios e
evitar acesso interno ao MapLibre. Não há serviço de geração externo. A vista de
cima continua disponível para jogar.

## Invariantes e falhas

- Saldo, estoque, reservas, titularidade, coordenadas e prazos não mudam.
- Rotas e posições dos caminhões continuam derivadas dos dados persistidos;
  estilização não recalcula trajetos nem usa animação desvinculada do prazo.
- Continuidade de rodovias, alças, pontes, túneis e acessos preservada em todos os
  estratos. Não filtrar trechos por existência de nome ou referência.
- Um footprint OSM é cenário cartográfico; não representa propriedade comprável
  nem revela titularidade econômica. Janelas, portas, materiais, telhados e
  equipamentos são arte, não observações reais. Alturas usam os atributos
  cartográficos disponíveis; o fallback gráfico de 6 m não é medição. Identificar
  essas condições na vista inclinada e na descrição acessível do controle.
- Deduplicar apenas geometria exata, preservando os fragmentos de mesmo ID em
  tiles diferentes. Manter furos de pátios e usar cobertura plana em fragmentos
  cortados na borda z14, evitando cumeeiras produzidas pelo recorte.
- Areia e gelo não recebem o padrão de floresta. Sem preenchimento de construções
  ausentes, ruas inventadas ou screenshots usados como fundo.
- Erro de tiles deve conservar a recuperação disponível. Falta de cobertura OSM
  não é tratada como dado completo do mundo real.

## Verificação

1. **Estilo e geometria:** validar o style specification e os filtros; manter os
   testes de continuidade viária e interpolação de largura. Confirmar edifícios
   vindos da fonte geográfica e a separação dos padrões naturais. Verificar
   triangulação côncava/com furos, deduplicação exata, fragmentos de mesmo ID e
   coberturas nas bordas de tile. Confirmar fallback e ativação do detalhe.
2. **Integração de câmera:** em fixture isolada, verificar projeção da base e do
   gameplay após pan, zoom, resize e abertura da gaveta. Verificar teclado,
   seleção de imóvel, filtro de titularidade e posição do caminhão na rota.
   Alternar pitch 0°/45° pelo botão com teclado e confirmar alinhamento,
   aproximação, município de destino e avisos de arte/altura aproximada.
3. **Território real:** capturar desktop e 390 px com tiles reais, registrando
   lugar e zoom. Inspecionar vista regional e urbana: prédios, água, natureza,
   pixels nítidos e continuidade das estradas. Incluir vista de cima e inclinada
   com fallback em zoom 14 e detalhe em zoom 18 ou maior. Inspecionar telhados,
   fachadas, pátios e transição entre representações. A extrusão lisa rejeitada
   pelo usuário é insuficiente como critério de acabamento.
4. **Qualidade:** build, testes proporcionais, formatação e catálogo de telas
   atualizado quando a implementação mudar seu inventário. Verificar ausência de
   erro de página e de rolagem lateral.

As capturas do laboratório com tiles vazios não comprovam a aparência geográfica.
Preservar a referência anterior; comparação nova não é aceitação automática.

## Critério de saída

- O território real está visivelmente pixelado; construções reais aparecem no
  zoom definido e controles, entidades e textos continuam legíveis.
- As duas projeções permanecem alinhadas nos casos de câmera e gaveta verificados.
- O botão de perspectiva funciona por teclado, alterna entre 0° e 45° e mantém a
  vista de cima disponível. A inclinada aproxima para leitura arquitetônica e
  identifica fachadas ilustradas e alturas aproximadas.
- Footprints mantêm a posição real, pátios permanecem abertos e fragmentos não
  desaparecem por compartilhar ID. A revisão visual mostra os detalhes
  arquitetônicos implementados; aprovação estética deve ser registrada somente
  após manifestação do usuário.
- Seleção por teclado, camadas, filtros e acompanhamento da carga funcionam em
  desktop e 390 px, sem erros de página nem rolagem lateral.
- Testes de estilo/rotas e build aprovados; evidência visual real registrada com
  seus limites. Descrever o custo de dois contextos sem alegar desempenho não
  medido.
- Atualizar validação, requisitos e estado somente com o que foi demonstrado.
  Limitações devem ter próxima ação concreta.

Ficam fora: geração por IA, importação do backend do OpenPixel-RPG, reconstrução de
fachadas reais, fotogrametria, substituição de footprints por sprites genéricos,
criação de imóveis a partir de edifícios OSM e alterações econômicas ou de
persistência. A arquitetura ilustrada não reconstrói os edifícios reais nem torna
a vista 3D obrigatória.
