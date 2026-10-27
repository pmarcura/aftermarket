# Bancada de investigação do AFTERMARKET

Objetivo: o agente e o desenvolvedor devem localizar evidência e reproduzir um problema rapidamente, sem navegar manualmente por todo o jogo ou reler a implementação. A bancada local abre em `/lab` e funciona sem iniciar a API do mundo.

```powershell
npm run lab
```

## Atualizar o contexto automaticamente

`npm run lab` inicia a apresentação e o watcher juntos, reutilizando o servidor do laboratório se disponível. Não inicia a API do mundo. A coleta inclui os fluxos mutáveis isolados e a comparação contra a referência existente; nunca aceita uma nova referência silenciosamente.

```powershell
npm run lab:refresh
npm run lab:watch
```

`refresh` gera catálogo, captura interfaces e roda A/B de 90 dias (`baseline`/`low-demand`, seed 0), depois escreve o contexto e a triagem. `watch` faz a mesma coleta inicial e observa mudanças de UI/motor/dados, agrupando alterações próximas. Ctrl+C encerra. Não há chamada de modelo nessa coleta; agentes entram na investigação e nas decisões. A primeira captura é mais lenta; resultados econômicos idênticos usam cache por conteúdo/configuração e telas sem alteração reutilizam evidência válida.

Para outro horizonte/lote:

```powershell
npm run lab:refresh -- --days=30 --seeds=0,1,2
npm run lab:batch -- --days=90 --seeds=0,1,2 --scenario=baseline --compare=baseline --demand=1 --compare-demand=0.8
```

A/B usa a mesma época e semente, alterando somente as opções declaradas. `--compare=none` executa apenas A; `--force` no batch ignora cache. `seed-mode=rotation` rotaciona três estratégias; `conditions` varia capital e orçamentos inaugurais em ±15%, com transferências entre bots e famílias conservando dinheiro. Não representa Monte Carlo amplo de jogadores humanos. Preços e demanda são simulados. Nenhum comando abre SQLite, importa o store ou consulta a economia salva. O watcher é iniciado por `lab` ou `lab:watch`; não é um serviço instalado no sistema.

## Primeiro arquivo para consultar

| Artefato                                  | Uso                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| `.runtime/lab/context.json`               | Índice de telas, evidência, mudanças, alertas e resultados de A/B                           |
| `.runtime/lab/review.json`                | Triagem automática: observação, hipótese, evidência e próximo experimento                   |
| `.runtime/lab/ui/summary.json`            | Estados/títulos/contagem de controles e capturas, sem dump de toda a UI                     |
| `.runtime/lab/ui/index.json`              | DOM visível, campos, nomes, valores, desabilitados, texto e screenshot de cada estado       |
| `.runtime/lab/simulations/latest.json`    | Resumo econômico por cenário/semente, rupturas observadas, bots e diferenças pareadas       |
| `.runtime/lab/simulations/<hash>.json`    | Configuração efetiva e séries completas por dia/item/empresa                                |
| `.runtime/lab/simulations/comparison.csv` | Comparação tabular em centavos, com indicação de cache                                      |
| `docs/design/UI-CATALOG.json`             | Inventário regenerável: componentes, comandos candidatos, textos estáticos, linhas e testes |

Consultas rápidas sem recapturar nem simular:

```powershell
npm run lab:context -- --write
npm run lab:context -- --screen=market
npm run lab:context -- --query=frota
npm run lab:context -- --screen=industry --state=abertura --viewport=desktop --detail
npm run lab:capture -- --screen=industry --force
```

O índice compara hashes de fontes: captura antiga aparece desatualizada. O catálogo identifica arquivos alcançáveis e ramos condicionais; os controles observados no navegador descrevem a fixture capturada. Não confundir os dois. O gerador valida as dez views reais de `App.tsx`, impedindo esquecer uma nova página no registro.

## Simulações e diagnóstico

A bancada oferece progresso, cancelamento por encerramento do worker, comparação A/B, gráfico diário, dez mercados, caixa/dívidas/atividade de cada bot, últimas ações e JSON. O mesmo runner serve ao CLI. Todos os ticks econômicos continuam sendo executados, com checagem de dinheiro/estoque/obrigações/eventos vencidos. Não acelera omitindo eventos.

Preço/oferta são observações no fim de cada dia. HHI por item usa receita por vendedor em até sete dias; ausência de vendas é `null`. Negócios de atacado e remessas/jobs são acumulados. Atendimento pode ter janela encurtada pela retenção de consumo; o relatório informa isso. `decisions` preserva a contagem anterior do diretor; `trace` registra comandos aceitos/recusados, alterações de preços e gates instrumentados de diretor, produção e reposição. `blocked` inclui candidatos avaliados, sem provar inação total de uma empresa. `idle` não inventa uma causa. Eventos sem produto observado não são atribuídos artificialmente a um item.

O índice de ledger usado pelo runner é temporário e exclusivo do mundo novo com lançamentos append-only. Ele é removido mesmo quando a execução falha. O jogo salvo continua usando consultas normais. Mudança futura que edite lançamentos existentes exige revisar essa precondição. `recordMarket` agrega dados por tick e mantém o mesmo contrato público, validado contra o cálculo anterior.

## Interfaces, design e refinamento

