# Peças 16-bit · direção de arte e catálogo (spec 009, fase A)

Referência de estilo escolhida pelo John em 03/11/2026: `references/16bit/mundo-referencia-john.png`
(mapa de mundo top-down, 16-bit, campo verde vivo, mata em tufos escuros, rio azul claro com
margem, estradas de terra bege, vilas e castelos como aglomerados pequenos). **É referência, não
material do jogo**: as peças do AFTERMARKET são geradas a partir dos prompts abaixo, com esta
paleta e estas regras, e substituem uma a uma as peças provisórias.

## Regras fixas

- Vista **top-down levemente inclinada** no mundo (referência do mapa) e **top-down** na cidade
  (referência `references/16bit/cidade-referencia-john.png`, 03/11): ruas de asfalto com faixas,
  prédios vistos de cima com fachada sugerida, telhados variados, árvores, estacionamentos.
- Tile de **32 × 32 px** no mundo e na cidade (prédios ocupam 1×1 a 3×3 tiles). Múltiplos
  inteiros; sem anti-aliasing; sem gradientes; sombras por trama (dither) ou cor chapada.
- Paleta única, abaixo. Qualquer peça nova usa só estas cores (até 32). Fundo transparente nas
  peças soltas (PNG).
- Um arquivo por peça, nome do catálogo. Trocar o arquivo troca a arte, sem código.

## Paleta (extraída da referência, 20 cores + 6 do jogo)

| Papel                    | Cor       |
| ------------------------ | --------- |
| Campo claro              | `#00c369` |
| Campo (trama)            | `#38cf73` |
| Campo escuro / sombra    | `#00a54b` |
| Mata clara               | `#009b72` |
| Mata                     | `#00804c` |
| Mata escura              | `#006c56` |
| Serra clara              | `#80cc85` |
| Serra                    | `#4d7962` |
| Serra pedra              | `#7f786b` |
| Serra sombra             | `#37596b` |
| Água                     | `#00a9f8` |
| Água funda               | `#3a5d6e` |
| Areia / estrada          | `#d5bb97` |
| Estrada escura           | `#b9a991` |
| Muro / pedra clara       | `#cdb796` |
| Telhado                  | `#9a946e` |
| Telhado terracota (jogo) | `#b54a3a` |
| Madeira (jogo)           | `#8a5a32` |
| Rodovia (ouro do jogo)   | `#eec156` |
| Alerta (jogo)            | `#e4572e` |
| Atenção (jogo)           | `#f2bd3c` |
| À venda (jogo)           | `#76c862` |
| Contorno / sombra forte  | `#1a2a24` |
| Luz / janela             | `#fff2b0` |
| Metal / caminhão         | `#cfcfc0` |
| Branco quente            | `#f3e7cc` |

## Catálogo de peças

### Mundo (32 px, top-down)

| Arquivo                                                  | Peça                                          | Variações            |
| -------------------------------------------------------- | --------------------------------------------- | -------------------- |
| `mundo/campo-{1..4}.png`                                 | campo com trama de pasto                      | 4                    |
| `mundo/mata-{1..6}.png`                                  | tufos de mata (borda N/S/L/O, miolo, isolado) | 6                    |
| `mundo/serra-{1..4}.png`                                 | serra (pico, encosta esquerda/direita, sopé)  | 4                    |
| `mundo/agua-{1..3}.png`                                  | água (miolo, margem reta, margem curva)       | 3 (+2 anim.)         |
| `mundo/rio-{reto,curva,cruz}.png`                        | rio sobre campo                               | 3                    |
| `mundo/praia-{1..2}.png`                                 | areia costeira                                | 2                    |
| `mundo/rodovia-{reto,curva,cruz,ponte}.png`              | rodovia (dourada, faixa central)              | 4                    |
| `mundo/estrada-{reto,curva,cruz,ponte}.png`              | estrada de terra                              | 4                    |
| `mundo/cidade-{vila,cidade,metropole}.png`               | aglomerado de prédios, 64/96/128 px           | 3 × {normal, alerta} |
| `mundo/caminhao-{pesado,leve}-{n,ne,l,se,s,so,o,no}.png` | caminhão 16 px                                | 2 × 8                |
| `mundo/arvore-{1..3}.png`, `mundo/pedra.png`             | detalhes soltos                               | 4                    |

### Cidade (top-down, 32 px)

