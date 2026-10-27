# Laboratório de simulação e diagnóstico

Pesquisa em 27/10/2026. Fontes primárias de equipes de desenvolvimento; as adaptações abaixo são propostas para AFTERMARKET, não funcionalidades atribuídas aos estúdios nem entrevistas com desenvolvedores humanos.

## Resultado procurado

Reduzir o tempo entre uma pergunta de balanceamento e uma evidência que permita agir: executar o motor, localizar quando o problema apareceu, identificar empresas/produtos afetados e reproduzir o caso. Velocidade de entendimento pelo agente é um critério próprio; executar mais partidas sem organizar os resultados não resolve esse problema.

O ponto de partida já existe em `scripts/balance-season.ts`: mundos isolados, tempo injetado, bots reais, cenários `baseline`, `starter` e `low-demand`, observações diárias e conservação monetária. Falta transformar essa execução em experimento comparável e navegável. Não é necessário construir outra economia nem começar por treinamento de modelos.

## Três casos verificáveis

| Equipe e fonte                                                                                                                                                                              | Evidência publicada                                                                                                                                                                                       | Adaptação proposta                                                                                                                                                                                          | Limite da comparação                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wube / Factorio**, [Friday Facts #315 — New test servers](https://www.factorio.com/blog/post/fff-315), 04/10/2019                                                                         | O modo pesado salva e recarrega a cada tick e compara CRC do mapa; a equipe mede o tempo da suíte e executa testes após commits.                                                                          | Reexecutar cenário/semente/configuração e comparar métricas determinísticas; medir simulação separadamente de serialização e interface.                                                                     | O texto trata de regressão/determinismo e hardware. Não demonstra equilíbrio econômico nem promete anos de jogo em segundos.                 |
| **Riot / League of Legends**, [Automated Testing for League of Legends](https://www.riotgames.com/en/news/automated-testing-league-legends), 26/02/2016                                     | O BVS parametriza cenários, emite comandos e consulta estado por API; separa preparação, execução e verificação. Relatórios guardam resultados; testes passam por estabilização antes de bloquear builds. | Um único executor e esquema de relatório servem ao terminal, interface e agente. Catálogo explícito de casos; falha econômica reproduzível e alerta exploratório têm tratamentos diferentes.                | Os números publicados são históricos. Testes funcionais e infraestrutura de produção não são prova de bots equivalentes a jogadores humanos. |
| **EA / SEED**, [Technical Challenges of Deploying Reinforcement Learning Agents for Game Testing](https://www.ea.com/seed/news/cog23-challenges-deploying-rl-agents-game-testing), CoG 2023 | A equipe relata integrar RL a uma solução existente de bots roteirizados para ampliar cobertura em Battlefield 2042 e Dead Space (2023); dificuldades e custos de integração são parte do estudo.         | Instrumentar primeiro os bots existentes; introduzir novas políticas quando houver uma lacuna de comportamento mensurável. Reservar RL para um problema cuja cobertura justifique treinamento e integração. | O caso amplia cobertura de testes. Não fornece garantia de balanceamento econômico nem transferência imediata para agentes empresariais.     |

**Inferência para o projeto:** o investimento inicial com maior utilidade é um executor sem renderização, cenários reproduzíveis e diagnóstico estruturado. Não há evidência nessas fontes para escolher RL, nuvem ou LLM por decisão como pré-condição desse laboratório.

## Arquitetura recomendada

1. **Núcleo em `packages/simulation`:** recebe cenário, semente, horizonte e parâmetros explícitos de experimento; cria mundo novo; usa `advance` e os mesmos comandos de humanos/bots. A interface não injeta dinheiro nem contorna estoque, crédito ou transporte.
2. **Executor isolado:** processo ou worker do Node já disponível, com progresso, cancelamento e erro persistente. Simulação longa não deve bloquear API/UI do jogo. Limitar concorrência antes de paralelizar sementes; medir o ganho real.
3. **Relatório comum:** configuração efetiva, revisão de código quando disponível, versão do esquema, horizonte, método de roteamento e campos com unidade/janela. JSON detalhado permite consultas do agente; CSV facilita inspeção pontual.
4. **Resumo para decisão:** primeira anomalia e pior período, empresas/produtos afetados, trajetória e reprodução. Separar constatação, hipótese e próxima experiência. Comparação lado a lado usa a mesma duração e sementes; não mistura mudanças de bot com mudanças de regra sem identificá-las.
5. **Interface de investigação:** escolher caso, executar, cancelar, inspecionar dia e empresa/item, comparar execução e abrir evidência. O mapa e suas requisições não são necessários para interpretar curvas econômicas.

Nenhuma dessas decisões exige dependência nova. O mundo principal e sua configuração congelada não participam da execução. Rotas do experimento offline precisam continuar identificadas como estimativas; um teste econômico offline não valida custos territoriais reais.

## Telemetria que explica comportamento

| Pergunta                               | Evidência mínima                                                                                    | Cuidado de interpretação                                                                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| O dinheiro desapareceu ou foi criado?  | Soma de centavos, saldos inválidos e primeiro dia divergente                                        | Invariante: falha interrompe e conserva evidência; não é apenas aviso de balanceamento.                                              |
| Quem perdeu capacidade de agir?        | Caixa, obrigações vencidas, caixa comprometido, instalações ativas/pausadas por empresa             | Caixa isolado não mede lucro nem patrimônio; suspensão não equivale automaticamente a falência.                                      |
| Onde a cadeia rompeu?                  | Oferta e estoque físico por produto/dia, dias sem oferta, produção e entregas                       | Produto sem anúncio pode ter estoque; estoque em trânsito não é estoque disponível.                                                  |
| Uma estratégia dominou?                | Participação por empresa dentro de cada produto e HHI por produto; resultado por estratégia         | HHI agregado entre produtos pode esconder monopólios locais. Registrar denominador e retornar ausência de mercado quando ele é zero. |
| Por que um bot parou?                  | Última ação, alvo e motivo de bloqueio: caixa, insumo, capacidade, frota ou ausência de contraparte | “Tem pouco caixa” é hipótese se não houver motivo registrado pelo caminho de decisão.                                                |
| O resultado dependeu do acaso inicial? | Comparações pareadas por semente/configuração, dispersão e piores casos                             | No cenário atual, seed altera distribuição de estratégias; não representa automaticamente toda a variabilidade do mundo.             |
| Quanto demorou entender?               | Tempo de execução, tamanho do resumo e tempo até localizar causa/reproduzir caso                    | Dias simulados/segundo não mede tempo de investigação. Não prometer desempenho antes do benchmark.                                   |

Contagens acumuladas precisam de acumuladores próprios se o motor descarta histórico. Compras, jobs ou ledger retidos não devem ser apresentados como total da temporada sem garantia. Quando só houver amostra diária, declarar que uma ruptura intradiária pode não aparecer.

## Pipeline de interfaces para acelerar a leitura do agente

O projeto já tem Playwright, testes de navegação e capturas. Evoluir essa base evita recapturar e reler telas sem contexto:

1. Manter catálogo com identificador estável de página/fluxo, entrada, ações reais, pré-condições e estados esperados: vazio, carregando, sucesso, erro, bloqueado e confirmação quando aplicáveis. Associar requisito e teste existente.
2. Percorrer páginas e fluxos com fixtures em banco separado. Extrair títulos, controles com nome acessível, campos, estado desabilitado, erro de console e requisições que falharam. Não inferir cobertura completa a partir de todos os arquivos TSX encontrados.
3. Produzir manifesto JSON e índice Markdown com links para testes e capturas desktop/celular. Registrar cenário, viewport, revisão e estado, para saber o que cada imagem comprova.
4. Priorizar diferenças: novas ações sem caso de teste, nomes/estados alterados, fluxo quebrado, overflow e falta de foco. Capturar estados relevantes e falhas; o agente começa pelo índice e abre imagens quando a pergunta exige inspeção visual.
5. Não clicar indiscriminadamente em controles financeiros para “descobrir” a aplicação. Fluxos mutáveis têm fixture e consequência esperada; screenshots não substituem asserção de saldo/estoque/entrega.

O catálogo serve de mapa do produto e de entrada para revisão de UX. Ele não certifica acessibilidade integral, estética ou compreensão humana.

## Ciclo de experimento e design

Registrar **observação → problema do jogador → hipótese → uma mudança → comparação → decisão**. Exemplo: “varejistas sem caixa no dia 18” exige distinguir margem negativa, estoque excessivo e prazo de recebimento antes de reduzir custos. A intervenção precisa beneficiar uma decisão compreensível do jogador, não apenas melhorar um indicador.

Primeiro conjunto: baseline e baixa demanda em 30/90 dias; repetir com sementes 0, 1 e 2 para detectar resultados dependentes da estratégia inicial. Usar 365 dias para resistência após o diagnóstico curto. O cenário iniciante sem comandos humanos mede a abertura passiva; só um roteiro com compra/abastecimento/venda e playtest humano avalia progressão inicial.

Uma regressão deve informar o que mudou contra a referência, em qual dia e com quais efeitos laterais. Limiares de concentração, sobrevivência ou ruptura são heurísticas de investigação até serem definidos como metas de produto. Conservação, estoque não negativo e repetição sem duplicação são critérios obrigatórios.

## Critério de saída e limites

- Executar e repetir uma temporada isolada, com tempo medido e reprodução registrada.
- Localizar problema por dia, item e empresa sem ler um dump inteiro ou assistir à partida em tempo real.
- Obter evidência estruturada consultável pelo agente e inspeção visual coerente pelo desenvolvedor.
- Identificar testes/capturas por fluxo e estado, sem depender da memória de navegação.
- Distinguir resultados medidos, estimativas de transporte, diagnósticos heurísticos e cobertura ainda ausente.

Esta pesquisa orienta a implementação. Não declara que o laboratório descrito, o catálogo de interfaces, planejamento estratégico dos bots ou equilíbrio integral já estejam entregues. Próximos investimentos devem seguir o gargalo medido: custo do motor, falta de telemetria decisória ou dificuldade de leitura dos resultados.
