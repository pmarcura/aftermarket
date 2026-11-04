# Spec 009 · Mundo 16-bit

Estado: **aprovada em direção** (John, 03/11/2026); detalhes abertos marcados com _(decidir)_. Referência de estilo escolhida pelo John (03/11): `docs/design/references/16bit/mundo-referencia-john.png`; direção de arte, paleta, catálogo e prompts em [`docs/design/PECAS-16BIT.md`](../../docs/design/PECAS-16BIT.md). O mock por código (`docs/design/mundo-16bit.html`) serviu só para combinar leitura e escala; foi julgado feio e o visual passa a ser definido pelas peças geradas. Depende da 008 (a cidade clicável vira a porta do tabuleiro).

## Direção (decisão do John)

O jogo deixa de ser um mapa de GPS com pinos e passa a ser um **mundo em pixel art 16-bit**: cidades que se veem como cidades, prédios de cada empresa em isométrico pixelado, e o uso das empresas (produzindo, parada, carregando caminhão) visível na própria construção. Decisões técnicas (Claude, aprovadas em 03/11):

1. **Dois níveis de visão.** _Mundo_: Centro-Sul em estilo mapa de SNES (relevo, rios, estradas, 59 cidades como ícones que crescem com os negócios; caminhões andando). _Cidade_: tela própria **top-down** (vista de cima, como `docs/design/references/16bit/cidade-referencia-john.png`, escolhida em 03/11): ruas de asfalto com faixas, quadras com prédios de alturas variadas, estacionamentos, praças, galpões; cada empresa é um prédio com estado; lotes à venda com placa. O tabuleiro isométrico foi descartado.
2. **Geografia real por baixo.** O mundo 16-bit é uma pele sobre as mesmas coordenadas, estradas e distâncias que o motor usa (frete, prazos, polos). Nada do motor muda.
3. **Cidade gerada por regras**, a partir de um catálogo fechado de peças top-down (tiles de rua reta/curva/cruzamento com faixas, calçada, quadra, estacionamento, praça, prédios de 2–12 andares em 3 larguras, galpão, loja, fábrica com pátio, fazenda e mina na borda). Nunca 59 cenários desenhados à mão.
4. **Pipeline de arte fechado antes de gerar imagens:** paleta única, tile 32 px isométrico 2:1, lista de peças com nome, tamanho e estados. Prompts saem desta spec; imagens geradas pelo Pedro/John no GPT (CLAUDE.md), substituindo peças provisórias uma a uma sem mudar código.

## Requisitos

- **R1 Nível mundo em pixel.** Terreno pixelado (água, mata, campo, serra) a partir dos dados vetoriais atuais; estradas como traço pixel de 2–3 larguras por classe; cidades como ícone de 3 tamanhos (vila, cidade, metrópole) por população × negócios instalados; caminhões como sprite pixel com direção (8 orientações). Zoom em passos inteiros (1×, 2×, 3×), sem interpolação (`image-rendering: pixelated`).
- **R2 Tela da cidade (top-down).** Malha de ruas gerada da lista de lotes da cidade (os `properties` de hoje): cada lote vira uma quadra; lote livre = terreno com placa "à venda"; lote com empresa = prédio da categoria no tamanho das linhas instaladas (1–2 / 3–4 / 5+). Quadras de preenchimento (prédios, praças, estacionamentos) proporcionais à população. Avenida principal e saída para a rodovia (por onde os caminhões entram e saem).
- **R3 Estado visível na construção.** Produzindo (fumaça/luz), parada (escuro), sem insumo (selo vermelho da 008), caminhão carregando no pátio quando há remessa saindo/chegando, loja com fila quando a procura supera o estoque. Mesma fonte de dados das pendências (008 R1).
- **R4 Ações no tabuleiro.** Tocar num lote livre → comprar (fluxo atual); tocar no seu prédio → abrir o negócio; tocar em prédio de bot → ver o que vende; botão "voltar ao mundo". Teclado e leitor de tela: cada lote é um botão, como no mapa de hoje.
- **R5 Catálogo de peças e paleta.** Arquivo `docs/design/PECAS-16BIT.md`: paleta (≤ 32 cores), dimensões, lista completa de peças com nome de arquivo e estados; prompt de geração por peça. Peças provisórias desenhadas por código até a arte chegar.
- **R6 Desempenho.** Nível mundo ≤ 16 ms por quadro no celular médio com 550 empresas; tabuleiro de metrópole (≤ 60 lotes) idem. Sem rede externa nos testes e2e.

## Fases

- **A · Catálogo e mock (esta spec, docs):** paleta, lista de peças, mock HTML das duas telas, prompts. Aprovação do John sobre o visual.
- **B · Tela da cidade** com peças provisórias (código), ligada à cidade clicável da 008. Jogável: comprar lote e abrir negócio pela cidade.
- **C · Mundo em pixel**: terreno e estradas pixelados sobre o MapLibre (raster gerado por zoom) ou canvas próprio _(decidir pelo desempenho medido)_; ícones de cidade e caminhões sprite.
- **D · Arte final**: substituição das peças provisórias pelas geradas; ajuste de paleta.

## Fora desta spec

Modelagem 3D real e isométrico (a referência é top-down; D-035 exclui 3D obrigatório); construção de cidade pelo jogador (SimCity) — o tabuleiro reflete a economia, não é editável além de comprar lotes; mapa fictício.

## Critérios de aceite

- **A1** Jogador compra um lote e abre um negócio só pelo tabuleiro da cidade (e2e sem rede).
- **A2** Mudança de estado do negócio aparece no prédio em até uma rodada econômica.
- **A3** Trocar uma peça provisória pela arte final é só substituir o arquivo com o nome do catálogo.
- **A4** R6 medido e registrado.
