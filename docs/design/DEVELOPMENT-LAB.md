# Bancada de simulações do AFTERMARKET

Objetivo: comparar hipóteses de balanceamento em mundos novos, isolados e reproduzíveis, usando o mesmo motor e os mesmos comandos do jogo. A bancada abre em `/lab` e funciona sem iniciar a API do mundo nem abrir o banco de nenhum jogador. Ela e `scripts/economy-proof.ts` são a ferramenta oficial de balanceamento (constituição, seção 5).

```powershell
npm run lab
```

`npm run lab` sobe só a apresentação (Vite) e aponta para `/lab`. As simulações rodam num worker do navegador; nada é salvo no servidor. A cadeia de evidência visual de interface (catálogo de telas, capturas, fluxos, comparação com baseline e as consultas de contexto por tela/bot) foi removida na spec 002: o histórico Git a preserva, e ela não volta sem uma spec nova.

## O que a bancada faz

Progresso, cancelamento por encerramento do worker, comparação A/B pareada por semente, gráfico diário, mercadorias do último dia, caixa/dívidas/atividade de cada bot, últimas ações, consulta por bot/produto/dia e exportação em JSON. O mesmo runner (`packages/simulation/src/lab.ts`) serve à linha de comando. Todos os ticks econômicos continuam sendo executados, com checagem de dinheiro, estoque, obrigações e eventos vencidos. Não acelera omitindo eventos.

Preço e oferta são observações no fim de cada dia. HHI por item usa receita por vendedor em até sete dias; ausência de vendas é `null`. `decisions` preserva a contagem do diretor; `trace` registra comandos aceitos/recusados, alterações de preço e gates instrumentados de diretor, produção e reposição. `blocked` inclui candidatos avaliados, sem provar inação total de uma empresa. `idle` não inventa uma causa.

O índice de ledger usado pelo runner é temporário e exclusivo do mundo novo com lançamentos append-only; é removido mesmo quando a execução falha. O jogo salvo continua usando consultas normais.

## Linha de comando

```powershell
npm run lab:batch -- --days=90 --seeds=0,1,2 --scenario=baseline --compare=baseline --demand=1 --compare-demand=0.8
npm run lab:batch -- --days=90 --compare=baseline --compare-cost=0.9
npm run lab:batch -- --days=90 --compare=baseline --compare-capacity=0.75 --compare-capacity-recipe=soy-oil
npm run lab:batch -- --days=90 --seed-mode=conditions --seeds=0,1,2 --compare=baseline --compare-policy=quality
npm run lab:batch -- --days=90 --compare=baseline --compare-shock-day=30 --compare-shock-type=demand --compare-shock-multiplier=0.5
npm run lab:benchmark
npm run economy:proof -- --days=60 --window=30 --seeds=0,1,2,3,4 --write-doc
```

A/B usa a mesma época e semente, alterando somente as opções declaradas. `--compare=none` executa apenas A; `--force` ignora o cache em `.runtime/lab/simulations/`. `seed-mode=rotation` rotaciona três estratégias; `conditions` varia capital e orçamentos inaugurais em ±15%, com transferências entre bots e famílias conservando dinheiro. Não representa Monte Carlo amplo de jogadores humanos. Preços e demanda são simulados.

Custos alteram salários/manutenção/utilidades/processamento; velocidade divide duração, preservando quantidades das receitas; frete altera seus componentes monetários, preservando mínimo comercial. Choques aplicam-se no início do dia declarado. `metadata.config` registra abertura; `experiment.events` registra a intervenção. Tudo ocorre em mundos novos: os multiplicadores são hipóteses simuladas, sem recalibrar a season salva.

`economy:proof` é a régua de aceitação: 5 sementes, 60 dias, janela de 30, escala do mundo jogável; aceitar uma mudança só se a mediana melhora e o pior caso não piora nos KPIs da spec 003. Resultados em `test-results/economy-proof.json` e, com `--write-doc`, em `docs/product/PROVA-V2*.md`.

## Arquivos gerados

| Artefato                                  | Uso                                                                  |
| ----------------------------------------- | -------------------------------------------------------------------- |
| `.runtime/lab/simulations/latest.json`    | Resumo econômico por cenário/semente, rupturas, bots e diferenças    |
| `.runtime/lab/simulations/<hash>.json`    | Configuração efetiva e séries completas por dia/item/empresa (cache) |
| `.runtime/lab/simulations/comparison.csv` | Comparação tabular em centavos, com indicação de cache               |
| `.runtime/lab/benchmark.json`             | Tempo de execução, serialização e cache por horizonte                |
| `test-results/economy-proof.json`         | KPIs por semente da prova econômica                                  |

O cache usa a impressão digital das fontes de `packages/simulation` e `packages/world` (`scripts/lib/lab-fingerprint.ts`): mudar o motor invalida os resultados anteriores.

## Verificação

`npm run check` cobre build, testes unitários (incluindo `tests/lab*.test.ts`) e `resources:check`. O teste de navegador da bancada está em `tests/e2e/lab.spec.ts` e roda com `npm run test:e2e` em Chromium, sem rede externa. Nenhuma dependência nova foi adicionada.

As referências de Wube, Riot e EA, e os limites da adaptação, estão em [SIMULATION-LAB.md](../research/SIMULATION-LAB.md).
