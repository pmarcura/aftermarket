# Validação · Laboratório de desenvolvimento

## Continuação concluída · evidência atual

27/10/2026. A continuação fecha as cinco frentes autorizadas: causas observadas dos bots, contratos/execução de ações de interface, referência visual/funcional, experimentos ampliados e ciclo real de investigação.

- Trace opcional por `World`, fontes diretor/produção/reposição/comando, resultados executado/recusado/bloqueado/idle, produto somente quando observado. O executor normal continua único. Observadores não são serializados e são removidos em `finally`. Os testes com/sem trace preservam o mesmo estado/IDs/ordem; gates de candidatos não são apresentados como inação total do bot.
- Runner `schemaVersion=2` com grupos diários, contadores, motivos e parâmetros de reprodução. Custos/velocidade/frete/política, variação inaugural com dinheiro conservado e choques em dia definido. Abertura/futuras ordens são separadas dos termos já contratados. Nenhum banco, migração ou chamada econômica externa.
- Consulta CLI/UI por empresa/produto/dia/fonte/resultado, com limites explícitos de grupos e séries. Exemplo real: Horizonte Industrial, dia 30, 726 tentativas, 724 execuções, duas recusas e 1.693 gates bloqueados observados; esses gates incluem avaliação de candidatos, não 1.693 dias parados. Consulta no relatório existente levou 14,4 ms sem a leitura inicial.
- 29 contratos e 58 execuções de fluxo desktop/celular, incluindo negociação entre duas contas, edital, três caminhões, instalação, atrasados/recuperação e venda de veículo. Efeitos financeiros/físicos são comparados antes/depois em memória pelos comandos normais. A coleta final registra 210 estados; a comparação mantém a referência anterior e identifica estados sem par. Isso não certifica todas as combinações ou compreensão humana.
- Comparador estrutural/visual/funcional, PNG RGB/RGBA 8-bit sem dependências novas, limiar explícito e atalhos para imagens idênticas. Nenhuma referência é substituída sem `--accept-baseline`. Parte da referência inicial continha metadados de carregamento: essas diferenças do harness são expostas para revisão, não classificadas automaticamente como regressões do produto.
- `npm run lab` reúne apresentação e coleta automática; refresh inclui fluxos/comparação. Contexto e triagem permanecem em `.runtime`, com evidência por ação e consulta sem reler código.

### Medição de mundos novos e consultas

| Horizonte | Motor, sem cache | Motor + gravação | Consulta com leitura/parse | Grupos de trace | Eventos observados |
| --------- | ---------------: | ---------------: | -------------------------: | --------------: | -----------------: |
| 30 dias   |          2,710 s |          2,739 s |                    20,9 ms |           6.448 |             68.670 |
| 90 dias   |         10,291 s |         10,326 s |                    47,2 ms |          17.923 |            198.344 |
| 365 dias  |         84,397 s |         84,709 s |                   211,3 ms |          75.812 |            826.732 |

Uma amostra por horizonte; sem p95 representativo. Processo pode estar aquecido. Em todos os dias, dinheiro e a equação física por produto (abertura + produção − entradas reservadas − consumo familiar/público = estoque + trânsito) fecharam. Evidência e fingerprint em `.runtime/lab/benchmark.json`. Um ano novo ainda exige mais de um minuto; a consulta do ano coletado é subsegundo.

### Experimentos reais e decisão

Óleo/farelo/leite: intervenção única reduz velocidade de `soy-oil` para 0,75. Critérios definidos antes da execução: farelo final cair 20%, preservar 95% do consumo de leite/óleo, não elevar obrigações mais de 5% e conservar dinheiro/materiais. Resultado: farelo ficou **184.850 kg em A e B**; leite 5.185 unidades em ambos; óleo 4.597/4.598; obrigações R$ 3.226.858,34/R$ 3.227.078,53. Hipótese rejeitada; nenhum rebalanceamento foi aplicado à season salva.

