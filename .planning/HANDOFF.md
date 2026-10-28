# Passagem de trabalho · 30/10/2026

Documento para continuar em outra conversa. Ler junto com `CLAUDE.md`, `AGENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md` e `docs/product/DECISIONS.md` (D-031 a D-035).

## Pedidos do Pedro ainda abertos, na ordem combinada

1. **Calibrar a economia no Brasil real com cerca de 500 bots** (escala 20). Detalhes abaixo.
2. **Modelo de grupo (D-035):** empresário com nome, descrição e imagem; caixa pessoal; várias empresas, caras de abrir ou comprar; dividendos; quebra só da empresa com aviso, crédito do tesouro, venda de unidades e leilão; compra de empresas inteiras; regra contra fraude de falência; limite de 40% por produto; ranking por grupo com bots. Bots exatamente iguais aos jogadores (mesmos comandos, mesmas regras, mesmo ranking).
3. **Telas da proposta de UX** (`docs/design/proposta-ux.html`) e da estratégia (`docs/design/estrategia.html`): tela Início com "enquanto você esteve fora" e "precisa de você"; menu de 5 itens; loja como prateleira com anel de estoque; repor em 2 cliques; assistente de abrir negócio com recibo; recompensas (porte da empresa, metas da semana, medalhas, ranking, oportunidade do dia); gráficos ilustrativos e animados; perfil do empresário e das empresas (nome, descrição, imagem ou emblema, cor no mapa). Visual: ícones e cores por produto e atividade, cartões em vez de tabelas, textos curtos, microinterações (venda subindo, caminhão andando, anel enchendo, avisos).
4. **Laboratório para balancear e avaliar interface:** benchmark de 500 bots, prova por cadeia (`npm run economy:proof`), métricas de UX (passos por tarefa, tempo até a primeira venda), comparação entre versões.
5. **Genética interativa de plantas e animais**, com referência no Rust: cada lote de semente, muda ou rebanho tem 6 genes (G crescimento, Y produção, H resistência, W consome mais água/ração, X vazio); cruzamento na fazenda por regra de dominância com prévia das chances; colheita devolve a semente com o mesmo genoma (clone); genética negociável entre jogadores; tela muito visual (genes em blocos coloridos, prévia do cruzamento).
6. **Gado de corte e frigorífico** (carne nas lojas), seguindo `docs/product/RESOURCE-STANDARD.md`.
7. **Interação entre jogadores:** contratos de fornecimento recorrente, frete feito por transportadora de jogador, caminhões usados, leilão de terrenos e de unidades, mural de notícias.
8. **Claude joga contra os bots** pelo navegador, como jogador especialista em idle, tycoon e economia, sem trapaça: só telas e comandos de jogador, sem ler o banco nem o código durante a partida. Anotar tudo (UX, UI, balanceamento) em `docs/playtest/`.
9. Depois: **etapas C e D** para jogar com os amigos (mundo semanal com relógio lento, 1 h real = 6 h de jogo; hospedagem; login). Pedro perguntou sobre Supabase com Colyseus: recomendação registrada na conversa é servidor alugado sempre ligado com login próprio para o primeiro mundo, Supabase (Postgres e login) mais tarde e Colyseus não é necessário. O relógio lento exige revisar `TIME_SCALE` (hoje 120, constante global) e recalibrar prazos.
10. **Arte:** Pedro gera as imagens no GPT só depois; os prompts (estilo "guache de jogo de tabuleiro", 61 imagens com nome de arquivo) já estão em `docs/design/estrategia.html`.

## Feito nesta conversa (commits locais em `main`)

| Commit                          | O que entrou                                                                                                                      |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `0d4be75`                       | Guia de primeiros passos, mercado com margem e quantidade sugerida, quadro "Negócios para abrir"                                  |
| `98bc159`                       | Balanceamento da versão 2 (D-033), começo enxuto do jogador, `npm run economy:proof`                                              |
| `7a6f379`, `80f25d6`, `0e9fefc` | Propostas de UX, telas ilustradas e estratégia (páginas em `docs/design/`)                                                        |
| `d7a34d0`                       | Pacote enxuto do navegador, mapa em camadas desenhadas pelo mapa, simulação ~3× mais rápida                                       |
| `10f6f3d`                       | Servidor com o mundo na memória, desfazer comando recusado, histórico arquivado (15 dias)                                         |
| `8b1a017`                       | Centro-Sul real (59 municípios IBGE), escala do mundo até ~500 bots, busca de fornecedor escalável, 3 defeitos corrigidos (D-034) |

