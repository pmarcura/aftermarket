# Estado do projeto

Atualizado em **27/10/2026**. Versão **0.4.0**. Uma página: o que é verdade agora e o que vem a seguir. Detalhes e evidências ficam nos documentos de cada fase e no histórico do Git.

## Onde estamos

Etapa **A · Arrumar a casa** concluída; próxima é a **B · Redesenhar a economia** do [roteiro](ROADMAP.md). O panorama visual completo está em [`docs/raio-x.html`](../docs/raio-x.html).

O jogo roda localmente: mapa real de SP–MG, compra de imóveis, produção, estoque físico, mercado com negociação, frota com rotas rodoviárias reais, finanças com crédito e 38 empresas-bot usando os mesmos comandos dos jogadores. Build e 160 testes passam.

## O que funciona

- Mapa, estradas reais (OSRM), caminhões animados sobre a rota.
- Comprar imóvel, instalar equipamento, contratar equipe, produzir, vender.
- Pedidos e contrapropostas entre empresas, editais do governo.
- Frota própria, transferências e conexões fixas de abastecimento.
- Laboratório `/lab`: roda 30/90/365 dias de bots em 3/10/84 s e compara cenários.

## Furos conhecidos

| Área        | Problema                                                                                      | Onde está o detalhe                                               |
| ----------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Economia    | Aço só tem o governo como comprador                                                           | [ECONOMIA-HOJE](../docs/product/ECONOMIA-HOJE.md)                 |
| Economia    | Farelo sobra; quatro fazendas não pagam nem a folha                                           | idem                                                              |
| Economia    | Semente não existe (planta-se o pacote de mercado); leite sem rebanho                         | idem                                                              |
| Bots        | Três fórmulas erradas: leite, cadência do aço, demanda fracionária                            | [MATHEMATICS-AUDIT](../docs/product/MATHEMATICS-AUDIT.md) M02–M04 |
| Desempenho  | Mundo salvo como um JSON único (63 MB), regravado a cada 2 s; navegador baixa tudo a cada 3 s | etapa C do roteiro                                                |
| Multiplayer | Servidor só escuta `127.0.0.1`; perfis sem senha                                              | etapa D do roteiro                                                |
| Interface   | Sem tutorial; loja com 10 abas                                                                | etapa E do roteiro                                                |

## Próximo passo

Começar a **B · Redesenhar a economia**, primeiro no papel com o Pedro (designer e dono do produto): semente, destino do farelo, compradores do aço, nível de realismo.

Perguntas em aberto para o Pedro:

1. Formato do playtest: sessões juntas de 2–3 h ou mundo rodando a semana toda?
2. Nível de realismo: rebanho/semente/adubo ou abstrato e enxuto?
3. Fechar as duas cadeias atuais antes de adicionar produtos?

## Como rodar

| Comando                  | O que faz                                                                        |
| ------------------------ | -------------------------------------------------------------------------------- |
| `npm run dev`            | Mundo principal em http://127.0.0.1:5173 (`.runtime/world.sqlite`)               |
| `npm run dev:starter`    | Campanha iniciante separada em http://127.0.0.1:5185 (`.runtime/starter.sqlite`) |
| `npm run lab`            | Laboratório de simulação em `/lab`                                               |
| `npm run check`          | Build, testes e verificações de recursos e catálogo de telas                     |
| `npm run economy:report` | Regera os três relatórios de economia de uma vez                                 |
| `npm run world:backup`   | Backup do mundo principal                                                        |

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
