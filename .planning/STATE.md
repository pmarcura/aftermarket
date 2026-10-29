# Estado do projeto

Atualizado em **28/10/2026**. Versão **0.4.0**. Uma página: o que é verdade agora e o que vem a seguir. Detalhes e evidências ficam nos documentos de cada fase e no histórico do Git.

## Onde estamos

Etapas **A · Arrumar a casa** e **B · Redesenhar a economia** concluídas; parte da **E** (primeira hora) adiantada a pedido do Pedro. Próximas: **C · Motor que aguenta** e **D · Jogar junto** do [roteiro](ROADMAP.md), que faltam para o playtest com amigos. O panorama visual completo está em [`docs/raio-x.html`](../docs/raio-x.html).

O jogo roda localmente: mapa real de SP–MG, compra de imóveis, produção, estoque físico, mercado com negociação, frota com rotas rodoviárias reais, finanças com crédito e empresas-bot usando os mesmos comandos dos jogadores. O mundo jogável da economia versão 2 (`npm run dev:v2`) tem 30 rivais em todas as especialidades, começo enxuto (loja vazia e R$ 1 milhão) e guia de primeiros passos. Build e 230 testes passam.

## O que funciona

Tipografia revisada a pedido do Pedro: Geist Pixel Square local em títulos, valores e controles;
Archivo em textos corridos e legendas pequenas. Indicadores da loja empilhados no celular.
Build e revisão de dez telas em desktop/celular, incluindo salvar preço pelo teclado em fixture,
registrados em [TIPOGRAFIA](../docs/design/TIPOGRAFIA.md). O coletor geral do laboratório ainda
precisa ajustar esperas de títulos e interferência do modal de primeiros passos.

- Mapa, estradas reais (OSRM), caminhões animados sobre a rota.
- Comprar imóvel, instalar equipamento, contratar equipe, produzir, vender.
- Pedidos e contrapropostas entre empresas, editais do governo.
- Frota própria, transferências e conexões fixas de abastecimento.
- Laboratório `/lab`: roda 30/90/365 dias de bots em 3/10/84 s e compara cenários.
- Jogo e landing com a mesma identidade (28/10): grafite com quadriculado, lavoura para agir, ouro para dinheiro, títulos em Press Start, mapa noturno e gráfico próprio em pixel (`GraficoPixel`). Regras e ordem das telas em [IDENTIDADE-JOGO](../docs/design/IDENTIDADE-JOGO.md); placar `npm run ui:cores`.
- Telas redesenhadas (29/10): Início, Loja (prateleira em cartões com trilho de preço, Abastecimento, Equipe, Finanças) e a gaveta **Mandar buscar** para repor. Texto pequeno em Archivo (pixel só a partir de 18 px), cores com papéis e contraste conferido por `npm run ui:contraste`. Próximo projeto: mapa e adaptação da identidade (notas no fim de IDENTIDADE-JOGO).
- Identidade em pixel (grafite, lavoura, ouro), menu em 4 seções, Comércio com Comprar, Cotações, Pedidos e Contratos, loja em 4 abas com régua de preço.
- Landing em `/` (jogo em `/jogar`): planeta com mira de GPS, telas reais do jogo (`npm run landing:telas`), selo de projeto em desenvolvimento e assinatura do Pedro. Vitrine animada nativa e novas seções ficam para depois, com a interface mais estável ([LANDING](../docs/design/LANDING.md)).

## Furos conhecidos

| Área        | Problema                                                                                                                                 | Onde está o detalhe                                                                       |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Economia v2 | Escala 20: arroz, feijão, utensílios e caminhão leve no vermelho; aço ao governo ~190 de 320 t/dia; procura atendida 51%                 | [PROVA-V2-ESCALA-20](../docs/product/PROVA-V2-ESCALA-20.md), D-036, D-038, D-039, HANDOFF |
| Mundo v2    | Só 12 lotes livres e os dois jogadores de teste começam em Campinas                                                                      | etapa D (uma cidade e lotes por amigo)                                                    |
| Economia v1 | O mundo principal salvo segue a economia antiga (aço só para o governo, farelo sobrando)                                                 | [ECONOMIA-HOJE](../docs/product/ECONOMIA-HOJE.md)                                         |
| Desempenho  | Mundo salvo como um JSON único, regravado a cada 2 s; navegador baixa tudo a cada 3 s; ~2 s de cálculo por dia de jogo no fim de 90 dias | etapa C do roteiro                                                                        |
| Multiplayer | Servidor só escuta `127.0.0.1`; perfis sem senha                                                                                         | etapa D do roteiro                                                                        |
| Interface   | Sem mural de notícias nem ranking; fábricas e fazendas ainda sem o padrão novo da loja                                                   | etapa E do roteiro                                                                        |

