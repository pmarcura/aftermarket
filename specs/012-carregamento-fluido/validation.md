# Validação 012 · Carregamento e navegação

Investigação de 03/11/2026. Pedido: alinhar a pasta às melhorias do João e investigar
travadas no novo Início do Claude, antes de iniciar uma partida.

## Alinhamento com o GitHub

`git fetch origin --prune` executado. `origin/main` está em `aa6661e`; o ramo
`design/estrutura-telas`, em `c8b2aa0`, tem zero commits atrasados e sete commits de
design à frente. Não havia alterações locais antes desta investigação.

A spec 005 de John está integrada pelo merge `aa35efc`,
[PR #6](https://github.com/pmarcura/aftermarket/pull/6), ancestral do ramo atual.
Não havia diferenças em `apps/server` e `packages/simulation` contra o main na
abertura. A spec 005 explicitamente não inclui servidor, view nem serialização.
As correções de conexão e o mapa pixel do trabalho anterior estão no ramo
`pedro/mapa-3d`, separado do design (D-043). Não foi feito merge desse ramo.

## Observações e causas

O mundo da prévia (`design-b.sqlite`) roda a 120× com 550 empresas, mesmo sem ações
do jogador: um dia de jogo dura 12 minutos reais. A primeira leitura em SQLite
somente leitura encontrou 157.946.019 bytes de estado e 503.968 lançamentos.
A simulação continuou avançando durante as medições; a última amostra tinha
172.700.028 bytes e 545.801 lançamentos. Nenhum banco foi apagado ou recriado.

| Problema comprovado                                         | Consequência                                         | Ação                                                                                                                            |
| ----------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| GET `/api/world` chamava `store.tick()`                     | Ler a tela disputava a thread com o avanço econômico | Leitura usa `store.read()`; tick periódico continua autoritativo                                                                |
| Indicadores repetiam filtragem do extrato para cada produto | Primeira projeção custou 1.448 ms                    | Indicadores globais uma vez; concentração por produto numa passagem, com igualdade numérica testada                             |
| Gzip do caminho original usava U+0008 em vez de `\b`        | O regex nunca reconhecia Accept-Encoding             | Regex corrigido e compressão assíncrona, confirmada por headers e testes HTTP                                                   |
| Projeção/JSON/gzip repetidos em consultas iguais            | CPU desperdiçada sem mudança do mundo                | Cache por mundo/revisão/empresa: até duas empresas, orçamento de 16 MiB; snapshot imutável                                      |
| Pregão fazia até oito consultas em paralelo                 | Oito varreduras e respostas repetidas                | Consulta agrupada numa passagem, mesmos limites e ordem; endpoint individual mantido                                            |
| Histórico transmitia campos completos do ledger             | Bytes sem uso nos cartões/perfis                     | Contrato agrupado leva apenas os seis campos consumidos das negociações; amostras conservadas                                   |
| Polling sobrepunha chamadas e não tinha deadline            | Fila crescente e conexão sem fim                     | Uma tentativa por empresa, 15 s para fetch/corpo, retry explícito cancela pendente; chamadas antigas não trocam empresa/revisão |
| Polling em aba oculta                                       | CPU/rede sem jogador olhando                         | Pausado; ao voltar à aba consulta imediatamente                                                                                 |
| Duas APIs locais estavam rodando                            | Mundos diferentes competiam por CPU/memória/disco    | Encerrada a instância extra criada nesta conversa; apenas a API da prévia de design permaneceu                                  |
| Prévia de desenvolvimento                                   | Mais módulos, transformação e verificações de React  | Prévia compilada adicional na 5192, mesma API 3011 e mesmo mundo                                                                |

Backup consistente antes de reiniciar a prévia:
`.runtime/backups/pre-performance-1793730113547.sqlite`. O catálogo, o motor, as
receitas e os parâmetros da season não foram alterados.

## Medições e alcance

Artefatos em `test-results/performance/`; dados de trabalho em `.runtime/performance/`.

- Antes, HTTP da prévia: mundo excedeu 20 s; histórico e health excederam 10 s.
- Depois das primeiras correções: leitura fria do mundo 6,90 s, mostrando que os
  outros bloqueios ainda existiam. Após otimizar indicadores, uma leitura fria
  levou 5,32 s; repetida 155 ms; health 2,6 ms. São observações do mundo em execução,
  sem distribuição estatística de latência.
- Histórico de oito produtos: pacote completo não comprimido de 2.563.647 bytes;
  o agrupado com campos necessários e gzip chegou com 70.579 bytes em 27,9 ms.
  Os headers confirmaram `Content-Encoding: gzip`. Não se atribui toda essa
  redução a uma única otimização: agrupamento, seleção de campos e compressão.
- Projeção fria observada: 1.448 ms antes e 190–204 ms depois. Os snapshots tinham
  tamanhos diferentes, pois a simulação continuou; não é A/B de mundo idêntico.
  A equivalência de todos os indicadores é verificada em mundo controlado.
- No mesmo snapshot congelado da última medição, cinco projeções/JSON/gzip
  repetidos custaram 75–88 ms cada; reuso do pacote 0,001–0,008 ms. Mede reuso de
  resposta em processo, não tempo HTTP, primeira visita nem FPS.
- Serializar o estado inteiro de 172,7 MB custou **1.281 ms**, sem contar a
  gravação no SQLite. Esse bloqueio ainda existe e é uma prioridade da engenharia.
- Navegador isolado com a mesma fixture de view: desenvolvimento 120 solicitações,
  primeiro conteúdo em 220 ms, tela pronta em 1.024 ms; compilado 46 solicitações,
  primeiro conteúdo em 68 ms e tela pronta em 910 ms. Navegar para Empresa levou
  505/363 ms. Uma execução por modo, API/DB/rede externa interceptados: mede entrega
  e renderização do frontend, não latência do servidor nem FPS. Sem erros de página.

Reproduzir (mantendo APIs de teste isoladas):

```powershell
npx tsx scripts/benchmark-serving.ts --db=.runtime/design-b.sqlite
# O benchmark apenas lê; não importa store nem executa advance.
# Com Vite dev em 5191 e Vite preview em 5192:
npx tsx scripts/benchmark-page.ts
```

## Verificações

Build e 264 testes em 35 arquivos aprovados. `resources:check`: estrutura válida,
catálogo atual, 38 avisos econômicos já existentes; não significa balanceamento.
Dez cenários distintos de navegador aprovados: titularidade/análise,
navegação desktop e celular, Início com 550 empresas em desktop e celular,
contratos HTTP/gzip, timeout/reconexão, duas origens das notificações de entrega e
compra/frete/entrega/produção com persistência após recarga.
Executados no Edge (motor Chromium), pois o Chromium separado do Playwright não
estava instalado; rede externa bloqueada pelas fixtures do projeto.

O teste financeiro expôs uma corrida de inicialização do harness: a página Vite
estava pronta antes da API, e o primeiro GET retornava 502 com corpo vazio. O
Playwright passou a aguardar `/api/health` da API e o frontend separadamente.
Após corrigir a espera pela API, esse fluxo passou; a rodada final teve cinco
testes aprovados, incluindo o fluxo financeiro real.

## O que ainda impede uma melhora grande e sustentada

1. **Motor e persistência no mesmo event loop da API.** Um tick e a serialização
   síncrona podem interromper inclusive health. Próxima frente: motor autoritativo
   num worker/processo com fila serial de comandos e snapshots imutáveis para a
   API. Provar ordem, idempotência, conservação e recuperação antes de trocar.
2. **Estado monolítico.** Regravar mais de 170 MB a cada gravação tem custo crescente.
   Migrar explicitamente, com backup, para persistência incremental de ledger,
   lotes, cargas e unidades em transação. Não reduzir retenção ou durabilidade
   silenciosamente para obter um número de desempenho melhor.
3. **Pacote de view completo.** O cliente ainda recebe cerca de 2,16 MB JSON bruto
   por revisão (306 KB gzip). Próximo passo: atualização por domínio/tela ou delta
   com ressincronização completa testada, mantendo reserva/titularidade autoritativas.
4. **Velocidade de teste.** 120× e 550 empresas não é um mundo vazio. A opção já
   prevista de 6× vale apenas para mundo novo; não foi aplicada à season atual.
   Ajuda a validar interface com menos rodadas por minuto, mas não substitui as
   correções estruturais nem a prova de escala 20.
5. **Mapa e módulos grandes.** MapLibre e gráficos continuam sendo os maiores
   chunks (aprox. 1,30 MB e 667 KB). Medir entrada no mapa e remounts numa frente
   própria, sem trazer todo o ramo de mapa 3D como remendo de desempenho do Início.

Meta proposta para a próxima frente: mediana e p95 HTTP/tempo até conteúdo com
cinco jogadores, 550 bots e 30 dias; event-loop delay durante tick, comando e save;
nenhuma regressão econômica. O aceite da arquitetura cabe à frente de engenharia;
estas correções não concluem as specs 006/007 nem um playtest multiplayer.

## Continuação: persistência incremental e operações (03/11)

O pedido seguinte ampliou o escopo para compras e reconexões. O ledger representava 148,9 MB dos 185,5 MB do mundo. Toda operação clonava esse conteúdo e o regravava; callbacks de rota também regravavam o snapshot inteiro.

A migração storageFormat=1 extrai os lançamentos para world_ledger, inserindo apenas os novos na mesma transação do snapshot e recibo. O leitor reidrata os formatos antigo e novo; scripts de auditoria/upgrade foram atualizados. Backup automático precede a migração de um banco existente. A migração de armazenamento não avança tempo nem arquiva eventos. Rotas/acessos passam ao flush periódico de 5 s e ao flush de comandos/encerramento; a confirmação de comando continua posterior ao COMMIT.

O rollback compartilha apenas entradas imutáveis do ledger, copiando o array e o restante do mundo. Falha na gravação não avança o cursor incremental; falha no recibo também desfaz o ledger. Não houve mudança em itens, receitas, velocidade, dinheiro ou retenção.

Benchmark na mesma cópia do mundo, 588.022 lançamentos (test-results/performance/storage.json):

| Medida             |             Antes |                               Depois |
| ------------------ | ----------------: | -----------------------------------: |
| Snapshot regravado | 185.463.800 bytes | 36.604.248 bytes + lançamentos novos |
| Clone de rollback  |        1.457,7 ms |                             285,3 ms |
| Serialização JSON  |        1.432,9 ms |                             242,5 ms |

Migração inicial: 31,35 s, uma vez. Três comandos de preço com tempo injetado congelado: 1.082 / 801 / 760 ms. Não são latências HTTP nem prova de carga concorrente. Hash integral conferido após migração e reabertura. O mundo real foi atualizado com backup pre-ledger-storage-1793731964182.sqlite; season e dados preservados.

Cliente: trava síncrona contra clique repetido; deadline de 20 s por tentativa, duas tentativas com a MESMA chave; chave/comando persistem em sessionStorage enquanto não houver resposta definitiva; botão Consultar operação permite recuperar após recarga. Respostas 4xx liberam a operação sem retry automático; resposta ambígua não autoriza uma nova cobrança. Atualização antiga não substitui revisão mais nova nem pacote de outro ator.

Gaveta: availableStock respeita sementes/rebanho protegidos pelo motor; o estoque reservado a pedidos já é retirado fisicamente pelo motor. A imagem do erro não permite provar a causa exata da compra: dados atrasados e concorrência com bots também podem esgotar o fornecedor. A quantidade cotada pode ser menor que a desejada e agora aparece nas opções, no aviso e na confirmação, com duração calculada sobre a quantidade real. Botão mostra Confirmando compra durante o envio.

Validação: build e 269 testes em 36 arquivos aprovados. Cobertos backup/migração, reabertura, recibos, rollback, falha de persistência, tentativa repetida após perda de resposta e recusa definitiva. Os limites estruturais remanescentes são motor síncrono e snapshot residual de cargas/lotes: extração do ledger reduz o custo, mas não constitui isolamento completo da API.

Acompanhamento real depois da migração: 24 leituras de mundo e 24 de health, em intervalos de 3 s, atravessando rodada econômica. Nenhum timeout/HTTP de erro. Valores brutos em test-results/performance/live-http.json. Pico de mundo 4.209 ms e health 4.158 ms: há bloqueio residual, logo NÃO se declara API sem pausas. As operações reais de compra/frete/entrega/produção passaram novamente, e o novo teste de recuperação após recarga/perda de resposta passou usando exatamente a mesma chave. A UI da prévia mostrou dados/pregão carregados e confirmação de ajuste de preços; captura operations-live.png. O usuário estava interagindo durante a verificação, então não foram enviadas compras adicionais no seu mundo.

A API da prévia roda sem watch (edições não a reiniciam). AFTERMARKET_PREVIEW_PORT=5192 autoriza apenas a origem local da prévia, mantendo a validação de origem para comandos. A prévia usa a mesma API3011 e season; o backup pré-migração está em .runtime/backups.
