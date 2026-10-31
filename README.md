# AFTERMARKET

Simulador empresarial geográfico no Brasil. Explore oportunidades, adquira propriedades, compre insumos, contrate transporte e opere negócios conectados por uma economia persistente.

**Entrega atual: versão jogável local 0.4.0.** Dez telas baseadas nas referências, cartografia real, servidor autoritativo local e persistência SQLite. O jogo ainda não é um MMO público: contas autenticadas, infraestrutura distribuída e várias regras do GDD estão nas próximas fases.

## Executar

Para balancear o jogo, use a [bancada de simulações](docs/design/DEVELOPMENT-LAB.md): `npm run lab` abre `/lab` sem API/banco, com A/B por semente, consulta por bot/produto/dia e exportação JSON. Na linha de comando, `npm run lab:batch` compara cenários e `npm run economy:proof` mede os KPIs de aceitação.

Requisitos: **Node.js 22 LTS** (22.13 ou superior; `.nvmrc` fixa a versão), npm e navegador com WebGL. Não precisa de chave de API para o mapa.

```powershell
npm ci
npm run dev
```

Abra **http://127.0.0.1:5173**. API: http://127.0.0.1:3001/api/health.

Existe uma única economia (D-042). `npm run dev` abre o mundo `playtest`: começo enxuto (uma loja vazia em Campinas e R$ 1 milhão), 59 municípios e cerca de 90 empresas-bot. Para o mundo grande, com cerca de 550 empresas-bot e frete por distância estimada, use `AFTERMARKET_WORLD_SCALE=20 npm run dev`. Testes e laboratório usam o cenário `baseline` (mesma economia, sem começo enxuto).

O mundo fica em `.runtime/world.sqlite`. Fechar o navegador não perde o progresso. Ao reiniciar o servidor, os eventos vencidos são processados. Não apague `.runtime` para atualizar o código. Faça backup antes de alterar o formato do estado.

```powershell
npm run world:backup
```

Para executar a compilação de produção local:

```powershell
npm run build
npm start
```

Nesse modo, interface e API usam http://127.0.0.1:3001.

## Primeiro teste de jogo

1. Ao entrar, o guia de primeiros passos mostra o caminho: comprar mercadoria para a loja, receber a entrega, fazer a primeira venda, abrir um negócio de produção e colocá-lo para rodar.
2. Em **Mercado**, escolha uma oferta, informe quantidade, destino e transportadora. Compare o custo completo antes de pagar.
3. Em **Logística**, acompanhe a carga. O estoque só recebe o material depois da entrega.
4. Em **Oportunidades**, compre um imóvel livre, instale o equipamento de uma receita e contrate a equipe. A produção consome os insumos ao começar e entrega a saída ao terminar.
5. Em **Configurações**, alterne entre João Silva e Marina Costa. As duas empresas veem a mesma titularidade e os mesmos estoques de mercado.

O relógio do laboratório usa **120×**: um segundo real equivale a dois minutos do jogo. Um ciclo siderúrgico de quatro horas do jogo leva dois minutos reais. Custos e consumo são processados a cada duas horas do jogo. O botão de pausa impede novos ciclos; lotes já reservados terminam normalmente, e contratos fixos continuam sendo cobrados. Água e energia são pagas por consumo.

## Temporadas e balanceamento

Preços iniciais, receitas, população representada, salários, utilidades e combustível são copiados para a configuração da temporada. **Nenhuma cotação econômica externa é consultada durante o jogo.** O mercado evolui pelos agentes internos; fontes reais servem para criar/balancear temporadas futuras.

Consulte [fórmulas e regras](docs/product/ECONOMY.md) e [auditoria de design](docs/product/GAME-DESIGN-AUDIT.md). O gráfico avançado oferece zoom, cursor cruzado, candles de negócios, média móvel, escala logarítmica, livro de ofertas, tabela e exportações.

Para balancear os recursos, comece pelo [catálogo de itens, receitas e fornecedores](docs/product/RESOURCE-CATALOG.md) e pelo [padrão matemático e regras de admissão](docs/product/RESOURCE-STANDARD.md). Novos itens/receitas exigem a [ficha de admissão](docs/product/RESOURCE-TEMPLATE.md). A auditoria separa cobertura estrutural de viabilidade econômica.

O [relatório das mecânicas](docs/product/MECHANICS-REPORT.md) reúne origem/valor das sementes e dos estoques iniciais, óleo/farelo/leite, custos, capacidade, demanda, transporte, finanças e fluxos incompletos. Para atualizar a leitura e os anexos de configuração/números do código: `npm run mechanics:report -- --world=.runtime/world.sqlite --write-doc`. O comando lê o banco sem avançar ou alterar a season.

As correções de fórmula da auditoria matemática (cadência executável, frações da demanda, prioridade do varejo, meta de estoque repartida) são provas de regressão em `tests/formula-fixes.test.ts`, sobre as receitas do catálogo. O relatório que reproduzia os achados sobre as receitas antigas foi retirado com a economia 1 (spec 001).

```powershell
npm run resources:catalog
npm run resources:check
npm run resources:audit -- --world=.runtime/world.sqlite
```

O catálogo versionado usa a abertura do código. O último comando lê o snapshot salvo sem migrar/tickar e grava JSON/Markdown em `.runtime/resources/saved-world.*`. Custos de comparação e alertas não alteram o mundo. `npm run check` inclui a auditoria estrutural; `resources:audit -- --strict` também reprova alertas de balanceamento/agregação conhecidos.

