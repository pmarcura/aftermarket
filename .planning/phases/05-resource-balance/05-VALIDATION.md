# Validação · Base de recursos e padrão matemático

27/10/2026, America/Sao_Paulo. Escopo: levantar o catálogo existente, verificar obtenção/produção/venda e criar regras reproduzíveis para balancear/admitir conteúdo. A calibração numérica e a sustentabilidade da fase 05 permanecem pendentes.

## Entregue

- `RESOURCE-CATALOG.md`: abertura gerada do código; dez itens, nove receitas, fornecedores/localização/unidades/quantidades/preços, massa/volume, canais, custos e limites.
- `RESOURCE-STANDARD.md`: fontes de verdade, recursos operacionais, fronteira física, sementes, custos/capacidade, matriz de fluxos, diagnósticos e experimentos ordenados.
- `RESOURCE-TEMPLATE.md`: ficha obrigatória de admissão; referências no AGENTS, processo, README, requisitos e continuidade.
- `resource-audit.ts` e CLI: alcance produtivo/consumo final, quantidades/referências, perfil/bot, fronteira de massa, custos comparáveis, pressão dos coprodutos e relatório por item. `resources:check` integra o check e exige catálogo sincronizado.
- `channels.ts`: listas existentes de cinco canais familiares e sete programas públicos passam a uma fonte compartilhada; mesmos itens, quantidades, qualidade e ordem. Nenhum parâmetro econômico alterado.

## Evidências