UX: a referência mostrava confirmação habilitada e saldo negativo na compra de caminhão sem caixa. A revisão usa caixa livre, explica o valor faltante, desabilita a confirmação inviável e oferece revisar compromissos. Ambos os viewports comprovaram ausência de comando no bloqueio e compra normal com débito/frota corretos quando viável. Referência anterior preservada. O relatório `.runtime/lab/studies/oil-meal-milk-and-carrier.json` contém hipótese, critérios, resultado, decisão e links de reprodução; a aba Método exibe a investigação e oferece diário persistente/exportável.

### Verificação atual

Após revisar as capturas corrigidas de caminhão em desktop/celular e as 58 execuções, a referência atual foi aceita explicitamente. A referência anterior continua em `baseline/versions`; a comparação antes/depois foi preservada em `.runtime/lab/studies/carrier-before-after-comparison.json`, com os caminhos das imagens da nova versão imutável. A atualização seguinte comparou **210/210 estados, sem diferenças nem estados sem par**, reutilizou todos os resultados sem iniciar navegador e terminou em **3,345 s** (simulações em cache: 101,3 ms). A aceitação não representa certificação de estética ou compreensão humana.

`npm test`: **160 testes em 16 arquivos passaram**. `npm run test:lab`: **cinco fluxos passaram**, incluindo parâmetros/choque/consulta/diário e apresentação de diferenças. Coleta de ações: **58/58 passaram**, sem erro/overflow/controles sem nome pela heurística. Catálogo/PNG têm testes específicos; auditoria de recursos segue válida com os 29 alertas econômicos conhecidos. Build do cliente/worker passou.

`scripts/report-mechanics.ts` teve a incompatibilidade anterior resolvida. A checagem global desta continuação encontrou dez imports/variáveis sem uso em **`scripts/audit-mathematics.ts`**, ainda com marcador `AUDIT_MORE` e em edição por outra frente; esse arquivo foi preservado. TypeScript de todo o restante passou com `.runtime/lab/tsconfig.validation.json` (estende a configuração original e exclui apenas esse arquivo). Próxima ação da frente paralela: concluir o auditor e repetir `npm run check`. Esse isolamento não é apresentado como aprovação do check global.

## Registro da primeira entrega · histórico

Os números e limites abaixo registram o checkpoint anterior e são supersedidos pela continuação acima.

27/10/2026, America/Sao_Paulo. Frente local de apoio à fase 07; não conclui alpha pública ou balanceamento da season.

## Resultado entregue

`/lab` reúne experimentos A/B, evolução diária, itens, bots, ações registradas, alertas, gráficos, JSON e catálogo de interfaces. O runner é compartilhado por Web Worker e terminal, sem importar API/store, consultar rede externa ou abrir o banco do jogador. Execuções podem ser canceladas e reiniciadas. O CLI também gera CSV.

O catálogo AST acompanha imports/reexports de **dez views e 47 arquivos**, com textos/componentes/linhas e comandos pertencentes ao contrato real de `model.ts`. O teste de reexports impede apresentar um wrapper como se fosse a implementação completa. O catálogo estático não comprova execução dos ramos condicionais.

O Playwright coletou **76 estados**: páginas, abas, modais declarados e carregamento/conexão indisponível. Desktop 1440×1000 e celular 390×844; **zero erros de página/console, zero overflow e zero controles sem nome pela heurística da coleta**. Evidência em `.runtime/lab/ui/index.json`, resumo em `summary.json` e capturas ao lado. Fonte dos mapas é controlada com tiles vazios, sem validar cartografia/ruas reais. Histórico de produto é respondido pela fixture em memória.

## Desempenho medido

Node 25.5, mesmo checkout e motor/configuração. Primeira execução, seed 0, 90 dias:

| Cenário    | Tempo do runner | Entregas | Jobs concluídos | Obrigações em aberto |
| ---------- | --------------: | -------: | --------------: | -------------------: |
| baseline   |        11,634 s |    1.930 |           1.362 |      R$ 3.226.858,34 |
| low-demand |         9,713 s |    1.370 |           1.052 |      R$ 3.255.950,92 |

