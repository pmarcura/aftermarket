# Auditoria matemática · capacidade, demanda e sustentabilidade

Gerado por `npm run mathematics:audit -- --write-doc`. Números simulados; dinheiro em centavos no JSON e reais neste documento. Cenários fixos de auditoria em 2026-10-30T12:00:00.000Z; geração em 2026-10-28T00:11:55.245Z. A fase 05 permanece parcial, sem aprovação de equilíbrio.

## Escopo e validade

Aberturas isoladas e leitura dos artefatos de /lab. Sem SQLite, store, API ou tick do jogador. Não altera o motor nem a season salva; fixtures isoladas controlam calendário, equipe, estoque e instalações.

Fonte do motor: `db891bb0368cf419ae5ae279a1fdcbe842ca4972ef62ff9ed15424c1dc957669`. Auditor: `c4f9f409aff5c67286c6b3d069d78a1ca4b1a45b0e02f8b44b899f6c63a2dea1`. As fontes abaixo apontam para a versão auditada; conferir os hashes ao repetir. Executar o auditor reproduz os casos e atualiza somente os anexos. `--write-doc` também regenera este documento. Uma prova que deixe de reproduzir retorna erro; isso exige revisar o achado e não significa que corrigir o bug deva ser revertido. Não integra o gate de equilíbrio do jogo.

Laboratório: baseline de 90 dias ausente ou desatualizado; não usar seus números como evidência atual. A consulta reutiliza os artefatos de /lab; não substitui o A/B nem sua referência. Concentração/atrasados são observações, não diagnóstico causal de cada bot. Gates de candidatos não provam inação total. Séries são diárias e podem perder rupturas intradiárias; atendimento tem a janela de retenção registrada no JSON.

## Achados priorizados

| ID  | Prioridade | Natureza           | Achado                                                                                             | Estado                          |
| --- | ---------- | ------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------- |
| M01 | P1         | Calibração         | Quatro fazendas não cobrem nem a folha mínima aos preços de abertura, em qualquer número de linhas | Aberto, reproduzido             |
| M02 | P1         | Erro de fórmula    | O bot aprova recuperação de leite usando produtividade diária fisicamente impossível               | Corrigido, regressão verificada |
| M03 | P1         | Erro de fórmula    | A projeção anuncia 48 ciclos/dia onde a automação executa 30                                       | Corrigido, regressão verificada |
| M04 | P1         | Erro de fórmula    | Adicionar uma loja idêntica elimina vendas: frações da demanda desaparecem                         | Corrigido, regressão verificada |
| M05 | P2         | Política implícita | A ordem fixa dos produtos pode deixar leite sem venda apesar de demanda e estoque                  | Corrigido, regressão verificada |
| M06 | P1         | Calibração         | Óleo/farelo/leite não fecham proporções de absorção na hipótese apenas familiar                    | Aberto, reproduzido             |
| M07 | P2         | Política implícita | Cada produtor de óleo mira três dias da demanda global, sem repartir mercado                       | Corrigido, regressão verificada |

## M01 · Quatro fazendas não cobrem nem a folha mínima aos preços de abertura, em qualquer número de linhas

**Fórmula/invariante:** Resultado(n linhas) ≤ n × [(receita bruta − processamento) × ciclos/dia − folha mínima por linha]. Se o termo é negativo, aumentar n não resolve.

Em SP, seis empregados custam R$ 960,96/dia de folha. Mesmo com entradas físicas, todas as utilidades, manutenção, imóvel e equipamento gratuitos, a contribuição máxima de arroz é R$ 617,33/dia e a de leite R$ 947,00/dia. As quatro margens superiores ficam negativas.

**Efeito:** Oferta inicial mascara operações incapazes de se sustentar nesses preços. Mais linhas ampliam a perda sob as mesmas premissas. Não é prova de prejuízo se o preço realizado, salário, duração ou receita mudar.

**Próxima ação:** Reconciliar preço de saída, rendimento, tempo e equipe por linha antes de ajustar demanda ou financiar os produtores. Comparar custo completo por unidade vendável, com e sem retenção de semente.

