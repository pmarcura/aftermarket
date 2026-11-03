# E · Validação do mapa real em pixel

## Continuidade de carregamento · 31/10

Após relato de travadas, a página principal mantém uma única instância do mapa
depois da primeira visita. Sair para Comércio oculta a página com `hidden` e
`inert`, pausa atualizações geográficas, câmera e animação de cargas; voltar
redimensiona e aplica dados atuais. A câmera, filtros, tiles e contextos WebGL são
preservados. Miniaturas continuam com seu ciclo de vida próprio.

Filtro espacial, chave de conteúdo, cache limitado e triangulação passam a um
worker nativo, sem dependência adicional. Há um pedido em voo e um pedido mais
recente substituível. Durante movimento não se consultam novas malhas; chegadas de
tiles são agrupadas por 140 ms. Geração e revisão invalidam respostas obsoletas.
O último buffer permanece até o próximo resultado válido; a transferência copia
o buffer no worker para não destacar o conteúdo retido no LRU. Falhas usam a
representação nativa e permitem nova tentativa na próxima navegação. Remoção da
camada termina o worker.

Verificação: build aprovado, 275 testes em 35 arquivos aprovados e dez fluxos de
navegador aprovados (seis de navegação/abertura/cargas e quatro do mapa). Os novos
casos verificam identidade das duas instâncias e dos contextos WebGL, câmera,
filtro e resize entre telas em desktop e celular; a página oculta não fica na
árvore acessível. Quatro testes unitários verificam fila limitada, respostas
atrasadas, pausa, encerramento e recuperação. Os testes WebGL continuam verificando
pixels reais, pátios, galpões e reuso durante rotação.

`npx tsx scripts/benchmark-map-loading.ts --url=http://127.0.0.1:5187 --after`
mede 4.000 footprints sintéticos em navegador isolado com toda API interceptada.
Resultado em `test-results/map-loading/after.json`: uma consulta (17,3 ms), uma
construção no worker (64,9 ms), um upload (2,6 ms), carregamento total 430,5 ms.
O heartbeat de 20 ms teve mediana de 20,1 ms e máximo de 83,4 ms; houve uma tarefa
longa de 75 ms (25 ms acima do limiar de 50 ms). Não existe amostra anterior
equivalente para alegar percentual de ganho. Não é medição de FPS/GPU ou rede real.
O resultado confirma trabalho fora da UI, mas não ausência absoluta de travadas:
consulta de dados, preparação de tiles e upload ainda têm custo. Próxima ação se
persistirem pausas: perfil dessas etapas em área real densa, antes de ampliar cache
ou infraestrutura. Áreas inéditas continuam dependendo do download do provedor;
o cache desta implementação dura a sessão, não uma recarga completa do navegador.

## Refinamento de 31/10 · desempenho e materiais

Pedido do Pedro: mais fluidez, melhor renderização das texturas e acabamento.
Os contornos, alturas disponíveis, pátios e fragmentos continuam vindo da mesma
geometria. Esta seção complementa a validação original abaixo.

- A consulta agora compara conteúdo antes de projetar e triangular. O cache tem
  no máximo três malhas e 16 MiB, incluindo vértices e chaves; um conteúdo maior
  continua renderizável sem ficar retido no cache.
- Pequenos movimentos com a mesma cobertura e revisão da fonte reutilizam a
  malha; eventos reais de tiles invalidam o cache. O `moveend` usado é o da câmera
  interativa, preservando a sincronização imediata das duas projeções.
- Materiais retiram detalhes subpixel conforme as derivadas de UV. Janelas e
  telhas são mais espaçadas; massas de cor permanecem legíveis longe, com moldura,
  material e acabamento de cobertura em aproximações maiores.
- A primeira simplificação apagou detalhes demais na revisão de perto. A versão
  final mantém juntas de painéis espaçadas, parapeitos, beirais e equipamentos
  raros em escala maior, com cobertura analítica, evitando depender só do detalhe
  fino para dar acabamento à arquitetura.
- Mata e água usam distribuição menos regular. Usos urbanos reais de escolas,
  hospitais, bibliotecas, universidades, garagens e terminais complementam as
  classes anteriores. Cores representam uso ilustrado, não pavimentação medida.
- Os oito padrões ocupam 224 KiB brutos e são gerados uma vez para registro por
  runtime. Esse valor não inclui atlas da GPU nem substitui o orçamento das malhas.

### Medição reproduzível