Verificação: `npm run check` passou com 207 testes no último commit de código.

## Calibração em andamento (item 1)

Comando: `npx tsx scripts/economy-proof.ts --days=20 --seeds=0 --scale=20 --out=.runtime/geo.json` (cerca de 10 s por dia de jogo). Linhas de referência = calculadora × 20 × 0,8.

Último resultado (escala 20, 557 empresas, 20 dias):

| Cadeia             | Linhas ref / obs | Caixa dos bots por dia |
| ------------------ | ---------------- | ---------------------- |
| Minério            | 45 / 13          | −R$ 18 mil             |
| Carvão             | 43 / 17          | +R$ 6 mil              |
| Aço                | 84 / 18          | −R$ 191 mil            |
| Utensílios         | 99 / 63          | +R$ 78 mil             |
| Soja               | 76 / 57          | +R$ 261 mil            |
| Esmagamento (óleo) | 48 / 34          | −R$ 448 mil            |
| Ração              | 36 / 21          | −R$ 307 mil            |
| Leite              | 254 / 158        | +R$ 1,44 mi            |
| Arroz              | 143 / 112        | −R$ 43 mil             |
| Lojas (todas)      | —                | +R$ 233 mil            |
| Distribuidores     | —                | −R$ 243 mil            |

Procura atendida: 42% no geral; arroz 24% (Uruguaiana longe), óleo 38%, leite 42%. Aço ao governo 1,8 t/dia (alvo 16 × escala). Caminhões comprados 17 por dia (verificar se é demais).

Como investigar (funcionou nesta conversa): rastrear decisões de um tipo de bot com `withDecisionTrace` (exemplo em `.runtime/probe-steel2.ts`) e conferir uma cotação real com `quote` (`.runtime/probe-quote2.ts`). Suspeitas abertas:

- **Óleo e ração:** margem de projeto baixa (10,8% no esmagamento) somada a frete longo de soja e de farelo; conferir preço anclado (`wholesaleReference`) contra custo posto e o piso de custo.
- **Aço:** siderúrgicas ainda param por falta de insumo; verificar caixa e orçamento diário de compra (`supply-daily-budget`), pedidos diretos recusados por caixa e o código `order-delivery-ineligible` de aço.
- **Arroz:** distância de Uruguaiana às capitais; testar distribuidores no Sul e Sudeste ou polo adicional de arroz.
- **Distribuidores:** compram com frete e vendem perto da referência; precisam de margem própria.

## Estado técnico útil

- Mundo jogável: `npm run dev:v2` (porta 5186, escala 20, banco `.runtime/economy-2.sqlite`, pode ser apagado e recriado). Mundo principal (`.runtime/world.sqlite`, versão 1, 128 MB) nunca deve ser apagado nem rebalanceado.
- Escala: `createWorld(agora, { economy: 2, scale })`, `createScenario(agora, 'economy-2', semente, { scale })`; servidor lê `AFTERMARKET_WORLD_SCALE`.
- Geografia: `packages/world/src/geography-v2.ts` (municípios, polos, `hubCity`, `siteNear`); mundo usa `regionsOf(w)` e `regionFor(w, ...)`.
- Abertura: `packages/simulation/src/opening-v2.ts` (`v2PortfolioFor`, `openV2Rivals`, `openV2Carriers`, `placeV2Geography`, `normalizeV2Lot`).
- Pacote do navegador: `apps/server/src/view.ts`; totais vêm em `world.view`. Histórico arquivado: `packages/simulation/src/history.ts` e tabelas `history_*` no banco.
- Desempenho medido: 260 bots ~1,2 s por dia; 486 a 557 bots ~8 a 10 s por dia; pacote do navegador com 557 empresas 1,5 MB (197 KB comprimido) por rodada.
- Testes de navegador (`tests/e2e`) foram atualizados para o mapa novo, mas não rodaram nesta conversa.
- Scripts de sondagem em `.runtime/` (não versionados): `bench-scale.ts`, `probe-*.ts`, `prof-lines.mjs` (perfil com linhas via bundle do esbuild).