Fontes: [packages/simulation/src/operations.ts:12](../../packages/simulation/src/operations.ts#L12), [packages/simulation/src/metrics.ts:55](../../packages/simulation/src/metrics.ts#L55), [packages/simulation/src/operations.ts:254](../../packages/simulation/src/operations.ts#L254).

## M02 · O bot aprova recuperação de leite usando produtividade diária fisicamente impossível

**Fórmula/invariante:** Quantidade diária projetada ≤ saída por ciclo × ciclos fisicamente concluíveis por dia.

Corrigido: o planejador usa a cadência executável e limita cada saída à sua fatia de demanda. Respeitando a duração, a mesma unidade dá -R$ 626,58/dia (300 unidades/dia por linha); o plano agora recusa a recuperação. Antes aprovava R$ 4.508,72/dia com teto de 3.600 unidades.

**Efeito:** Pode gastar caixa/crédito para reabrir uma operação inviável, aumentando atrasados. A projeção não apenas omite risco: ultrapassa o limite de tempo da receita.

**Próxima ação:** Usar a capacidade de lote/tick/linhas compartilhada com a execução e avaliar caixa de ciclo, estoque inicial e todos os coprodutos separadamente.

Fontes: [packages/simulation/src/director.ts:63](../../packages/simulation/src/director.ts#L63), [packages/simulation/src/operations.ts:99](../../packages/simulation/src/operations.ts#L99).

## M03 · A projeção anuncia 48 ciclos/dia onde a automação executa 30

**Fórmula/invariante:** Cadência da automação em regime, sem outros bloqueios ou fila manual: C(c,l) = c × dia / [intervalo × teto(duração_por_ciclo × teto(c/l) / intervalo)]. Exige insumos, caixa, espaço e orçamento suficientes; não equivale a vendas previstas.

Corrigido: aço, duas linhas e lotes de cinco; o lote leva teto(5/2) = 3 horas e só reinicia na próxima rodada de duas horas, logo 6 lotes/dia × 5 = 30. Reposição e demanda industrial agora mostram 30 e 30; a execução medida entre os dias 1 e 2 iniciou 30 ciclos. Antes, as previsões mostravam 48.

**Efeito:** Superestima necessidade, cobertura de custos e compra de insumos em 60% neste caso. Em outros lotes, o erro pode ter outro sentido/magnitude.

**Próxima ação:** Compartilhar o cálculo exato de cadência, incluindo os dois tetos e fila. Identificar previsão de início versus conclusão e horizonte de aquecimento.

Fontes: [packages/simulation/src/operations.ts:99](../../packages/simulation/src/operations.ts#L99), [packages/simulation/src/supply.ts:236](../../packages/simulation/src/supply.ts#L236), [packages/simulation/src/metrics.ts:243](../../packages/simulation/src/metrics.ts#L243).

## M04 · Adicionar uma loja idêntica elimina vendas: frações da demanda desaparecem

**Fórmula/invariante:** Duplicar oferta idêntica, mantendo preço, qualidade, orçamento e capacidade folgada, não deve zerar demanda agregada positiva por arredondamento.

Corrigido: a fração que não forma uma unidade fica para a rodada seguinte. Itabira tem 11,3343 pacotes/dia de potencial (1,1334 por rodada com o multiplicador de score). Em um dia, uma loja vende 13 e duas lojas iguais vendem 12 somadas. Antes, duas lojas vendiam zero.

**Efeito:** Concorrência destrói demanda, sobretudo em itens de baixo giro. O histórico registra desejado=0, escondendo essa perda do indicador vendido/desejado.

**Próxima ação:** Acumular frações por mercado e distribuir unidades inteiras de forma conservativa, com rotação de restos e desempate reproduzível.

Fontes: [packages/simulation/src/engine.ts:1355](../../packages/simulation/src/engine.ts#L1355), [packages/simulation/src/design.ts:252](../../packages/simulation/src/design.ts#L252).

## M05 · A ordem fixa dos produtos pode deixar leite sem venda apesar de demanda e estoque

**Fórmula/invariante:** A política de distribuição da capacidade compartilhada precisa ser explícita; a posição no array não deve ser confundida com demanda ou rentabilidade.

Corrigido: sem capacidade para tudo, cada produto recebe parte proporcional à procura, com as unidades restantes para as maiores frações. Uma loja de Campinas com um empregado atende 20 unidades/rodada; leite deseja 303 e vende 16, óleo deseja 30 e vende 1. Antes, o óleo, primeiro da lista, levava as 20.

**Efeito:** Há prioridade econômica implícita que pode inviabilizar leite/itens posteriores. A redução de produção pode parecer falta de compradores quando é alocação da loja.

**Próxima ação:** Escolher e expor prioridade, rateio por demanda/margem ou rotação. Medir o efeito antes de alterar coeficientes de consumo.

Fontes: [packages/simulation/src/engine.ts:1364](../../packages/simulation/src/engine.ts#L1364), [packages/simulation/src/engine.ts:1338](../../packages/simulation/src/engine.ts#L1338).

## M06 · Óleo/farelo/leite não fecham proporções de absorção na hipótese apenas familiar

**Fórmula/invariante:** Com óleo e leite atendidos só por estas receitas e sem outros destinos, farelo produzido por óleo deve ser igual ao farelo necessário ao leite demandado por óleo.

Cada óleo produz 3,8 kg de farelo; consumir esse farelo exige 22,8 L de leite por óleo. O consumo familiar relativo é 10. Sob essa hipótese, 56,1404% do farelo fica sem destino. A execução de 90 dias está ausente ou desatualizada; os números históricos ficam separados da prova algébrica.

**Efeito:** Reduzir velocidade isoladamente não corrige a proporção. Estoque inicial, produção interrompida e distribuição afetam o excesso observado; a razão teórica não explica sozinha a trajetória.

**Próxima ação:** Calibrar conjuntamente proporção de coprodutos, destinos executados, consumo e menor operação viável. Medir entradas/saídas efetivas e margem após fixos/frete; evitar financiar acúmulo.

Fontes: [packages/simulation/src/model.ts:495](../../packages/simulation/src/model.ts#L495), [packages/simulation/src/operations.ts:254](../../packages/simulation/src/operations.ts#L254), [packages/simulation/src/calibration.ts:173](../../packages/simulation/src/calibration.ts#L173).

## M07 · Cada produtor de óleo mira três dias da demanda global, sem repartir mercado

**Fórmula/invariante:** Alvo agregado = número de produtores × max(600, 3 × demanda familiar global potencial), antes de considerar lotes em processamento.

Corrigido: três dias da demanda das famílias (5.110,9261/dia) repartidos entre 4 produtores, alvo individual de 3.833,1946 e agregado de 15.332,7784. Antes, cada um mirava 15.332,78, somando 61.331,11.

**Efeito:** Adicionar concorrentes amplia o estoque-alvo agregado. Essa regra pode contribuir para excesso; esta auditoria não mede a causalidade isolada. Cobertura calculada com demanda potencial não é prazo de venda observada.

**Próxima ação:** Experimentar alvo por participação/vendas observadas e lead time, com limite para aquecimento sem histórico. Comparar contra a referência preservada, sem alterar consumo junto.

Fontes: [packages/simulation/src/engine.ts:1878](../../packages/simulation/src/engine.ts#L1878), [packages/simulation/src/metrics.ts:271](../../packages/simulation/src/metrics.ts#L271).

## Limite agrícola por linha em SP

| Receita         | Ciclos/dia, teto contínuo | Contribuição máxima antes da folha | Folha mínima/dia | Resultado máximo/dia |
| --------------- | ------------------------: | ---------------------------------: | ---------------: | -------------------: |
| rice-harvest    |                    0,3333 |                          R$ 617,33 |        R$ 960,96 |           -R$ 343,63 |
| beans-harvest   |                    0,3333 |                          R$ 626,67 |        R$ 960,96 |           -R$ 334,29 |
| sugar-harvest   |                    0,3333 |                          R$ 547,00 |        R$ 960,96 |           -R$ 413,96 |
| milk-production |                         1 |                          R$ 947,00 |        R$ 960,96 |            -R$ 13,96 |

Este teto ignora insumos físicos, retenção de sementes, todas as utilidades, manutenção, frete, instalação e equipamento. Assume venda integral ao preço inaugural e ocupação contínua em média de longo prazo; não descreve cada dia de uma colheita em lotes. O custo real é maior; o teto é usado para demonstrar incompatibilidade, não como orçamento de operação. Preço realizado, salários, rendimento ou duração diferentes exigem novo cálculo.

## Fluxos observados no laboratório

| Item    | Estoque inaugural | Produção concluída | Entrada em produção | Consumo familiar | Consumo público | Estoque físico final | Em trânsito final |
| ------- | ----------------: | -----------------: | ------------------: | ---------------: | --------------: | -------------------: | ----------------: |
| oil     |            20.000 |             48.000 |                   0 |            4.597 |               0 |               63.403 |                 0 |
| soymeal |             3.000 |            182.400 |                 550 |                0 |               0 |              184.850 |                 0 |
| milk    |             2.685 |              3.300 |                   0 |            5.185 |               0 |                  800 |                 0 |

Unidades: óleo/leite em embalagens de 1 L; farelo em kg. Identidade: estoque físico + trânsito = inaugural + produção concluída − entradas consumidas − consumo familiar − consumo público. Saídas comprometidas de jobs ainda não concluídos ficam separadas. Não contar comércio de atacado como consumo final.

Conferir a validade da referência antes de interpretar os dados históricos.

Experimento já registrado: Rejeitar esta intervenção pelos critérios pré-definidos; manter evidência e investigar demanda/margem/escala. Seu fingerprint está desatualizado. Intervenção registrada: Velocidade de produção soy-oil ×0.75: duração dos ciclos dividida pelo fator, sem alterar quantidades, massa ou equipamento inaugural.. Farelo físico final: A = 184.850 kg e B = 184.850 kg, nos horizontes de 90/90 dias. Esses fatos não atribuem uma causa única à distribuição.

Marcos extraídos da série da referência, com validade indicada acima. Quantidades acumuladas de produção/consumo e estoque observado; não inferir produção contínua durante os 90 dias de totais finais estáveis.

| Dia | Item    | Produção acumulada | Consumo familiar acumulado | Entrada em produção acumulada | Estoque físico |
| --: | ------- | -----------------: | -------------------------: | ----------------------------: | -------------: |
|  30 | soymeal |            182.400 |                          0 |                           550 |        184.850 |
|  30 | oil     |             48.000 |                      2.720 |                             0 |         65.280 |
|  30 | milk    |              3.300 |                      4.936 |                             0 |          1.049 |
|  60 | soymeal |            182.400 |                          0 |                           550 |        184.850 |
|  60 | oil     |             48.000 |                      3.948 |                             0 |         64.049 |
|  60 | milk    |              3.300 |                      5.185 |                             0 |            800 |
|  90 | soymeal |            182.400 |                          0 |                           550 |        184.850 |
|  90 | oil     |             48.000 |                      4.597 |                             0 |         63.403 |
|  90 | milk    |              3.300 |                      5.185 |                             0 |            800 |

## Controles aprovados e limites menores

- 5 cenários preservaram dinheiro inteiro e não negativo; as duas lojas são comparadas em mundos separados com o mesmo capital inaugural.
- Custo do lote de óleo: R$ 2.183,00; alocação de R$ 2.183,00 entre coprodutos. Conclusão repetida não duplica saída; tentativa sem insumo rejeita sem mutação.
- O laboratório registra conservação física e monetária; isso não demonstra rentabilidade, demanda realizada suficiente ou ausência geral de arbitragem.
- Arredondamento dos fixos: projeção de 2173288¢/dia versus execução de 2173284¢; diferença de -4¢ por dia na unidade de controle. Cada parcela é arredondada por tick. Impacto baixo; conferir no ajuste do custeio.
- Qualidade com múltiplas entradas é ponderada por quantidade. Hoje ferro/carvão estão ambos em toneladas; não foi demonstrado bug atual de unidade nesse recorte. Exigir pesos explícitos para futuras receitas com unidades diferentes.

## Sequência de correção e experimentos

1. Corrigir M02/M03 compartilhando a cadência real entre execução, recuperação, reposição, preços e projeções. Critério: mesma fixture de aço retorna 30 ciclos/dia e recuperação do leite não usa mais de 300 un/dia por linha. Separar capacidade máxima, programação e venda provável.
2. Corrigir M04 conservando frações e distribuindo unidades sem perda por concorrência; testar cidades pequenas, orçamento/capacidade insuficientes, calendário e repetição online/offline. Decidir M05 explicitamente antes de medir demanda de leite.
3. Reconciliar trabalho, duração, rendimento e preço nas quatro receitas de M01. Buscar a menor operação viável por especialidade com caixa finito e custo completo, sem resgate invisível. Antes de alterar receita/item, preencher RESOURCE-TEMPLATE e regenerar/verificar o catálogo.
4. Testar M07 isoladamente: alvo de estoque por participação/lead time, preservando consumo, receitas e custos. Comparar 30/90 dias e sementes pareadas. Critérios candidatos: reduzir estoque de farelo em 20%, preservar ao menos 95% do consumo de óleo/leite, não elevar obrigações mais de 5%, conservar dinheiro e fluxos físicos. São critérios propostos, sem aprovação automática.
5. Somente depois testar M06 como cadeia: coeficientes/destinos executados e consumo em conjunto. Medir margem após fixos/frete, produção, consumo efetivo, estoques, atrasados e concentração por item. Preservar a referência anterior; corrigir um problema por experimento para identificar efeitos.

Os achados não autorizam recalibrar retroativamente a season salva. Esta entrega conclui as provas de auditoria, sem aplicar mudanças ao motor ou aos parâmetros.
