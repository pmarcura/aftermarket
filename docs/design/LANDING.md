# Landing AFTERMARKET

## Revisão de 28/10/2026 (noite, 3): telas reais, mensagem duradoura e assinatura

Crítica do Pedro à revisão anterior: aparelhos soltos no fundo verde, sem animação, cartões
sobrando sob o celular, mapa do tablet que não era o jogo e números da versão de teste.
Pediu página profissional, marketing de verdade, deixar claro que o projeto está em
desenvolvimento e a assinatura dele.

- **Topo escuro inteiro** (`.landing-artboard`, quadrado no computador, 100 × 252 no
  celular). O planeta ([`planeta-brasil.png`](../../apps/web/public/arte/landing/planeta-brasil.png),
  PixelLab) tem a mira de GPS travando no Sudeste e um feixe tracejado que desce até o
  tablet. Título **“Aonde você quiser.”**, selo **Em desenvolvimento**, texto de
  apresentação e dois botões (entrar e ver o jogo). No celular o título fica abaixo do
  planeta, sem sobrepor o globo.
- **Telas reais** dentro do computador e do celular, trocando a cada 6,5 s com
  aproximação de câmera e aparelhos flutuando: Mapa, Comprar e Loja. Os três botões
  **Localize · Compare · Opere** escolhem a tela (com barra de tempo). Rótulo: “Telas reais
  da versão em desenvolvimento”. Fotos geradas por `npm run landing:telas`
  (`scripts/capture-landing.ts`, com `npm run dev:v2` aberto); a barra superior com saldo
  da empresa de teste fica fora do recorte. Fotos em densidade 2× (computador a 1360 px,
  celular a 390 px) para ficarem nítidas; aparelhos ocupam ~74% da largura do topo.
  Refazer as fotos quando a interface mudar.
- **Textos sem números da versão de teste** (cidades, bots, mercadorias e escala de tempo
  saíram). Mensagens vêm dos princípios do GDD: um só mundo para todos, nada surge do
  nada, distância custa dinheiro, quem joga faz o preço, muitos caminhos para crescer,
  mesmas regras, recursos finitos, sem vitória única.
- **Projeto em construção** com a assinatura “Um jogo de Pedro Marçura · Criação e
  design” e rodapé “© 2026 Pedro Marçura · Projeto em desenvolvimento”, com o crédito do
  mapa (OpenStreetMap, OpenMapTiles, OpenFreeMap).
- Com movimento reduzido: planeta, telas e aparelhos ficam parados na primeira cena.

Sem uso agora: `planet.png` e `caminhao-se/so.png`. Verificação: 7 testes de
`playwright.landing.config.ts` (computador, referência, celular, teclado, entrada no
jogo), troca de tela pelos botões e movimento reduzido conferidos.

**Próximo passo (decisão do Pedro, 28/10/2026):** as fotos com aproximação de câmera ficaram
travadas e foram retiradas; a troca entre telas agora é só um esmaecimento suave. A vitrine
animada será refeita depois, nativa, com os componentes reais da interface e trabalho de
motion, quando as telas do jogo estiverem mais estáveis. Também ficam para essa etapa novas
seções e a revisão geral da página.

O histórico abaixo descreve a primeira versão.

Implementação de 28/10/2026. A primeira imagem enviada por Pedro é a referência
principal. Ele confirmou a **composição inteira, incluindo os dispositivos**, com
conteúdo adaptado ao AFTERMARKET.

## Composição e implementação

`apps/web/src/pages/LandingPage.tsx` e `landing.css` são a implementação canônica.
O horizonte termina em 43,9% da largura; celular, tablet e cartões seguem as posições
proporcionais da arte de 736 × 886. Molduras, grade, textos e cartões são HTML/CSS/SVG.
O planeta é uma imagem separada, usada três vezes com o mesmo URL e cache.

Abaixo da composição, a seção **Como jogar** mantém explicações, ação principal e
perguntas em tamanho legível, inclusive no celular. Os textos das miniaturas têm
função visual; não são o único acesso ao conteúdo ou ao jogo.

Rotas: `/` e `/landing` abrem a apresentação sem `GameProvider` e sem chamadas ao
mundo. `/jogar` abre a implementação existente. `/lab` continua disponível; seu link
**Abrir jogo** aponta para `/jogar`. Testes anteriores e coletores foram ajustados.
Nenhuma regra econômica, dado de jogador ou banco foi alterado.

O botão de entrada precisa da API do projeto para carregar o mundo. A prévia Vite
sozinha apresenta a landing normalmente; o jogo oferece o erro e a nova tentativa
existentes quando a API está ausente.

## Referências preservadas

Originais em [`references/landing`](references/landing/manifest.json), com SHA-256
e papel da referência no manifesto. Não são fundos de interface. O planeta foi
recriado e o texto foi adaptado; portanto não se declara igualdade absoluta de pixels
com o original.

## Arte do planeta

- Arquivo final: [`planet.png`](../../apps/web/public/arte/landing/planet.png), PNG
  transparente de 1280 × 1280, aproximadamente 1,36 MB.
- Método: ferramenta integrada `image_gen`, sem CLI, API key ou dependência do PixelLab.
- Entrada: primeira imagem como referência visual, sem copiar a UI para o jogo.
- Inspeção: globo completo, contorno em degraus, luz creme, oceano azul/teal, continentes
  verdes; recorte feito por CSS nos dispositivos e no horizonte.

Prompt final enviado à ferramenta:

> Use case: stylized-concept. Asset type: isolated transparent sprite for a pixel-art website hero. Reference image 1 is ONLY a style and planet reference. Create a single COMPLETE round planet Earth in exactly the same chunky 1990s pixel-art style and colors as the large planet in the reference. Show the whole globe, centered with minimal transparent margins on a square image. Prominent Asia and the Pacific with Australia below, pale buttery cream sunlight on top and right rim, layered grass green continents, teal and medium cyan oceans, dark navy shadow on the left/lower edge, chunky ivory clouds scattered across Earth. Pixel grid equivalent to roughly a 140 x 140 sprite enlarged with nearest-neighbor, visibly square flat-color pixel clusters, crisp stepped circumference. The planet should be large and luminous, with blocky continents and irregular layered clouds. Single Earth only. No UI, no words, no devices, no stars, no frame, no grid, no cast shadow outside globe, no background of any kind. Actual alpha transparency outside Earth. Preserve the reference's restrained retro palette, very limited shades, do not produce smooth gradients or photorealism.

## Fontes

Press Start 2P foi adicionada apenas à landing para reproduzir os blocos grossos dos
títulos. Arquivo original local em `apps/web/src/assets/fonts/PressStart2P-Regular.ttf`
e licença em `PressStart2P-OFL.txt`. Fonte e licença vieram do
[repositório oficial Google Fonts](https://github.com/google/fonts/tree/main/ofl/pressstart2p)
em 28/10/2026. Geist Pixel Square e Archivo já pertenciam ao projeto. Não há busca
de fontes remotas durante o uso.

## Verificação

Comando dedicado: `npx playwright test --config=playwright.landing.config.ts`.
Ele sobe somente Vite em 5187; não inicia servidor econômico nem abre SQLite.
Resultados e limites ficam na
[validação da entrega](../../.planning/phases/E-landing/E-LANDING-VALIDATION.md).