| Arquivo                                                                           | Peça                         | Variações                       |
| --------------------------------------------------------------------------------- | ---------------------------- | ------------------------------- |
| `cidade/chao-{grama,terra,calcada}.png`                                           | losango de chão              | 3                               |
| `cidade/rua-{reto-a,reto-b,curva-{1..4},cruz,t-{1..4}}.png`                       | rua                          | 11                              |
| `cidade/quadra-vazia.png`, `cidade/placa-venda.png`                               | lote livre                   | 2                               |
| `cidade/casario-{p,m,g}.png`                                                      | casario de fundo (população) | 3                               |
| `cidade/arvore-{1..2}.png`, `cidade/poste.png`                                    | detalhes                     | 3                               |
| `cidade/loja-{p,m,g}.png`                                                         | loja                         | 3 × {aberta, fechada, fila}     |
| `cidade/industria-{p,m,g}.png`                                                    | indústria (chaminé)          | 3 × {produzindo, parada}        |
| `cidade/fazenda-{p,m,g}.png`                                                      | fazenda (talhões + sede)     | 3 × {plantada, colhida, parada} |
| `cidade/mina-{p,m,g}.png`                                                         | mina (boca + esteira)        | 3 × {operando, parada}          |
| `cidade/armazem-{p,m,g}.png`                                                      | armazém / distribuidor       | 3 × {com estoque, vazio}        |
| `cidade/transportadora-{p,m,g}.png`                                               | pátio de caminhões           | 3 × {com frota, vazio}          |
| `cidade/caminhao-{pesado,leve}-{ne,se,so,no}.png`                                 | caminhão isométrico 32 px    | 2 × 4                           |
| `cidade/selo-{alerta,atencao}.png`, `cidade/fumaca-{1..3}.png`, `cidade/fila.png` | sobreposições de estado      | 6                               |

Tamanho P/M/G = linhas instaladas 1–2 / 3–4 / 5+. Estado sem arte própria usa sobreposição
(selo, fumaça, fila) por cima da peça base.

## Prompts de geração (GPT, imagem)

Base comum, colar antes de cada prompt:

> Pixel art 16-bit no estilo de mapas de SNES, vista top-down levemente inclinada, cores chapadas
> sem gradiente nem anti-aliasing, sombras por dithering, contornos escuros finos
> (#1a2a24). Paleta restrita a: #00c369 #38cf73 #00a54b #009b72 #00804c #006c56 #80cc85
> #4d7962 #7f786b #37596b #00a9f8 #3a5d6e #d5bb97 #b9a991 #cdb796 #9a946e #b54a3a #8a5a32
> #eec156 #e4572e #f2bd3c #76c862 #1a2a24 #fff2b0 #cfcfc0 #f3e7cc. Sem texto, sem marca
> d'água, fundo transparente quando for peça solta.

1. **Tileset de terreno (mundo).** "Folha de tiles 8 × 8, cada tile 32 × 32 px, grade exata sem
   espaçamento: 4 tiles de campo verde com trama de pasto; 6 tiles de mata em tufos (bordas
   norte, sul, leste, oeste, miolo, isolado); 4 tiles de serra (pico, encosta esquerda, encosta
   direita, sopé); 3 tiles de água (miolo, margem reta, margem curva); 3 de rio sobre campo (reto,
   curva, cruzamento); 2 de areia; 4 de rodovia dourada com faixa central (reto, curva,
   cruzamento, ponte); 4 de estrada de terra (reto, curva, cruzamento, ponte); 3 árvores soltas e
   1 pedra. Tiles de borda devem encaixar entre si (tileable)."
2. **Cidades (mundo).** "Três aglomerados urbanos vistos de cima, 64, 96 e 128 px de largura, lado
   a lado, fundo transparente: vila (6 casas de telhado terracota e uma igreja), cidade (20
   prédios baixos, praça, telhados mistos) e metrópole (40 prédios, 3 torres altas com janelas
   acesas, viaduto). Mesma paleta; chão urbano em pedra clara #cdb796; contorno escuro."
3. **Peças da cidade (top-down).** "Folha de tiles de 32 px, vista de cima como num jogo de SNES
   urbano: ruas de asfalto cinza com faixas brancas e calçada (reta, curva, cruzamento, T);
   estacionamento com vagas; praça com árvores; quadra de esporte; prédios de 2, 4, 8 e 12 andares
   em 1, 2 e 3 tiles de largura, telhado com caixa d'água e ar-condicionado, fachada sugerida na
   borda inferior; loja com toldo; fábrica com telhado serrilhado e pátio; galpão; sede de fazenda
   com talhões; mina com boca e esteira. Fundo transparente, grade exata."
4. **Caminhões.** "Sprite sheet de um caminhão pesado e um leve, 16 × 16 px no mundo (8
   direções) e 32 × 32 isométrico na cidade (4 direções), cabine vermelha #b54a3a, baú
   #cfcfc0, fundo transparente, grade exata."

Ordem recomendada de geração: 1 → 2 → 4 → 3. Com 1 e 2 prontos, o mock do mundo já sai com arte
real; com 3, o tabuleiro.

## O que o código faz com as peças

- Mundo: as mesmas coordenadas do MapLibre; terreno classificado a partir dos dados vetoriais
  (water, wood, landcover) em tiles de 32 px por zoom inteiro; estradas desenhadas tile a tile
  sobre as geometrias OSM já baixadas; cidade escolhida por população × negócios.
- Cidade: tabuleiro gerado dos `properties` da cidade; cada lote vira um losango com a peça da
  categoria no tamanho das linhas e a sobreposição do estado (mesma fonte das pendências).
