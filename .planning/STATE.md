# Estado do projeto

Atualizado em **28/10/2026**. Versão **0.4.0**. Uma página: o que é verdade agora e o que vem a seguir. Detalhes e evidências ficam nos documentos de cada fase e no histórico do Git.

## Onde estamos

Etapas **A · Arrumar a casa** e **B · Redesenhar a economia** concluídas; parte da **E** (primeira hora) adiantada a pedido do Pedro. Próximas: **C · Motor que aguenta** e **D · Jogar junto** do [roteiro](ROADMAP.md), que faltam para o playtest com amigos. O panorama visual completo está em [`docs/raio-x.html`](../docs/raio-x.html).

O jogo roda localmente: mapa real de SP–MG, compra de imóveis, produção, estoque físico, mercado com negociação, frota com rotas rodoviárias reais, finanças com crédito e empresas-bot usando os mesmos comandos dos jogadores. O mundo jogável da economia versão 2 (`npm run dev:v2`) tem 30 rivais em todas as especialidades, começo enxuto (loja vazia e R$ 1 milhão) e guia de primeiros passos. Build e 203 testes passam.

## O que funciona

- Mapa, estradas reais (OSRM), caminhões animados sobre a rota.
- Comprar imóvel, instalar equipamento, contratar equipe, produzir, vender.
- Pedidos e contrapropostas entre empresas, editais do governo.
- Frota própria, transferências e conexões fixas de abastecimento.
- Laboratório `/lab`: roda 30/90/365 dias de bots em 3/10/84 s e compara cenários.

## Furos conhecidos

| Área        | Problema                                                                                                                                 | Onde está o detalhe                               |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Economia v2 | Montadoras de caminhão com pouca procura; aço ao governo abaixo das 16 t/dia                                                             | [PROVA-V2](../docs/product/PROVA-V2.md), D-033    |
| Mundo v2    | Só 12 lotes livres e os dois jogadores de teste começam em Campinas                                                                      | etapa D (uma cidade e lotes por amigo)            |
| Economia v1 | O mundo principal salvo segue a economia antiga (aço só para o governo, farelo sobrando)                                                 | [ECONOMIA-HOJE](../docs/product/ECONOMIA-HOJE.md) |
| Desempenho  | Mundo salvo como um JSON único, regravado a cada 2 s; navegador baixa tudo a cada 3 s; ~2 s de cálculo por dia de jogo no fim de 90 dias | etapa C do roteiro                                |
| Multiplayer | Servidor só escuta `127.0.0.1`; perfis sem senha                                                                                         | etapa D do roteiro                                |
| Interface   | Loja com 9 abas; sem mural de notícias nem ranking                                                                                       | etapa E do roteiro                                |

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
