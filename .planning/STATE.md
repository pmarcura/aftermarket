# Estado do projeto

Atualizado em **05/11/2026**. Versão **0.4.0**. Uma página: o que é verdade agora e o que vem a seguir.

## Recomeço

O Pedro passou a liderar o projeto em 05/11/2026; o João (John) parou de atualizar. Todo o trabalho dos dois está no `main`, e o estado completo anterior ao recomeço ficou guardado na marca `fim-era-john` do Git (inclui as specs 001–014, as fases antigas e os rascunhos de design).

A pasta foi limpa: sem cópias antigas do mundo, sem processo antigo de specs e fases, sem rascunhos. Ficaram o código do jogo, as regras (`AGENTS.md`), as decisões de produto, os padrões da economia, a identidade visual, a landing, os vídeos e o Discord.

## O que o jogo já tem

- Mapa real do Centro-Sul do Brasil, com estilo pixel e cidades clicáveis.
- Compra de imóveis, produção, estoque físico, mercado com negociação, frota e finanças com crédito.
- Empresas-bot usando os mesmos comandos dos jogadores; uma única economia (D-042) com começo enxuto (loja vazia e R$ 1 milhão).
- Telas Início, Loja e Negócios na direção Livro-caixa; diário que grava só o que mudou a cada clique.
- Landing, vídeos de divulgação e servidor no Discord com bot administrativo.

## Limites conhecidos

- Roda só no computador local; não há login nem servidor para amigos jogarem juntos.
- O motor ainda pode travar a API em mundos grandes.
- A cidade de perto depende do pacote MODERN TOWN SET, fora do Git por licença: copie de `D:\MODERN TOWN SET` para `apps/web/public/arte/town`. Sem ele, o mapa funciona sem os prédios desenhados.

## Próximo passo

Definir com o Pedro o novo roteiro em `.planning/ROADMAP.md`.