O Playwright usa abertura fixa em memória, desktop 1440×1000 e celular 390×844, sem API/SQLite. Captura as dez páginas, abas de primeiro nível, modais declarados e estados globais de carregamento/falha. Mapas usam tiles vetoriais vazios controlados: a evidência valida controles/markers/layout, não estradas reais. Há triagem de erros de página/console, rolagem lateral e controles sem nome; o registro de foco não certifica toda a navegação por teclado.

O ciclo de trabalho é:

1. **Observar:** abrir o índice e identificar tarefa, impedimento e primeiro dia/estado afetado.
2. **Definir:** escrever o problema do jogador, separando número observado de causa presumida.
3. **Formular:** uma hipótese e uma mudança reversível, com resultado esperado e limite aceitável.
4. **Experimentar:** repetir cenário/seed/horizonte e o fluxo de UI relacionado; comparar contra A.
5. **Decidir:** registrar evidência, efeitos laterais, aceitação/rejeição e próxima pergunta.

Automatizar a coleta dá contexto para esse processo. Julgar clareza, estética e interesse da decisão pede revisão de design e playtest humano. Os scripts não aplicam rebalanceamento, não emitem uma nota fictícia de UX e não tratam alertas heurísticos como prova de falha econômica.

## Verificação

`npm run lab:catalog:check` verifica o inventário. `npm run test:lab` usa apenas Vite/Edge na porta 5186, sem API. `lab:capture` também usa 5186 durante a coleta; execute em sequência ou use `AFTERMARKET_LAB_PORT` para outra porta. O servidor do jogo pode continuar aberto em 5173/3001. Nenhuma dependência nova foi adicionada.

As referências de Wube, Riot e EA, e os limites da adaptação, estão em [SIMULATION-LAB.md](../research/SIMULATION-LAB.md). Evidências da entrega em `.planning/phases/07-development-lab/07-VALIDATION.md`.

## Consultar bot, produto, dia ou ação

```powershell
npm run lab:query -- --run=A:0 --bot=rival-1 --day=30 --limit=5
npm run lab:query -- --run=A:0 --item=soymeal --day=90 --series
npm run lab:context -- --screen=carrier --action=buyVehicle
```

As consultas usam os relatórios existentes, não avançam a simulação. IDs ou nomes são aceitos; referência ambígua gera erro em vez de escolher uma empresa. `--day=all`, `--outcome=blocked` e `--source=supply` filtram eventos. O limite refere-se a grupos; cada grupo mantém contagem e primeiro/último instante. A interface oferece os mesmos recortes e gráficos, paginação e configuração de reprodução.

## Comparar custos, velocidade, frete, políticas e choques

```powershell
npm run lab:batch -- --days=90 --compare=baseline --compare-cost=0.9
npm run lab:batch -- --days=90 --compare=baseline --compare-capacity=0.75 --compare-capacity-recipe=soy-oil
npm run lab:batch -- --days=90 --seed-mode=conditions --seeds=0,1,2 --compare=baseline --compare-policy=quality
npm run lab:batch -- --days=90 --compare=baseline --compare-shock-day=30 --compare-shock-type=demand --compare-shock-multiplier=0.5
npm run lab:benchmark
npm run lab:study
```

Custos alteram salários/manutenção/utilidades/processamento; velocidade divide duração, preservando quantidades das receitas; frete altera seus componentes monetários, preservando mínimo comercial. Choques aplicam-se no início do dia declarado. `metadata.config` registra abertura; `experiment.events` registra a intervenção; contratos anteriores mantêm termos. Tudo ocorre em mundos novos. Os multiplicadores são hipóteses simuladas, sem recalibrar a season salva.

Benchmark fresco: 30 dias em 2,71 s, 90 em 10,29 s, 365 em 84,40 s neste computador. Consultas com leitura/parse dos relatórios levaram 21/47/211 ms. O relatório separa execução, serialização e cache; uma amostra não estabelece p95. Ver `.runtime/lab/benchmark.json`.

## Referência e fluxo de design

```powershell
npm run lab:capture -- --flows --compare
npm run lab:capture -- --flows --compare --accept-baseline
```

O segundo comando registra explicitamente a referência depois da revisão. Versões anteriores ficam em `.runtime/lab/ui/baseline/versions`; comparação não altera a referência. Relatórios mostram diferenças de controles/textos/asserções/comandos e pixels PNG RGB/RGBA com limiar declarado. Estado novo ou removido fica sem par; não é aprovado automaticamente. As capturas usam relógio e IDs controlados; limitações de uma referência histórica, inclusive um estado de carregamento capturado anteriormente, continuam expostas.

São 29 contratos de fluxo e 58 execuções desktop/celular. Há efeitos reais em fixture de aquisição, produção, negociação entre contas, edital, transporte dividido, instalação, crédito/pagamento, venda de veículo, estoque e equipe, com dinheiro/estoque/frota antes e depois. Isso não cobre todas as combinações possíveis nem certifica acessibilidade integral.

Em **Método**, o diário permite registrar observação, hipótese, critério, resultado, decisão e anexar um relatório, persistir localmente e exportar JSON. A investigação real óleo/farelo/leite e a revisão da compra de caminhão aparecem em **Investigação realizada** e em `.runtime/lab/studies/oil-meal-milk-and-carrier.json`. O teste de reduzir somente a velocidade de óleo foi rejeitado: farelo final permaneceu em 184.850 kg. A interface passou a explicar caixa livre/falta de dinheiro e impedir confirmação inviável; compra viável preserva os comandos autoritativos.
