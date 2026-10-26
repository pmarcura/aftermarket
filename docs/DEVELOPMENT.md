# Game-GSD · Processo de desenvolvimento

Este projeto adapta a disciplina GSD para ciclos de jogo: cada fase precisa entregar uma decisão interessante ao jogador, regras econômicas consistentes e evidência de funcionamento.

## Ciclo de uma fase

| Etapa         | Pergunta que precisa ser respondida                           | Artefato                                 |
| ------------- | ------------------------------------------------------------- | ---------------------------------------- |
| Contexto      | Qual problema do jogador está sendo resolvido?                | `PROJECT.md`, requisitos da fase         |
| Pesquisa      | Já existe biblioteca, dado ou padrão adequado?                | `docs/research`, proveniência e licenças |
| Plano         | Qual é o menor fluxo completo que entrega o resultado?        | `NN-PLAN.md`                             |
| Implementação | A regra pertence à interface, simulação ou persistência?      | Código na camada responsável             |
| Integridade   | O que acontece com saldo, estoque, capacidade e concorrência? | Testes de invariantes                    |
| Playtest      | O jogador entende o custo, a consequência e a recuperação?    | Roteiro e evidências visuais             |
| Fechamento    | O critério de saída foi demonstrado? O que continua faltando? | `NN-VALIDATION.md`, estado, commit       |

## Fontes de verdade

O GDD original define a visão. `REQUIREMENTS.md` transforma a visão em itens rastreáveis. O plano da fase define o escopo atual. O código e os testes demonstram a entrega. `STATE.md` descreve a próxima ação; não deve inventar sucesso com base apenas em tarefas marcadas.

Decisões que divergem de screenshots ou simplificam o GDD ficam em `docs/product/DECISIONS.md`. Documentação histórica permanece no Git. Não conservar cópias concorrentes de uma implementação em outras pastas.

## Definição de pronto

- O fluxo executa uma consequência real e verificável.
- Valores e unidades são consistentes entre compra, transporte, produção e balanço.
- Há estados de vazio, carregamento, incompatibilidade, confirmação, sucesso e erro aplicáveis ao fluxo.
- As mensagens oferecem um próximo passo recuperável.
- Concorrência e repetição não duplicam propriedade, estoque ou cobrança.
- O tempo offline mantém o mesmo resultado das mesmas operações online.
- A camada visual respeita as referências e funciona com teclado e em largura reduzida.
- Build, testes necessários e formatação passam; limitações materiais são registradas.

## Git e limpeza

Trabalhar na implementação canônica. Antes de refatorar, verificar consumidores e mover o código; não deixar o original órfão. Usar commits como checkpoints. Branches de funcionalidade podem ser criadas a partir de `main`; não há necessidade de outra cópia do projeto.

Dependências e compilação podem ser recriadas com `npm ci` e `npm run build`. O banco não é recriável sem perda do progresso: usar `npm run world:backup`. As imagens de referência ficam em um único diretório, com hash no manifesto.

## Validar manualmente uma mudança de jogo

Usar duas contas locais para testar titularidade e mercado. Comparar o estado antes e depois de cada transação. Interromper o navegador durante uma remessa e durante uma produção; retornar e conferir inventário e histórico. Tentar saldo insuficiente, material insuficiente, carga acima da capacidade, unidade de outro dono e repetição do pedido.

Quando uma funcionalidade depender de infraestrutura futura, o requisito permanece parcial ou planejado. Uma tela navegável não comprova um sistema MMO completo.
