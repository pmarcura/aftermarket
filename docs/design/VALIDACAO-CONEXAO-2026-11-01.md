# Conexão com a economia · 01/11/2026

O jogador via “Conectando à economia…” indefinidamente. A interface na porta
5186 respondia HTTP 200, mas `/api/health` da API 3016 estabelecia TCP e não
retornava bytes em 3–5 segundos. O servidor estava ativo, com gravações no WAL.
Cada consulta a `/api/world` chamava `store.tick()`, além do tick periódico;
o polling abria novas chamadas a cada três segundos, sem prazo limite.

Resultado: leitura HTTP separada do avanço acumulado. Nenhuma season foi
reiniciada. Backup SQLite consistente criado antes do reinício em
`.runtime/backups/pre-connection-fix-1793562619299.sqlite`.

- `/api/world` apresenta `store.read()`; o tick periódico continua simulando
  eventos e preparando rotas/acessos.
- O tick do store processa até 50 eventos por chamada, com orçamento de 25 ms
  verificado entre eventos. Um evento individual continua atômico e pode exceder
  esse orçamento. O relógio publicado conserva o progresso efetivo quando o
  lote é interrompido, mantendo os eventos restantes. Comandos conservam o avanço
  e as transações existentes.
- O cliente compartilha a tentativa pendente por empresa e limita fetch e leitura
  do corpo a 15 segundos. “Tentar novamente” cancela a tentativa pendente e inicia
  outra. Cancelamentos de chamadas substituídas e respostas de outra empresa não
  substituem o estado atual.

Validação: atualização em lotes produz o mesmo mundo da execução completa, exceto
revisão de publicação, com IDs determinísticos no teste. Compara integralmente
eventos, saldos, estoques, prazos e ledger. 276 testes em 36 arquivos, build,
catálogo de 14 telas/101 fontes e diff check aprovados. Teste de navegador com API
deliberadamente pendente confirma prazo limite, uma única chamada nos primeiros
12 segundos e reconexão pelo botão. Navegação em desktop e celular aprovada.

Após reiniciar, `/api/health` pelo proxy retornou HTTP 200 em 3,484 ms e depois
2,346 ms. A aba real do Chrome voltou a mostrar o mapa e os dados do mundo salvo.
Isso comprova recuperação da conexão, não uma meta geral de latência econômica.
Avanço de comandos, serialização e gravação continuam síncronos. A etapa C segue
aberta: se houver bloqueios em ações ou outro mundo atrasado, medir esses caminhos.