```powershell
npm run balance:season -- --days=90 --scenario=baseline --seed=0
```

Esse comando simula um cenário separado, conserva o dinheiro e grava relatório em `.runtime/balance`; nunca usa o banco do jogador. Para verificar uma migração do banco existente, pare seu servidor, faça `npm run world:backup` e execute `npm run world:upgrade`. A atualização mantém saldos humanos, estoques, titularidade, frota, recibos e prazos; cria outro backup antes de converter. O capital dos novos bots vem dos consumidores existentes, com lançamento, sem emissão. A atualização de regras não cobra ticks econômicos vencidos retroativamente.

## Fluxos novos na 0.4.0

- **Imóvel → equipamento → equipe → operação**: novas aquisições não contratam equipe automaticamente. Antes de confirmar, veja CAPEX e capital de giro estimado.
- **Estoque → Trazer de outro estoque → Reposição automática**: origem fixa por produto, mínimo/alvo, orçamento e frota. Também disponível em Abastecimento → Conectar minha estrutura.
- **Frota**: cartões com busca, capacidade em t/m³ e unidades, máximo da operação, ação Usar máximo, prazo/custo e detalhamento por caminhão. Confirmação sempre revalida disponibilidade.
- **Alertas**: erros permanecem visíveis dentro da janela ativa até fechar ou outra ação atualizar a mensagem.
- **Empresa**: caixa livre/vinculado, obrigações e recuperação; gráficos com tabela, exportações e tela cheia.

O roteador pode ser configurado por `AFTERMARKET_ROUTER_URL`. O padrão público é para desenvolvimento; produção requer capacidade própria e perfil de caminhão. Ver [contrato de roteamento](docs/research/ROUTING.md).

## Estrutura e fontes de verdade

| Local                        | Responsabilidade                                          |
| ---------------------------- | --------------------------------------------------------- |
| `apps/web`                   | Interface React, mapa, navegação e fluxos do jogador      |
| `apps/server`                | API, validação de pedidos e transações SQLite             |
| `packages/simulation`        | Regras econômicas, modelos, receitas e cenário inicial    |
| `packages/world`             | Regiões piloto, catálogo IBGE e proveniência              |
| `docs/product/GDD-v3.0.md`   | GDD original, preservado sem alterações                   |
| `docs/references`            | As 13 imagens originais e seu manifesto                   |
| `docs/research/ECOSYSTEM.md` | Repositórios, mapas, dados, licenças e decisões           |
| `.planning`                  | Requisitos, fases, estado atual e evidências de validação |
| `tests`                      | Testes de integridade e fluxos de navegador               |
| `.runtime`                   | Banco, backups e ferramentas temporárias; fora do Git     |

Comece pela [situação atual](.planning/STATE.md) e pelo [roteiro](.planning/ROADMAP.md). O [processo Game-GSD](docs/DEVELOPMENT.md) orienta a continuidade sem duplicar versões de código.

## Verificação

```powershell
npm run check
npm run test:e2e
npm run format:check
```

Os testes de navegador usam Chromium: instale com `npx playwright install chromium` (em Linux, `--with-deps`). Para usar o Edge instalado, defina `PLAYWRIGHT_CHANNEL=msedge`. Todos os testes bloqueiam a rede externa (tiles do OpenFreeMap e roteador OSRM) com a fixture `tests/e2e/fixtures.ts`. Os testes sempre iniciam um banco novo em `.runtime/e2e` e usam portas 5183/3013, separadas do jogo. Não reutilizam o servidor principal. O teste econômico cria uma compra e um ciclo reais nesse banco e pode levar cerca de dois minutos.

## Cartografia e dados

- MapLibre renderiza dados do OpenStreetMap via OpenFreeMap, mantendo os créditos no mapa.
- Há **5.571 municípios** no catálogo IBGE importado e uma malha GeoJSON de Campinas. `npm run data:sync` atualiza dados e proveniência; a economia ativa usa 59 municípios.
- As rotas consultam OSRM e são armazenadas em cache no banco. Novos despachos aguardam uma rota válida: indisponibilidade não contrata uma linha reta nem cobra. Remessas antigas podem receber correção apenas visual, preservando datas e valores. O perfil OSRM atual é automotivo; restrições para caminhões e pedágios exigem Valhalla/infraestrutura própria na fase geográfica.
- Propriedades, infraestrutura econômica, reservas, demanda, preços e empresas são **simulados**. Não representam ofertas imobiliárias nem licenças de exploração reais.

## Limites desta versão

Bots compram, transportam, produzem e ajustam ofertas com recursos finitos e regras comuns. Lojas e produtores têm abastecimento configurável, transferências próprias e educação da equipe. Empresas-bot negociam pedidos e disputam contratos municipais financiados por tesouros estaduais. Oportunidades apresenta preços/estoque/negócios internos e demanda modelada, com mapa, filtros vazios e análise simples/avançada. Fretes humanos, aluguel, contratos recorrentes, planejamento completo e validação territorial nacional continuam planejados. Recuperação inclui obrigações, suspensão, crédito estadual com garantia/verba finita e venda de veículos. Referências de editais usam negócios qualificados com limite diário. Cenários de 30/90 dias conservam dinheiro, mas ainda apresentam concentração e empresas suspensas; não há prova de equilíbrio de uma season pública. A API só escuta o computador local; os perfis sem senha existem para testar concorrência entre empresas.

O repositório Git está na branch `main`. Histórico substitui cópias `old`, `backup`, `final2` ou projetos paralelos. Dependências estão fixadas no `package-lock.json`.
