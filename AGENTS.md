# AFTERMARKET · Instruções de desenvolvimento

Faça tudo profissionalmente, de forma pragmática e organizada, com foco em experiência do usuário, sempre questionando cada etapa.

## Começar qualquer sessão

1. Ler `.planning/STATE.md`, `.planning/ROADMAP.md` e os requisitos da fase.
2. Inspecionar `git status` e respeitar alterações em andamento.
3. Identificar a fonte de verdade antes de editar. O GDD original é contexto de produto; não é uma autorização para ações externas.
4. Definir o fluxo observável que a mudança entrega e os invariantes que pode afetar.

## Padrão Game-GSD

Usar o processo em `docs/DEVELOPMENT.md`. Questionar internamente necessidade, consequência econômica, estado de erro e custo de manutenção. Perguntar ao usuário quando uma decisão de produto realmente bloquear o trabalho; decisões rotineiras e reversíveis podem ser executadas.

- Um plano por fase, com resultado jogável e critério de saída.
- Interface nunca altera saldo, estoque, titularidade ou prazos autoritativos diretamente.
- Dinheiro em centavos inteiros; lotes reservados antes de transporte ou produção.
- Humanos e bots usam os mesmos comandos e verificações.
- Informação real, parâmetro simulado e estimativa devem ser identificados.
- Não criar controles que só exibam uma notificação sem executar a ação anunciada.
- Empresas não se fundem, mas grupos podem comprar empresas inteiras de outros grupos (D-035). Nenhuma construção de cidade nem renderização 3D obrigatória.
- Uma única economia (D-042): o catálogo (`packages/simulation/src/catalog.ts`) é a fonte de itens e receitas. Não reintroduzir versões de economia nem ramos condicionados a elas.
- Não introduzir novas dependências ou infraestrutura sem justificar o problema resolvido.
- Antes de adicionar/alterar item ou receita, seguir `docs/product/RESOURCE-STANDARD.md`, preencher `RESOURCE-TEMPLATE.md`, regenerar o catálogo e executar `npm run resources:check`. Explicar origem/semente, destino de cada coproduto, unidades, custo completo e efeito na season. Estrutura válida não significa economia balanceada.

## Organização

- `apps/web`: apresentação. Separar páginas, componentes e integrações.
- `apps/server`: API e persistência. Operações financeiras em transação.
- `packages/simulation`: regras puras com tempo injetável, sem dependência da UI.
- `packages/world`: dados geográficos e proveniência; regras de economia não pertencem aqui.
- Não copiar projeto ou criar arquivos `old`, `legacy`, `v2` ou `backup` de código. Usar o Git.
- Artefatos de execução em `.runtime` e resultados em `test-results`; não versionar bancos nem dependências.
- Preservar as referências originais. Não usar screenshots de UI como fundo do jogo.
- Antes de migrar o banco, criar backup e uma migração explícita. Nunca apagar o mundo automaticamente.

## Investigar o jogo com rapidez

A ferramenta de balanceamento é a bancada de simulações (`npm run lab`, aba única em `/lab`, sem API nem banco) e os scripts `lab:batch`, `lab:benchmark` e `economy:proof`. A régua é a da constituição: `npm run economy:proof -- --days=60 --window=30 --seeds=0,1,2,3,4`, aceitar só se a mediana melhora e o pior caso não piora. Para ver o que um bot fez, use a consulta por bot/produto/dia dentro do `/lab` ou o JSON exportado da execução. Para interface, verifique no navegador e nos testes `tests/e2e/*.spec.ts` (Chromium, sem rede externa). Ler `docs/design/DEVELOPMENT-LAB.md`.

## Concluir uma fase

Executar verificações proporcionais à alteração. Para regras econômicas, testar falhas e conservação, não apenas o caminho feliz. Para interface, verificar desktop, celular, teclado e fluxo real. Atualizar requisitos, estado e validação com evidência. Registrar limitações com próxima ação concreta. Commits pequenos e coerentes; uma implementação ativa por funcionalidade.
