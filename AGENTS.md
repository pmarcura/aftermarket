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
- Nenhum sistema de fusões, cidade ou renderização 3D obrigatória.
- Não introduzir novas dependências ou infraestrutura sem justificar o problema resolvido.

## Organização

- `apps/web`: apresentação. Separar páginas, componentes e integrações.
- `apps/server`: API e persistência. Operações financeiras em transação.
- `packages/simulation`: regras puras com tempo injetável, sem dependência da UI.
- `packages/world`: dados geográficos e proveniência; regras de economia não pertencem aqui.
- Não copiar projeto ou criar arquivos `old`, `legacy`, `v2` ou `backup` de código. Usar o Git.
- Artefatos de execução em `.runtime` e resultados em `test-results`; não versionar bancos nem dependências.
- Preservar as referências originais. Não usar screenshots de UI como fundo do jogo.
- Antes de migrar o banco, criar backup e uma migração explícita. Nunca apagar o mundo automaticamente.

## Concluir uma fase

Executar verificações proporcionais à alteração. Para regras econômicas, testar falhas e conservação, não apenas o caminho feliz. Para interface, verificar desktop, celular, teclado e fluxo real. Atualizar requisitos, estado e validação com evidência. Registrar limitações com próxima ação concreta. Commits pequenos e coerentes; uma implementação ativa por funcionalidade.
