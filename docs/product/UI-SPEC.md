# Interface de referência

As dez telas numeradas são a referência primária dos painéis. `01_mapa_principal.png` e `mapa-conceito-original.png` orientam o mapa. Os dois painéis de conceitos são contexto secundário quando houver divergência.

## Tokens

| Elemento                           | Valor                          |
| ---------------------------------- | ------------------------------ |
| Base                               | `#0d181e`                      |
| Navegação                          | `#101e25`                      |
| Painel                             | `#192a32`                      |
| Divisórias                         | `#304650`                      |
| Ação principal                     | `#d9b16b`                      |
| Resultado favorável                | `#62c89e`                      |
| Informação geográfica              | `#72b2d1`                      |
| Resultado desfavorável             | `#ef867a`                      |
| Tipografia                         | Inter variável, auto-hospedada |
| Barra superior / navegação desktop | 74 px / 212 px                 |

Interface alinhada à esquerda, tabelas para comparação e números alinhados à direita. Tipografia tabular em valores. Ações douradas confirmam ou avançam decisões relevantes; ações secundárias usam azul-escuro com contorno.

## Mapa

Cartografia clara com rios, ruas e rodovias; áreas discretas por atividade; ícones independentes do zoom; seleção azul sem alterar categoria. Créditos permanecem visíveis. Câmara e navegação preservam contexto, e o jogador pode recolher o menu e fechar detalhes.

## Estados e interação

Confirmações financeiras mostram valor e consequência. Estoque indisponível, saldo insuficiente e capacidade incompatível são recuperáveis. Vazio indica próximo passo. Modais usam `dialog`, foco nativo, Escape e retorno ao controle anterior. Alertas usam regiões de status. Animações decorativas não são necessárias.

No celular, a navegação vai para a borda inferior e tabelas podem rolar dentro do próprio painel. Não deve haver rolagem lateral global. Informações de mapa e painéis continuam acessíveis por toque e teclado.