`npx tsx scripts/benchmark-map.ts` mede o caminho de reconstrução anterior;
`npx tsx scripts/benchmark-map.ts --after` mede o cache. Ambos usam 60 consultas
repetidas, após aquecimento, dos mesmos 500 footprints sintéticos, com 72 pátios.
Não abrem banco, API ou mundo salvo.

| CPU, mesmo conteúdo aquecido | Reconstrução anterior |      Cache |
| ---------------------------- | --------------------: | ---------: |
| Mediana por consulta         |             7,7817 ms |  0,7422 ms |
| Percentil 95                 |            12,3658 ms |  1,2186 ms |
| Total de 60 consultas        |           480,3773 ms | 49,9939 ms |
| Vértices resultantes         |                20.184 |     20.184 |
| Bytes dos vértices           |               807.360 |    807.360 |
| Chave da geometria           |            `ddd741e3` | `ddd741e3` |

A mediana dessa carga de CPU caiu cerca de 90,5%; não se infere o mesmo ganho em
FPS, primeira abertura, GPU ou mundo com 500 bots. O cache fez uma construção e
65 reusos incluindo aquecimento, retendo aproximadamente 1 MiB. JSONs em
`test-results/map-refinement/before-cpu.json` e `after-cpu.json`.

### Verificação desta revisão

- Build aprovado e 271 testes em 34 arquivos com `npm test -- --maxWorkers=2`.
  A primeira execução conjunta de build/navegador/testes excedeu o limite de 5 s
  em dois testes de migração SQLite; a execução com menos concorrência passou sem
  alterar código ou limite desses testes.
- Dez testes de navegador em desktop e 390 px, incluindo compilação/desenho WebGL,
  pátios, galpão envolvendo o viewport, teclado e caminhão após recarga. A rotação
  controlada também comprova reuso sem nova triangulação ou envio do buffer.
- Perfis de desenvolvimento ficam em atributos do canvas, sem controles novos
  para o jogador. O registro inicial do IAB teve intervalos próximos de 1 s; sua
  cadência não foi tratada como benchmark controlado de FPS/GPU.
- Auditoria de recursos e catálogo aprovados. Nenhuma dependência, regra econômica
  ou migração de banco foi adicionada nesta revisão.

Aceitação estética continua com o Pedro; desempenho de GPU em máquina
representativa e primeira abertura fria são próximas medições, se ainda houver
travamentos observáveis. As referências anteriores do laboratório permanecem.

## Validação original de 30/10

**30/10/2026.** Implementação e verificações técnicas concluídas. A versão inicial
com extrusões lisas foi rejeitada pelo Pedro; a revisão adiciona arquitetura
ilustrada sobre os contornos reais. A aprovação estética da nova versão permanece
aberta e esta validação não encerra a etapa E.

## Resultado observável

- Geografia de OpenFreeMap/OpenMapTiles/OSM em pixels de 2 CSS px. Solo, matas,
  água, areia, gelo e usos urbanos conservam as geometrias cartográficas.
- Construções aparecem no zoom 13; a vista inclinada tem fallback de volumes
  no zoom 14 e acabamento próprio no zoom 15 ou maior, após carregar a geometria.
- Telhados em duas águas para plantas retangulares baixas; plantas irregulares e
  altas usam cobertura plana. Fachadas têm materiais, janelas, portas e cornijas;
  telhas, cumeeiras, beirais e coberturas têm desenho em grade de 0,20 m.
- Vista de cima/inclinada, zoom até 20 e aproximação a 18 pelo controle. Quando a
  câmera está regional, a aproximação usa o município conhecido mais próximo.
- Fachadas e formas de cobertura são interpretação artística; alturas são
  aproximadas. A interface identifica ambas. Edifícios do cenário não viram
  propriedades compráveis e nenhuma operação econômica foi alterada.

## Verificação executada

