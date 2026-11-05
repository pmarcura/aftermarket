# Aftermarket · Vídeo de marketing 01 · Roteiro, tempos e som

Vídeo vertical 9:16 (1080×1920), para Reels, TikTok e Shorts. **67 segundos, 10 cenas, com trilha
de efeitos sonoros.**

- **Página:** `aftermarket-marketing-01.html`. Tem os botões "Tocar" (imagem + efeitos) e
  "Carregar narração", uma barra para pular e uma chave para ligar ou desligar os efeitos.
- **MP4:** `npx tsx .runtime/video/render.mts --saida=output/aftermarket-marketing-01.mp4`. O
  script grava quadro a quadro, a 30 por segundo, com vídeo H.264 e áudio AAC. Também gera
  `…-efeitos.wav`, só com a trilha, para mixar com a narração.
- **Legendas:** já vêm no vídeo. São blocos curtos, com a palavra da vez em verde, na área segura.

**Antes de publicar:** coloque o link do Discord no comentário fixado.

## Narração (ElevenLabs)

**Voz:** tom de trailer, curioso no começo e firme no fim.
- Pausa curta antes de "ou até em Xique-Xique".
- Peso em "Faltou soja", "O frete subiu" e "O rival baixou o preço".
- Calor em "feito por vontade e paixão".

| Tempo       | Cena      | Fala                                                                                                    |
| ----------- | --------- | ------------------------------------------------------------------------------------------------------- |
| 0:00 – 0:04 | Planeta   | Imagine um jogo de estratégia e economia…                                                              |
| 0:04 – 0:11 | Brasil    | …onde você faz negócios em Santa Bárbara d'Oeste, no Acre… ou até em Xique-Xique, na Bahia!            |
| 0:11 – 0:18 | História  | Construa sua história de empresário: com seus amigos… ou contra os concorrentes.                       |
| 0:18 – 0:27 | Cadeia    | Cada elo é um jogador. A soja de um vira o óleo do outro e chega à loja de um terceiro. E o dinheiro volta pelo mesmo caminho. |
| 0:27 – 0:31 | No jogo   | No jogo, você monta tudo isso encaixando blocos.                                                       |
| 0:31 – 0:39 | Problemas | Faltou soja. O frete subiu. O rival baixou o preço. Afinal… como você lidaria com os problemas da economia? |
| 0:39 – 0:48 | Robôs     | No nosso mundo de teste, empresas-robô montaram sozinhas uma cadeia: do campo no Mato Grosso às lojas de São Paulo. Imagine com seus amigos. |
| 0:48 – 0:54 | Paixão    | E o melhor: o jogo não quer arrancar o seu dinheiro. É feito por vontade e paixão.                     |
| 0:54 – 0:59 | Mundo     | Começamos pelo Brasil. E queremos levar para o mundo inteiro.                                          |
| 0:59 – 1:07 | Chamada   | Entre no nosso Discord: novidades e acesso aos primeiros testes. Link no comentário fixado.             |

Se a voz ficar mais longa que a cena, ajuste a duração no começo do `<script>` da página (lista
`ROTEIRO`). Imagem, legenda e efeitos acompanham sozinhos, porque tudo é calculado a partir dos
blocos de legenda.

## O que aparece em cada cena

1. **Planeta.** O planeta pixelado gira e o zoom mergulha no Brasil.
2. **Brasil.** O mapa do Brasil se monta em pontos de pixel. Os pinos caem em Santa Bárbara d'Oeste,
   no Acre e em Xique-Xique, nas coordenadas reais, no momento em que cada nome é falado.
3. **História.** A região de Campinas tem sua fábrica (Piracicaba), a fazenda do seu amigo
   (Limeira) e sua loja (Campinas), com rotas e caminhões. A loja do concorrente (Hortolândia) entra,
   e o "VS" bate.
4. **Cadeia.** É um diagrama de jogadores A, B e C mais as famílias. A soja desce e vira óleo, o
   caminhão leva o óleo até a loja e o dinheiro sobe de volta pela faixa da direita.
5. **No jogo.** A tela real da cadeia em blocos.
6. **Problemas.** Três cartões batem: falta de soja, frete e preço do rival. Saem para o "?" e a
   pergunta.
7. **Robôs.** É um exemplo real do mundo de teste, marcado como tal na tela. União Agro (Sinop),
   Avenida Agro (Sorriso) e Terra Nova Agro (Rondonópolis) vendem soja para a Rota Norte Industrial
   (Rondonópolis), que vende óleo para a Planalto Comercial (São Paulo). Fecha com "E se fossem você
   e seus amigos?".
8. **Paixão.** Coração de pixel batendo e "Feito por paixão".
9. **Mundo.** O Brasil encolhe e vira o planeta, que se acende em vários pontos.
10. **Chamada.** Logotipo, "em desenvolvimento", balão de conversa, botão "Entrar no Discord" e
    "novidades + acesso aos primeiros testes".

## Som

A trilha é sintetizada na própria página, no estilo dos geradores de efeitos retrô como o
[ZzFX](https://github.com/KilledByAPixel/ZzFX). Não usa arquivos de som de terceiros. Cada som cai
no quadro exato do seu evento: pino caindo, carimbo, caminhão, moedas, coração e assim por diante.
Por baixo há uma base bem suave, um acorde grave por cena, com pulso nas cenas intensas.

A mixagem fica com média em torno de -21 dB e picos abaixo de -3 dB, com espaço para a narração.

Os números dos robôs vêm do mundo de teste de 04/11/2026 (`design-c`). Se o mundo mudar, os
nomes podem ser outros.
