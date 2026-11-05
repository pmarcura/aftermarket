# AFTERMARKET · Instruções de desenvolvimento

Simulador de negócios no mapa real do Brasil. O Pedro lidera o projeto (desde 05/11/2026). Trabalhar de forma profissional, pragmática e organizada, com foco em quem joga, questionando cada etapa.

## Começar qualquer sessão

1. Ler `.planning/STATE.md` e `.planning/ROADMAP.md`.
2. Ver `git status` e respeitar alterações em andamento.
3. Definir o que o jogador vai ver ou conseguir fazer com a mudança, e o que ela pode quebrar.

## Como trabalhar

- Uma mudança por vez, num branch próprio (`feat/…`, `fix/…`, `design/…`), que vira um PR para `main`.
- Commits pequenos e coerentes. Decisões de produto vão para `docs/product/DECISIONS.md` com número `D-0xx`.
- Perguntar ao Pedro só quando uma decisão de produto bloquear o trabalho; decisões técnicas reversíveis podem ser tomadas.
- Não introduzir dependência ou infraestrutura nova sem dizer qual problema ela resolve.

## Regras do jogo que não mudam

1. Dinheiro em centavos inteiros; toda mudança de saldo passa por `transfer()`; a soma dos saldos é constante. Mexeu em dinheiro, testa a conservação.
2. A interface nunca altera saldo, estoque, titularidade ou prazos: só o servidor, por comandos.
3. Humanos e bots usam os mesmos comandos e as mesmas verificações.
4. Estoque é físico: lotes reservados antes de transporte ou produção.
5. Balanceamento vive na temporada (`season.config`), nunca em constantes soltas nem em mundo salvo.
6. Informação real, parâmetro simulado e estimativa aparecem identificados.
7. Nenhum botão que só mostra um aviso sem executar a ação.
8. Uma única economia (D-042): `packages/simulation/src/catalog.ts` é a fonte de itens e receitas.
9. Empresas não se fundem, mas grupos podem comprar empresas inteiras (D-035). Sem construção de cidade nem 3D obrigatório.
10. Nunca apagar `.runtime/world.sqlite` nem backups sem o Pedro pedir. Antes de mudar o formato do banco: backup e migração explícita.

Antes de adicionar ou alterar item ou receita: seguir `docs/product/RESOURCE-STANDARD.md`, preencher `RESOURCE-TEMPLATE.md`, regenerar o catálogo e rodar `npm run resources:check`. Estrutura válida não significa economia balanceada.

## Organização

- `apps/web`: interface (páginas, componentes, integrações).
- `apps/server`: API e persistência; operações financeiras em transação.
- `packages/simulation`: regras puras, tempo injetável, sem depender da interface.
- `packages/world`: dados geográficos e proveniência; regras de economia não pertencem aqui.
- `scripts`: ferramentas (relatórios, laboratório, captura da landing, vídeos em `scripts/video`).
- `.runtime` (banco, testes) e `output` (vídeos gerados) ficam fora do Git.
- Não criar arquivos `old`, `legacy`, `v2` ou `backup` de código: o Git guarda o histórico. O estado anterior ao recomeço está na marca `fim-era-john`.
- Preservar o GDD e as referências originais (`docs/product/GDD-v3.0.md`, `docs/references`).

## Balanceamento

Ferramentas: bancada `npm run lab` (`/lab`, sem API nem banco), `lab:batch`, `lab:benchmark` e `economy:proof`. Régua: `npm run economy:proof -- --days=60 --window=30 --seeds=0,1,2,3,4`, e só aceitar uma mudança se a mediana melhora e o pior caso não piora. Detalhes em `docs/design/DEVELOPMENT-LAB.md` e `docs/product/PROVA.md`.

## Concluir uma mudança

- `npm run check` (build, testes, recursos) e `npm run format:check` verdes.
- Interface: conferir no navegador, no PC e no celular, e nos testes `tests/e2e/*.spec.ts`.
- Economia: testar falhas e conservação, não só o caminho feliz.
- Atualizar `.planning/STATE.md` com o que mudou e o próximo passo.