| Verificação                                                                                                                                                              | Resultado e alcance                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                                                                                                                                          | Build, 260 testes em 33 arquivos, recursos e catálogo aprovados.                                                                                                                                                                                                                  |
| Estilo e malha                                                                                                                                                           | 13 testes específicos: continuidade das vias e estratos, filtros naturais, alturas, telhados, pátios, deduplicação e determinismo.                                                                                                                                                |
| `npx playwright test tests/e2e/pixel-map.spec.ts tests/e2e/navigation.spec.ts tests/e2e/opening.spec.ts tests/e2e/animation.spec.ts --output=test-results/pixel-browser` | Dez testes aprovados; fixtures em memória, sem consultar ou alterar o mundo salvo.                                                                                                                                                                                                |
| Resolução e câmera                                                                                                                                                       | Desktop e 390 px, DPR 2: somente a base é pixelada; centro, zoom, rotação, inclinação, roll, padding e resize permanecem alinhados.                                                                                                                                               |
| Interação                                                                                                                                                                | Seleção por ponteiro/teclado, fechamento da gaveta no celular, filtros, compra/instalação/equipe e alternância de perspectiva.                                                                                                                                                    |
| Renderer WebGL                                                                                                                                                           | Fonte GeoJSON pública controlada; pixels mudam com a camada ativa, mais de dez cores, pátio permanece vazio, erro GL zero e recursos limpos ao remover a camada. Galpão envolvendo o viewport em zoom 20 continua visível.                                                        |
| Transporte                                                                                                                                                               | Comando real em memória com rota curva de fixture: caminhão a 20% e 65% dos prazos contratados, geometria conservada, alinhamento dos dois mapas e progresso após recarga.                                                                                                        |
| Cartografia real                                                                                                                                                         | Onze capturas de Campinas, São Paulo e Santos, incluindo vista regional, urbana, água, casas e celular. Zero erros de página/console, comandos da API, rolagem lateral ou sobreposição da legenda à escala/créditos. Metadados em `test-results/pixel-map/real-cartography.json`. |

Evidência visual em `test-results/pixel-map`: `regiao-desktop.png`,
`cidade-inclinada-desktop.png`, `casas-desktop.png`, `casas-mobile.png`,
`cidade-sao-paulo.png`, `agua-desktop.png` e `imovel-mobile.png`. Capturas
cartográficas usam mundo econômico em memória e tiles reais; os testes com PBF
vazio demonstram controles e sincronização, não aparência territorial.

Casas de Campinas: centro **[-47.064757, -22.904734]**, zoom **19,2**, inclinação
**50°**. A captura de São Paulo usa **[-46.655, -23.561]**, zoom **18,7**, inclinação
**55°**, com 168 geometrias cartográficas na malha. Contagens da malha não equivalem
a cadastro de imóveis individuais, pois a fonte pode agrupar polígonos.

## Problemas encontrados e resolvidos

- Areia e gelo recebiam o padrão de mata; agora cada material é separado.
- A gaveta móvel se posicionava sob o cabeçalho; o mapa passou a conter sua
  posição e o botão de fechar permanece acionável.
- A legenda cobria escala e créditos no celular; há espaço reservado e medição
  de não sobreposição na captura real.
- Um `load` após falha de tiles apagava a mensagem; a falha permanece recuperável
  pelo botão de recarregar.
- O filtro da malha excluía prédios que envolviam todo o viewport; agora usa
  interseção dos limites. O estado da camada é reiniciado em sua remontagem.
- Tiles individuais nem sempre informam `sourceDataType: content`; a malha agora
  acompanha todas as atualizações da fonte e carrega ao trocar de cidade.
- Fixtures antigas não declaravam as novas camadas e o teste de animação não
  abria o mapa na interface atual; dados e fluxo foram atualizados, preservando
  a verificação de geometria, prazos e ausência de mutação financeira.

## Limites e próxima ação

1. Cobertura e alturas dependem do OSM. Telhados, fachadas e equipamentos são arte,
   sem afirmar reprodução de um edifício específico. A revisão visual com o Pedro
   deve julgar o trecho de casas e a cidade na escala de jogo; o acabamento não foi
   declarado equivalente às imagens geradas por IA da referência.
2. Há dois contextos WebGL por mapa e construção de malha após carregar/mover.
   Abertura, navegação e limpeza foram verificadas; falta medir orçamento de frame
   em um PC representativo com o mundo de 500 bots. Não se afirma ganho global de
   desempenho.
3. Geometrias cortadas por tiles são preservadas; cortes conhecidos evitam criar
   cumeeiras falsas. Costuras em prédios muito grandes e longa navegação merecem
   inspeção no playtest. Não há reconstrução de fachadas ou preenchimento de áreas
   sem cobertura geográfica.

As referências anteriores do laboratório foram preservadas. Não houve migração,
criação de recursos econômicos ou alteração do banco do jogador. A dependência
direta `earcut` já existia no lock via MapLibre; sua promoção é justificada pela
triangulação de polígonos côncavos com pátios. Pesquisa e fontes em
[MAPA-PIXEL](../../../docs/research/MAPA-PIXEL.md).
