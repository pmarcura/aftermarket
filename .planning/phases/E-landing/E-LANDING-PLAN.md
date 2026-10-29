# E · Landing page de apresentação

Pedido de 28/10/2026: reproduzir a primeira referência. Pedro confirmou a composição
inteira, incluindo celular e tablet sobre o fundo verde; o conteúdo será AFTERMARKET.

## Resultado observável

Abrir `/` sem depender da API, reconhecer a composição de referência, conhecer o jogo
e usar **Entrar no jogo** para acessar a implementação existente em `/jogar`.
`/landing` é um alias; `/lab` continua sendo o laboratório.

## Contrato visual

- Carvão `#161716`, verde-lima `#b0ff80`, branco `#ededeb`, cartões `#282927`, grade `#30312c`.
- Press Start 2P local nos grandes títulos e nas chamadas dos dispositivos; Geist
  Pixel Square nos títulos auxiliares; monospace nos textos das miniaturas e Archivo
  na leitura. A fonte adicional resolve a diferença de espessura da referência,
  sem biblioteca nova nem consulta externa em execução.
- Composição proporcional à referência de 736 × 886: horizonte escuro até y=323,
  planeta grande ao centro, celular em x=21/y=249, tablet em x=224/y=363.
- Dispositivos feitos de HTML/CSS e conteúdo selecionável; nenhum screenshot de UI
  como fundo. Globo gerado como imagem independente a partir da referência.
- A composição é preservada no celular; explicações e ações de tamanho normal ficam
  fora das miniaturas para que a página continue utilizável.

```text
┌────────────────── navegação fina ──────────────────┐
│               planeta pixel art                    │
│  ╭─ celular ─╮                                     │
├──│           │────── horizonte verde-lima ──────────┤
│  │           │    ╭──────── tablet ─────────────╮  │
│  ╰───────────╯    │ AFTERMARKET //              │  │
│    cartões        │ planeta + cartões + entrar │  │
│    contínuos      ╰────────────────────────────╯  │
└────────────────────────────────────────────────────┘
          como jogar · dúvidas · entrar
```

## Escopo e invariantes

Somente apresentação e entrada de rota. Não alterar economia, saldo, estoque,
temporada, identidade ou banco. Não prometer autenticação pública ou números ao vivo.
Preservar alterações já em andamento. Atualizar entradas de testes e coletores que
antes usavam `/` para abrir o jogo.

## Critério de saída

Build e formatação; capturas em 1440, 736 e 390 px; sem rolagem lateral; fonte e arte
locais carregadas; CTA acionável por teclado; landing sem chamada de mundo; destino
do CTA carrega o jogo e sua API; conteúdo expansível e âncoras funcionam.
Registrar evidência e limitações na validação, requisitos e estado.