Baseline tem 1.935 remessas totais, incluindo cinco ainda não entregues. O dinheiro foi conservado em ambos. Remessas, jobs, atrasados e HHI do baseline preservam o checkpoint econômico conhecido. A redução de custo vem de agregação por tick e índice de leitura temporário, sem saltar ticks ou alterar preços/receitas/regras.

`npm run lab:refresh` com conteúdo/configuração idênticos concluiu em **4,045 s**: dez telas reutilizadas, nenhum navegador iniciado e duas simulações reutilizadas em **22,842 ms**. O tempo original de cada simulação continua registrado; cache não é apresentado como nova execução do motor. A coleta inicial de todas as imagens leva mais tempo. Não foi medido um horizonte de 365 dias nesta entrega.

Relatórios completos em `.runtime/lab/simulations/<hash>.json`; comparação em `latest.json`/`comparison.csv`. A atualização e sua duração estão em `.runtime/lab/refresh-final.log`. Contexto e triagem final em `.runtime/lab/context.json` e `review.json`.

## Verificações

- `npm test`: **143 testes passaram em 12 arquivos**. Inclui invariantes, determinismo, isolamento, cancelamento/progresso, equivalência de 30 dias com/sem índice e equivalência de histórico de mercado. Após filtrar os comandos pelo contrato, `tests/ui-catalog.test.ts` passou novamente.
- `npm run test:lab`: **três fluxos passaram** na versão final: lote A/B real/exportação/conservação/ausência de chamadas ao mundo salvo; cancelamento e nova execução; catálogo sem evidência, busca/teclado e celular. Capturas em `test-results/lab-*/`.
- `npx vite build`: passou; worker compilado em arquivo separado. Permanecem os avisos conhecidos de tamanho de MapLibre/ECharts e aviso de extensão de import da configuração Vite.
- `npm run resources:check`: estrutura e catálogo atuais; 29 alertas econômicos conhecidos preservados, sem declaração de equilíbrio.
- `npm run lab:catalog:check`: passou. Hashes incluem fontes das telas e fixture/motor; resultados antigos são identificados. Atualização incremental completa demonstrada.
- `npm run lab:refresh`: terminou com código 0 e contexto atualizado, após a fixture de histórico ser completada.

## Verificação global e trabalho paralelo

`npm run check` encontrou erros de TypeScript no arquivo **`scripts/report-mechanics.ts`**, criado/em edição em outra frente durante esta validação. A última checagem global apontou somente uso da API antiga `typescript` nesse arquivo (`createSourceFile`, `ScriptTarget`, `Node`, predicados e `forEachChild`), incompatível com TypeScript 7. O laboratório usa a API instalada em `typescript/unstable` e compilou sem diagnósticos próprios. O arquivo paralelo foi preservado; o build do cliente, os testes e as auditorias foram executados separadamente. Próxima ação concreta: adaptar o gerador de mecânicas na frente responsável e repetir `npm run check`.

## Limites e próxima investigação

Sementes rotacionam três estratégias; não são Monte Carlo de comportamento humano. Ações registradas são comandos bem-sucedidos do diretor, sem auditoria completa de rejeições/automação. Rupturas são observadas no fim do dia. HHI e atendimento têm janelas/retensões documentadas no relatório. O índice temporário exige lançamentos append-only durante o runner; limpeza em `finally` e equivalência são testadas. Ele não é habilitado no mundo salvo.

Capturas e heurísticas não certificam acessibilidade integral, estética ou compreensão humana. O método organiza observação, hipótese, experimento e decisão; não aplica refinamentos ou rebalanceamentos automaticamente. Próximo uso: investigar óleo/farelo/leite e menor operação viável com pares de cenários, relacionando ruptura/margem às tarefas das telas correspondentes. Preservar playtest humano iniciante e a configuração da season salva.
