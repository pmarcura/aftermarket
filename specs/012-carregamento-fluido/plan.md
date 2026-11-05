# Plano 012 · Carregamento e navegação fluidos

Pedido do Pedro em 03/11/2026: conferir alinhamento com o desempenho do João,
investigar travadas antes de começar a jogar e melhorar o carregamento mantendo o
novo Início do Claude. Não muda itens, receitas, saldos, estoques ou comandos.

1. Atualizar referências remotas e provar ancestralidade da spec 005 e do main.
2. Medir resposta HTTP, tamanho do mundo e custo de apresentação em cenário isolado;
   separar rede, servidor, JavaScript e modo de desenvolvimento.
3. Retirar avanço econômico das leituras HTTP; reutilizar respostas por revisão e
   empresa, comprimir fora da thread principal e limitar tentativas no cliente.
4. Agrupar leitura do pregão, evitar varreduras repetidas e preservar as contas.
5. Verificar conservação/regressões, carregamento e navegação no navegador;
   medir novamente e registrar limites e prioridades para a engenharia.

Critério de saída: main e spec 005 comprovados, prazo de erro e recuperação reais,
mesma apresentação e regras, menos trabalho repetido demonstrado, API da prévia
responsiva e evidência reproduzível. Sem migração nem reinício da season. Backup
consistente antes de reiniciar os processos da prévia. Um evento econômico atômico
ainda pode bloquear a API; isolamento do motor exige decisão de arquitetura e
evidência própria, sem prometer ganho de FPS a partir de tempo HTTP.

## Continuação · operações confiáveis (pedido de 03/11)

6. Extrair ledger para tabela incremental, mantendo mundo e recibo na mesma transação SQLite. Migração de armazenamento explícita, backup antes de escrever e leitor compatível para scripts. Não alterar retenção nem regras.
7. Evitar clonar payloads imutáveis do ledger no rollback; agrupar gravações de caches de rotas no flush de 5 s. Comandos continuam duráveis antes da confirmação.
8. Usar disponibilidade do motor na gaveta, apresentar quantidade cotada, bloquear clique simultâneo e preservar chave idempotente após falha de rede/recarga. Consultar operação pendente com a mesma chave.
9. Provar igualdade integral antes/depois da migração e reabertura numa cópia do mundo real; validar compra/entrega/produção e recuperação de resposta perdida; medir API durante rodadas reais.

Critério adicional: nenhum reset, perda de ledger, cobrança duplicada ou resposta de sucesso antes do commit; nova prévia deve usar uma API sem reinícios automáticos por edição de código.
