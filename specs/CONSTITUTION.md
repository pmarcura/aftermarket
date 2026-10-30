# Constituição do AFTERMARKET · regras que toda spec obedece

Versão 1 · 30/10/2026 · Donos: John (produto, desde a posse) e a equipe de desenvolvimento. Substitui, para fins de processo, o fluxo "Game-GSD" de `docs/DEVELOPMENT.md`; os princípios econômicos de `AGENTS.md` continuam válidos e estão repetidos aqui onde importam.

## 1. Objetivo até janeiro de 2027

Um mundo hospedado, com login por convite, em que 5–50 pessoas jogam ao mesmo tempo contra ~500 empresas-bot, sem exploit óbvio de preço e sem travar. Tudo o que não serve a isso espera o playtest. Lista explícita do que fica fora: genética, gado/frigorífico, leilões, contratos recorrentes, frete por jogador, modelo de grupo completo, metas/medalhas persistidas, celular, Postgres/Supabase, perfil de caminhão no roteador, arte final.

## 2. Processo (spec-driven)

- Toda mudança não trivial nasce como `specs/NNN-slug/` com três arquivos: `spec.md` (o quê e por quê: problema, requisitos numerados `R1…`, critérios de aceite verificáveis `A1…`, fora de escopo), `plan.md` (como: abordagem, arquivos tocados, riscos, ordem) e `tasks.md` (checklist executável com estado `[ ]`/`[x]`, cada tarefa com o critério que satisfaz).
- Ordem obrigatória: spec aprovada → plan → tasks → código → verificação → atualização de `specs/README.md` (estado) e de `docs/product/DECISIONS.md` quando houver decisão de produto.
- Uma spec cabe em uma ou duas semanas. Maior que isso, dividir.
- Um branch por spec (`spec/NNN-slug`), commits pequenos com prefixo `spec-NNN:`. A spec só fecha com `npm run check` verde e os critérios de aceite marcados com evidência (comando + resultado).
- Decisões de produto registradas em `DECISIONS.md` com número `D-0xx`; decisões técnicas reversíveis ficam no `plan.md` da spec.

## 3. Invariantes do jogo (não negociáveis)

1. Dinheiro em centavos inteiros; toda mutação de saldo passa por `transfer()`; a soma de todos os saldos é constante. Uma spec que toque dinheiro inclui teste de conservação.
2. Interface nunca altera saldo, estoque, titularidade ou prazos: só o servidor, via comandos idempotentes.
3. Humanos e bots usam os mesmos comandos e as mesmas verificações. Nenhum atalho para bot.
4. Estoque é físico: lotes reservados antes de transporte ou produção; espaço no destino conta cargas a caminho.
5. Parâmetros de balanceamento vivem em uma temporada versionada (`season.config`), nunca em constantes soltas no código. Mudar balanceamento = nova temporada, nunca edição de mundo salvo.
6. Informação real, parâmetro simulado e estimativa são identificados como tais.
7. Nenhum controle na interface que só mostre uma notificação sem executar a ação.
8. Uma única economia (versão 2). Não existe mais mundo v1 (D-042).
9. Nunca apagar `.runtime/world.sqlite` nem `.runtime/backups` de ninguém; scripts e testes nunca abrem o banco de um jogador.

## 4. Qualidade mínima

- `npm run check` (build, testes, verificação de recursos) verde em todo merge; e2e em Chromium rodando em CI.
- Novo código em TypeScript estrito sem `!` em dados que podem faltar; campos do `World` não são opcionais depois da migração.
- Sem dependência nova sem justificar o problema que resolve no `plan.md`.
- Sem cópia de regra do motor no cliente: o cliente importa funções exportadas pelo motor.
- Testes de motor usam mundos de `createWorld()`/`createScenario()` em memória; nunca o banco.
- Nomes: português nas features novas; não renomear o legado por capricho.

## 5. O que o laboratório é

`/lab` (simulações, A/B, telemetria) e `scripts/economy-proof.ts` são a ferramenta oficial de balanceamento. A régua é: 5 sementes, 60 dias de jogo, janela de 30, escala do mundo jogável; aceitar uma mudança só se a mediana melhora e o pior caso não piora nos KPIs definidos na spec 003. A cadeia de "evidência visual de interface" (`capture-lab`, `ui-catalog`, `ui-flows`) está congelada e fora do `check` (spec 002).