| Verificação                | Resultado                                                                                                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`            | TypeScript/Vite, 135 testes em dez arquivos e auditoria estrutural aprovados                                                                                               |
| Testes novos               | 42: 12 verificações de auditoria, nove fluxos de produção/venda, nove falhas por entrada/reserva, cinco consumos familiares e sete programas públicos                      |
| Nove receitas / dez saídas | Comandos `produce`, `publishOffer`, `trade`, cotação e chegada: reserva/consumo de entradas, entrega única, alocação total do custo, frete positivo e dinheiro conservado  |
| Consumo final              | Famílias pagam/retiram estoque; cada programa é disputado/adjudicado, pago, transportado e consumido uma vez                                                               |
| Falhas                     | Ausência de entrada/reserva sem mutação; auditoria rejeita ID/produto/perfil/preço/quantidade/fronteira inválidos, ausência de bot/semente/destino e consumo não executado |
| Semente em job             | Auditoria considera saída comprometida como alcance futuro sem disponibilizar mercadoria antecipadamente                                                                   |
| Abertura e mundo salvo     | Dez itens/nove receitas, zero erros estruturais e 29 alertas; `balanced=false` explícito                                                                                   |
| Catálogo sincronizado      | Conteúdo formatado gerado coincide com o arquivo versionado; divergência retorna `STALE_CATALOG`                                                                           |

As simulações de teste são isoladas e usam geografia estimada, sem serviço externo de rotas. Testes de produção usam entradas inaugurais e mercado controlado para provar execução, não viabilidade de abertura. Testes públicos usam estoque/edital controlados com quantidades/qualidades dos programas e os comandos comuns. Nenhum teste abre o banco principal.

Primeira execução Vitest encontrou `EPERM` no cache de compilação da pasta temporária do sandbox, antes de carregar testes. A execução com `TEMP`/`TMP` em `.runtime/test-temp` passou. Não houve alteração nas regras para contornar teste. Compilação mantém os avisos conhecidos de bundles MapLibre/ECharts grandes; Node sinaliza SQLite experimental.

Durante a checagem final surgiram alterações concorrentes em `apps/web/src/devlab`, `vite.config.ts` e scripts de laboratório de UI. Foram preservadas. `npm run format:check` global apontou cinco arquivos dessa outra frente (`screens.ts`, `ui-evidence.ts`, `capture-lab.ts`, `lab-artifacts.ts`, `ui-catalog.ts`); não foram formatados por esta entrega. A formatação dos arquivos de recursos/continuidade é verificada separadamente. O check completo registrado acima passou antes dessas alterações concorrentes.

Última conferência: formatação dos 20 arquivos desta frente aprovada; `resources:check` aprovado com `catalogCurrent=true`; modo `--strict` retornou 1 pelos 29 alertas, como esperado. TypeScript global apontou `TS2339` em `scripts/ui-catalog.ts:70` da frente concorrente (`name` em `ObjectLiteralElementLike`/`SpreadAssignment`); nenhum erro foi apontado nos arquivos de recursos. `git diff --check` sem erros. Não corrigir a frente concorrente sobrescrevendo trabalho em andamento.

Não há mudança de interface; navegador desktop/celular/teclado não foi reexecutado nesta frente. Os testes existentes de domínio/roteamento/persistência passaram. Não foi repetida a simulação de 90 dias: esta entrega mede configuração e execução das cadeias, não recalibra demanda/custos nem valida equilíbrio.

## Leitura do mundo existente

`.runtime/resources/saved-world.json` e `.md`: revisão 5.132, estado salvo em 27/10/2026 06:48:51 UTC (03:48:51 em São Paulo). Consulta `SELECT state FROM worlds WHERE id=1` por `DatabaseSync` com `readOnly: true`; conexão fechada após leitura. Sem store, migração, tick, comando, reset, criação de conta ou alteração de preço/estoque/saldo. Os relatórios guardam instante, season, revisão e hashes de configuração/catálogo.

Farelo: 215.060 kg físicos, 214.955 kg anunciados e 905 kg de vendas de atacado registradas. Estoque/vendas não demonstram consumo produtivo. O excedente teórico de 56,14% deriva de óleo/farelo/leite e proporção familiar; programas públicos/estoque/origens alternativas não entram nessa hipótese.

## Diagnósticos e próxima ação

1. Balancear óleo/farelo/leite conjuntamente: registrar fluxo líquido, absorção familiar/pública, estoque e margem por item antes de propor novas receitas.
2. Testar a menor operação de cada especialidade com custo posto/fixos. Cinco receitas são negativas na hipótese de uma linha/SP/lotes unitários automáticos; isso não é conclusão sobre qualquer escala existente.
3. Definir recuperação finita de sementes e vínculo da reserva ao mineral. Cultivo/beneficiamento e resíduos continuam agregados.
4. Congelar/versionar também unidade/massa/volume/canais antes de ampliar esquema em seasons salvas; qualidade de misturas de unidades exige pesos definidos.
5. Instrumentar rupturas intradiárias e repetir 30/90 dias por cenário/semente quando houver mudança de parâmetros. Metas de margem/concentração/estoque precisam ser declaradas por experimento.

Estrutura válida demonstra cobertura e execução em condições controladas. Não demonstra absorção de toda produção, ausência geral de arbitragem, concorrência por cidade ou equilíbrio sustentável. O modo `--strict` deve reprovar os 29 alertas atuais, tornando explícito que não há aprovação de expansão automática.

## Complemento · Relatório das mecânicas e fluxos

Pedido adicional do usuário: origem/valor das sementes, óleo/farelo/leite, números das mecânicas e fluxos incompletos. Entregue `docs/product/MECHANICS-REPORT.md`, regenerado por `npm run mechanics:report -- --world=.runtime/world.sqlite --write-doc`. As 14 seções cobrem unidades, estoque inaugural, receitas/custeio/capacidade, tempo/CAPEX, salários/utilidades/qualidade, demanda, reposição, logística, governo, finanças, bots e observação.

Anexos em `.runtime/mechanics/saved-world`: JSON com configuração, hashes, estoques/custos e fontes por lacuna; CSV com **1.443 ocorrências numéricas literais em 21 arquivos**. São ocorrências, não 1.443 parâmetros econômicos independentes. Abertura isolada fica em `.runtime/mechanics/opening`, sem sobrescrever o snapshot salvo.

Leitura: revisão **7.509**, estado de **27/10/2026 às 06:36:34, America/Sao_Paulo**. Foram identificados **36 fluxos/limites** e **quatro diferenças** entre config salva e template: três campos legados de infraestrutura sem consumidor atual e `playableLaborShare` 4% na season contra 10% no template, sem pool laboral executado. Parâmetros inativos são identificados no relatório, sem convertê-los em regras fictícias.

O custo explicativo de óleo/farelo foi obtido pelo comando `produce` em cópia da abertura; soma das alocações igual ao custo do job. Banco principal usa o helper compartilhado `readSavedWorld`, com `readOnly: true` e SELECT; não usa store, migração ou avanço. Hash do snapshot em memória permanece igual antes/depois. Nenhum parâmetro econômico foi alterado.

Verificações do complemento: geração em modo abertura e mundo salvo aprovada; TypeScript sem erros; **42 testes de recursos aprovados novamente**; `resources:check` aprovado, catálogo atualizado e 29 alertas conhecidos. Sem nova UI, sem navegador ou nova simulação de 90 dias. A API TypeScript 7 instalada foi usada para extrair a AST, sem nova dependência. Artefatos de contexto/triagem do novo laboratório não existiam ao iniciar a coleta; a documentação da bancada foi consultada e a coleta pesada não era necessária para este relatório.

Os arquivos de contexto/triagem apareceram durante a conclusão, com `generatedAt=2026-10-27T11:24:20.441Z`, e foram consultados. Contêm evidência da outra frente e alertas econômicos heurísticos, sem substituir os coeficientes ou a observação do mundo salvo deste relatório. Conferência dos anexos: documento versionado igual ao Markdown exportado; origens inaugurais somam o total de cada item; 1.443 valores extraídos finitos/com linha válida; soma dos custos dos coprodutos conserva o lote. Formatação dos arquivos desta entrega, TypeScript e `git diff --check` aprovados.

## Complemento · Auditoria matemática retomada

27/10/2026, America/Sao_Paulo. Retomado `scripts/audit-mathematics.ts`, que estava interrompido sem emissão de relatório e com imports sem uso quebrando o TypeScript. Entregues `docs/product/MATHEMATICS-AUDIT.md`, comando `npm run mathematics:audit -- --write-doc` e anexos `.runtime/mathematics/audit.json`/`.md`. CAT-05 rastreia esta entrega; ECO-11 e a fase 05 continuam parciais.

Sete provas confirmadas: M01, limite de quatro receitas agrícolas que não cobrem a folha mínima em SP aos preços inaugurais, mesmo ignorando insumos/utilidades/manutenção/frete/CAPEX; M02, recuperação do leite usa produtividade impossível; M03, projeção de 48 ciclos/dia versus 30 executados na automação de aço com duas linhas/lotes de cinco; M04, arredondamento por loja destrói frações da demanda; M05, ordem fixa de serviço prioriza óleo e pode deixar leite sem atendimento; M06, proporção de coprodutos incompatível com demanda apenas familiar; M07, alvo global de óleo aplicado individualmente a cada produtor. M02/M03/M04 são erros de fórmula, M01/M06 são calibração e M05/M07 são políticas implícitas. O auditor demonstra presença dos problemas atuais; não integra um gate que trate sua manutenção como comportamento desejado.

M02 reproduz +R$ 4.508,72/dia na projeção contra −R$ 626,58 respeitando duração nas mesmas premissas. M03 mede ciclos iniciados entre os dias 1 e 2, em regime e sem gargalos de caixa/entrada/armazenagem/orçamento. M04 compara uma/duas lojas em mundos separados e calendário controlado unitário. Cinco fixtures conservam dinheiro inteiro/não negativo. Controle adicional conserva o custo de R$ 2.183,00 do job entre óleo/farelo, não duplica saída ao repetir conclusão e rejeita falta de insumo sem mutação. Divergência menor de quatro centavos/dia entre custo fixo projetado e cobrado fica registrada, sem classificá-la como perda de dinheiro.

Evidência do laboratório: contexto/triagem e baseline A:0 de 90 dias coincidem com o fingerprint atual `52a839803fa761e109ad20fa341ecba118aab9d5b301422136c3db5749309a0a`. Dinheiro e fluxos físicos conservados; obrigações finais de R$ 3.226.858,34 e HHI agregado 7.752,48 continuam indicando investigação. Farelo fecha `3.000 + 182.400 − 550 = 184.850 kg`. Os 550 kg de consumo produtivo equivalem a 0,3015% da produção acumulada, mas não há rastreamento para atribuir origem inaugural/nova. Marcos reais dos dias 30/60/90 são extraídos da série; números do estudo A/B também são extraídos dos anexos, sem literais que ficariam falsos após sua atualização. O estudo de velocidade 0,75 continua rejeitado: A e B terminam com 184.850 kg de farelo. Não houve nova simulação de 90 dias, pois a fonte do motor permaneceu igual à referência atual.

O navegador consultou `http://127.0.0.1:5173/lab`, aba Método → Investigação registrada, confirmando os mesmos números/rejeição. Foi iniciada somente a apresentação Vite, sem API nem store; a primeira tentativa isolada não permitia leitura pela rede local e a consulta funcionou após iniciar a apresentação fora desse isolamento. Nenhuma mudança de interface; desktop/celular/teclado não foram reexecutados como certificação de UX.

Verificação final: `npm run check` aprovado — TypeScript/Vite, **160 testes em 16 arquivos**, `resources:check` com catálogo atual/zero erros/29 alertas conhecidos e `lab:catalog:check` com dez telas. Auditor repetido após revisão de precisão: sete achados confirmados, cinco controles monetários e referência atual. TypeScript, formatação dos arquivos desta entrega e `git diff --check` aprovados. Avisos existentes de bundles grandes, configuração futura do Vite e SQLite experimental permanecem sem impacto na conclusão. Nenhuma dependência adicionada, parâmetro do motor alterado ou acesso ao banco salvo.

Próxima ação concreta: compartilhar cadência exata para capacidade/recuperação/reposição/preço, conservar frações de demanda e explicitar o rateio varejista; depois comparar custo/produtividade agrícola, alvos por participação e óleo/farelo/leite em mundos isolados. Critérios de experimento no relatório são propostas, não aprovação automática nem autorização para recalibrar retroativamente a season salva.
