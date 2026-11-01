@AGENTS.md

## Trabalhar com o Pedro

- Pedro é designer e dono do produto, não programador. Falar em português simples, sem jargão; explicar consequências para o jogador, não detalhes de código.
- Mostrar visualmente quando ajudar: diagramas, tabelas, páginas. O panorama do projeto está em `docs/raio-x.html`.
- Decisões de design são dele (realismo, cadeias, interface). Matemática, código, simulação e organização são do Claude, que deve recomendar em vez de listar opções.
- Imagens são geradas pelo Pedro no GPT a partir de prompts do Claude, só depois que a lista de produtos estiver fechada.

## Atalhos

- Estado em uma página: `.planning/STATE.md`. Roteiro A–F: `.planning/ROADMAP.md`.
- Economia em linguagem simples: `docs/product/ECONOMIA-HOJE.md`; relatórios técnicos regenerados por `npm run economy:report`.
- Uma economia só (D-042). `npm run dev` abre o mundo `playtest` em `.runtime/world.sqlite`; `AFTERMARKET_WORLD_SCALE=20` dá o mundo grande (~550 bots). Para jogar sem tocar no mundo principal, use outro `AFTERMARKET_DB_FILE`. Configurações do painel de navegador em `.claude/launch.json`.
- Repositório remoto: github.com/pmarcura/aftermarket. Cada spec tem seu branch (`spec/NNN-slug`) e vira um PR para `main`.
