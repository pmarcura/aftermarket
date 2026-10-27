# Frente 07 · Laboratório de desenvolvimento

## Resultado observável

O desenvolvedor e o agente conseguem consultar o estado das dez interfaces, seus controles e evidências, executar temporadas aceleradas e comparar duas hipóteses sem reler toda a implementação nem tocar no mundo salvo. Prioridade: reduzir o tempo até entender e reproduzir um problema.

## Fontes de verdade

Motor e cenários em `packages/simulation`; configuração copiada para cada mundo novo; `App.tsx` define as views; registro de tarefas em `devlab/screens.ts`; catálogo AST gerado do código; DOM/capturas demonstram somente o estado e a fixture registrados. Pesquisa em `docs/research/SIMULATION-LAB.md`. Alterações de recursos em andamento são preservadas.

## Entrega

1. Runner headless determinístico compartilhado por CLI e Web Worker, snapshots diários, métricas por item/empresa, ações observadas, alertas heurísticos e benchmark medido. Comparações A/B pareadas por semente e mesma data.
2. Bancada `/lab` independente do provider do mundo, execução cancelável, gráficos, tabelas, exportações e catálogo pesquisável.
3. Catálogo gerado de componentes, textos, campos e comandos candidatos; divergência de registro reprova geração. Evidência Playwright desktop/celular/teclado, abas e modais declarados, carregamento e conexão indisponível.
4. Invalidação por conteúdo, resumo compacto e comando de atualização/observação automática. Agentes interpretam evidências e decisões ambíguas; scripts fazem a coleta repetitiva.
5. Processo de design: observar tarefa/impedimento → hipótese → experimento → decisão com evidência. Não produzir uma nota fictícia de usabilidade nem aplicar rebalanceamento automaticamente.

## Invariantes

Sem banco, migração, rede externa, comandos financeiros no mundo do jogador ou novas dependências. Mesmo motor/comandos e ticks econômicos completos. Centavos inteiros, dinheiro conservado e inventário válido. Rotas do runner são estimativas declaradas. O laboratório não treina uma IA nova nem prova qualidade da experiência humana. Sementes atuais variam a distribuição de três estratégias, não representam amostragem aleatória ampla.

## Saída

Build/testes de domínio e fluxos essenciais do laboratório; capturas do catálogo; relatório 90 dias com duração real; A/B reproduzível; consulta compacta por tela; atualização incremental demonstrada. Documentar falhas encontradas e limites, sem declarar a fase de alpha ou equilíbrio da season concluídos.

## Continuação autorizada · fechar o ambiente completo

1. Instrumentar tentativas, rejeições e gates reais de diretor, produção e reposição com observador efêmero; provar equivalência econômica com observação ligada/desligada. Agregar eventos por dia/empresa/código e disponibilizar consulta por bot/item/dia.
2. Associar ação de UI a campos/pré-condições, comando, efeito e estados; executar fluxos mutáveis pelos comandos normais em fixture sem banco. Cobertura exercitada e pendente devem ser explícitas por ação.
3. Manter referência aprovada separada em `.runtime`, comparação estrutural/visual e aceitação explícita. Demonstrar detecção de alteração sem substituir a referência silenciosamente.
4. Experimentos de abertura: custos operacionais, velocidade dos ciclos, componentes do frete e política dos bots; condições iniciais determinísticas além da rotação de estratégias. Choques de demanda/custo/frete em dia declarado. Relatos de 30/90/365 dias com desempenho real e cache identificado.
5. Demonstrar uma investigação econômica (óleo/farelo/leite) e um refinamento de interface com observação, hipótese, resultado esperado, comparação e decisão registrada. Não recalibrar o mundo salvo nem afirmar causalidade fora do experimento.

Critério: consultas compactas devem responder sobre tela/ação/bot/produto/dia com estado observado, motivos disponíveis, evidência e reprodução; a coleta deve detectar regressões e manter a referência até aceitação explícita. Verificação integrada, ausência de mutação no mundo principal e limitações atualizadas encerram a entrega.
