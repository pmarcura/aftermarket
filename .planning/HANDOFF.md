# Passagem de trabalho · 30/10/2026

Documento para continuar em outra conversa. Ler junto com `CLAUDE.md`, `AGENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md` e `docs/product/DECISIONS.md` (D-031 a D-035).

## Pedidos do Pedro ainda abertos, na ordem combinada

1. **Calibrar a economia no Brasil real com cerca de 500 bots** (escala 20). Em andamento: frete real, atacado e defeitos de escala resolvidos (D-036, commit `1288da6`); cadeia do metal destravada (D-038), ração quase empatada (D-039); falta fazendas de arroz e feijão, caminhão leve resolvido na D-041 (referência ajustada a 2 linhas). Utensílios destravados na D-040. Detalhes em "Calibração depois da D-036" abaixo.
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

Como investigar (funcionou nesta conversa): rastrear decisões de um tipo de bot com `withDecisionTrace` (exemplo em `.runtime/probe-steel2.ts`) e conferir uma cotação real com `quote` (`.runtime/probe-quote2.ts`).

**Atualização (D-036):** as suspeitas acima foram investigadas e corrigidas; resultado e o que ainda falta na seção "Calibração depois da D-036" abaixo. Sondagens rápidas em `.runtime/tmp/` (não versionadas): `snap.ts` salva o mundo de escala N em dias marcados (`--scale=20 --days=10 --tag=x`); `chain.ts a b` decompõe o resultado dos bots por especialidade entre dois retratos (caixa por tipo de lançamento, estoque formado, preço pago e recebido contra a referência); `trace.ts retrato tipo produto` conta as decisões de meio dia; `buys.ts`, `stock.ts`, `orders.ts`, `room.ts`, `quote.ts`, `gov.ts` olham remessas, estoques, pedidos pendentes, armazém, cotações e editais. Da D-038: `metal.ts retrato [tipo]` mostra unidade por unidade da cadeia (estoque, carga a caminho, pedidos, situação); `budget.ts retrato tipo` separa o orçamento gasto, prometido e o ocupado por pedidos sem vendedor; `rerun.ts retrato dias tag` roda um trecho com o código atual e conta a produção da cadeia; `nobid.ts` e `bidwatch.ts` acompanham os editais até o fechamento.

## Estado técnico útil

- Mundo jogável: `npm run dev:v2` (porta 5186, escala 20, banco `.runtime/economy-2.sqlite`, pode ser apagado e recriado). Mundo principal (`.runtime/world.sqlite`, versão 1, 128 MB) nunca deve ser apagado nem rebalanceado.
- Escala: `createWorld(agora, { economy: 2, scale })`, `createScenario(agora, 'economy-2', semente, { scale })`; servidor lê `AFTERMARKET_WORLD_SCALE`.
- Geografia: `packages/world/src/geography-v2.ts` (municípios, polos, `hubCity`, `siteNear`); mundo usa `regionsOf(w)` e `regionFor(w, ...)`.
- Abertura: `packages/simulation/src/opening-v2.ts` (`v2PortfolioFor`, `openV2Rivals`, `openV2Carriers`, `placeV2Geography`, `normalizeV2Lot`).
- Pacote do navegador: `apps/server/src/view.ts`; totais vêm em `world.view`. Histórico arquivado: `packages/simulation/src/history.ts` e tabelas `history_*` no banco.
- Desempenho medido: 260 bots ~1,2 s por dia; 486 a 557 bots ~8 a 10 s por dia; pacote do navegador com 557 empresas 1,5 MB (197 KB comprimido) por rodada.
- Testes de navegador (`tests/e2e`) foram atualizados para o mapa novo, mas não rodaram nesta conversa.
- Scripts de sondagem em `.runtime/` (não versionados): `bench-scale.ts`, `probe-*.ts`, `prof-lines.mjs` (perfil com linhas via bundle do esbuild).

## Calibração depois da D-036 (31/10/2026)

Commits: `1288da6` (economia, D-036) e `edf70da` (rotas pela entrada dos imóveis, D-037). Resultado completo em [PROVA-V2-ESCALA-20](../docs/product/PROVA-V2-ESCALA-20.md); página visual em `docs/calibracao-brasil.html`. Comando: `npx tsx scripts/economy-proof.ts --days=20 --window=10 --seeds=0 --scale=20 --out=.runtime/geo-x.json` (cerca de 4 min). Linhas de referência = calculadora × escala; bots abrem com 80%.

| Medida (últimos 10 de 20 dias) | Código anterior                  | Agora                     |
| ------------------------------ | -------------------------------- | ------------------------- |
| Procura atendida               | 34%                              | 38%                       |
| Arroz nas lojas                | 12%                              | 49%                       |
| Empresas quebradas             | 6                                | 0                         |
| Aço ao governo                 | 0 t/dia                          | 11,7 t/dia (meta 320)     |
| Lojas / distribuidores         | −R$ 520 mil / −R$ 26 mil por dia | +R$ 367 mil / +R$ 469 mil |

Próximos passos, em ordem:

1. ~~Cadeia do metal a ~15%~~ **resolvida na D-038** (commit `5c8c36f`): a causa era o orçamento das usinas ocupado por pedidos abertos sem resposta, não o tempo de viagem do carvão. Duas sementes (`.runtime/geo-m0.json`, `geo-m1.json`): aço 68 de 105 linhas, siderúrgicas +R$ 475 mil/dia, aço ao governo 213 t/dia (meta 320), procura atendida 50%. Sobra: editais de 24 t expiram sem lance porque nenhuma usina junta 24 t; utensílios (−R$ 58 mil/dia) e caminhão leve (−R$ 67 mil/dia) ficaram no vermelho com o aço mais disputado.
2. ~~Ração~~ **quase empatada na D-039** (−R$ 20 mil/dia; `.runtime/geo-g0.json`, `geo-g1.json`): regra de carga que valha a viagem e ração a R$ 3,11/kg. Texto anterior: as fábricas de Patos de Minas compram farelo de Rondonópolis a ~1.170 km (R$ 480/t de frete, mais que os R$ 172/t da calculadora). Ou aproximar fábricas de ração dos esmagadores, ou ajustar a distância de projeto do farelo.
3. **Arroz e feijão nas fazendas:** formam estoque e vendem a 92% da referência; conferir se a procura das lojas já alcança a produção.
4. **Leite atendido em 35%:** depende da ração.
5. Ruído entre rodadas é grande (aço ao governo variou de 11,7 a 32,7 t/dia com o mesmo código); usar 2 ou 3 sementes antes de concluir.

Pacote do navegador no mundo principal: 2,7 MB por atualização, sem compressão observada na resposta (`Accept-Encoding: gzip` devolveu o mesmo tamanho); conferir na etapa C.