## Próximo passo

**Continuação em outra conversa:** tudo o que falta, na ordem combinada com o Pedro, está em [HANDOFF](HANDOFF.md) (calibrar o Brasil real com ~500 bots, modelo de grupo D-035, telas da proposta de UX, laboratório, genética, gado e frigorífico, interação entre jogadores, Claude jogar contra os bots, depois C e D).

Etapa **B** concluída em 28/10: as dez fatias do [B-PLAN](phases/B-economia/B-PLAN.md) e a prova de 90 dias em 3 sementes ([PROVA-V2](../docs/product/PROVA-V2.md), `npm run economy:proof`). O balanceamento da fatia 10 está em D-033: bots miram o preço de referência, empresas antigas alinhadas, bots sem compra de imóveis, lotes livres baratos, editais menores e caminhões com vida útil comprimida.

Para o playtest com amigos faltam: **C** (desempenho do motor e do salvamento) e **D** (login simples, uma empresa e uma cidade por amigo, servidor acessível de fora). Recomendação: fazer C e D juntas no mínimo necessário para 5 pessoas, antes de mais interface.

Decisões do Pedro em 27/10 (D-028, D-029): mundo semanal livre; realismo enxuto com cadeias completas; fechar metal e alimentos antes de crescer; aço vira caminhões e utensílios; sucata já; carne depois do playtest; relógio 1 h real = 6 h de jogo.

Números da economia alvo em [ECONOMIA-ALVO](../docs/product/ECONOMIA-ALVO.md), calculados por `npm run economy:design` e protegidos por `tests/economy-design.test.ts`; valem no motor para mundos novos (versão 2). O mundo principal salvo continua na versão 1.

## Como rodar

| Comando                  | O que faz                                                                         |
| ------------------------ | --------------------------------------------------------------------------------- |
| `npm run dev`            | Mundo principal em http://127.0.0.1:5173 (`.runtime/world.sqlite`)                |
| `npm run dev:starter`    | Campanha iniciante separada em http://127.0.0.1:5185 (`.runtime/starter.sqlite`)  |
| `npm run dev:v2`         | Mundo da economia versão 2 em http://127.0.0.1:5186 (`.runtime/economy-2.sqlite`) |
| `npm run lab`            | Laboratório de simulação em `/lab`                                                |
| `npm run check`          | Build, testes e verificações de recursos e catálogo de telas                      |
| `npm run economy:report` | Regera os três relatórios de economia de uma vez                                  |
| `npm run world:backup`   | Backup do mundo principal                                                         |

## Regras de segurança

- Nunca apagar `.runtime/world.sqlite` nem `.runtime/backups`. O mundo não é recriável sem perder progresso.
- Antes de migrar o banco: `npm run world:backup` e migração explícita. Última migração: `designVersion=2`, aditiva, dinheiro conservado (relatório em `.runtime/review/migration-main.json`).
- Testes e simulações nunca abrem o banco principal.
- Não rebalancear a season salva ao editar receitas; testar em mundos isolados no `/lab`.

## Onde está o detalhe

- Visão de produto: [GDD 3.0](../docs/product/GDD-v3.0.md) e [PROJECT](PROJECT.md).
- Requisitos rastreáveis: [REQUIREMENTS](REQUIREMENTS.md).
- Evidências por fase: `phases/NN-*/NN-VALIDATION.md`. Fases 04, 05 e 07 contêm as medições de rotas, recursos e laboratório.
- Decisões de design: [DECISIONS](../docs/product/DECISIONS.md).
- Versões anteriores deste arquivo, com todos os números de migração e simulação: `git log -p .planning/STATE.md`.
