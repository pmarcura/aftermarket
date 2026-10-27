# Fase 06 · Validação de operação e concorrência

Versão 0.3.0, 26/10/2026, America/Sao_Paulo. Integra os planos `06-PLAN.md` e `06-COMPETITION-PLAN.md`. Evidência local; sem publicação externa.

## Resultado

Implementados pedidos abertos/dirigidos, propostas/contrapropostas entre humanos/bots, logística por pedido com múltiplos caminhões, transferências próprias, abastecimento industrial/varejista configurável, contratação por salário estadual, educação, tesouros por UF, editais variados e 30 novos concorrentes.

O gerenciamento que já estava em andamento foi integrado: especialização, capacidade por equipe/área, qualidade recebida/produzida, histórico de consumo, abas operacionais e expansão. Uma implementação ativa de cada fluxo; referências e mapa simplificado preservados.

## Verificações

| Verificação                                          | Resultado                               | Alcance                                                                                                                                         |
| ---------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                      | Passou                                  | TypeScript, build Vite e **63 testes em seis arquivos**                                                                                         |
| `npm run test:e2e`                                   | **7 passaram**                          | Edge 1920/390 px, navegação, compra/frete/entrega/produção, análise, animação/recarga, negociação, abastecimento/educação e licitação municipal |
| `npm run test:e2e -- business procurement animation` | **3 passaram após refinamentos finais** | Transferência na interface e marcadores dos caminhões separados                                                                                 |
| `npm run balance:season -- --days=30`                | Dinheiro conservado                     | Mundo separado em memória, sem DB do jogador ou cotações externas                                                                               |
| Migração real auditada                               | `integrity_check=ok`                    | Auditoria de saldos/estoques/titularidade/frota/ledger/recibos/jobs/remessas e configuração                                                     |

O build mantém avisos de tamanho dos chunks MapLibre/ECharts; o carregamento por página existe, mas desempenho em hardware modesto permanece pendente. Node emite aviso de SQLite experimental.

`npm run format:check` passou. Conferência final do mundo principal com `npm run capture:ui`: 62 marcadores no mapa e nenhum erro de página/requisição. API respondeu saudável na versão 0.3.0; a interface foi deixada em `http://127.0.0.1:5173`.

## Regressões econômicas relevantes

- 30 novas empresas financiadas sem emissão; 27 contas de tesouro; inicialização idempotente.
- Todas as receitas têm perfil de capacidade e produtor bot.
- Pedidos não cobram na publicação; somente contraparte aceita; falta de estoque/caixa rejeita sem despachar.
- Bot publica pedido, aceita oferta humana e usa frota/pagamento reais. Contraproposta ruinosa recebe nova proposta, sem aceite abaixo do custo.
- Transferência própria conserva dinheiro, custo/qualidade e não cria receita; produção pausada não impede estoque.
- Reposição considera entradas/pedidos pendentes, teto diário, caixa protegido e estado de espera; projeção respeita chegada e não desconta consumo impossível durante ruptura.
- Educação paga uma vez e aguarda tempo; lotes existentes preservados; novos empregados diluem formação.
- Edital nasce apenas com verba, salva referência +25%, revalida pontuação e condições no fechamento, desclassifica fornecedor sem estoque e adjudica concorrente viável.
- Material público é consumido por chegada; múltiplos caminhões concluem o contrato apenas após todos.
- Contratos legados conservam termos. Migração não cobra regras novas no passado e mantém horários de entrega/lotes.
- Receipts e rollback SQLite cobrem repetição e falha de comando.

## Migração do mundo principal

Backup anterior de referência: `.runtime/backups/pre-operations-1793064355616.sqlite`. Backup adicional do início da manutenção: `.runtime/backups/world-2026-10-26T11-38-55.700Z.sqlite`. O store também criou backup transacional ao atualizar para `operationsVersion=3`.

Auditoria concluída por `npm run world:upgrade -- --verify-from=.runtime/backups/pre-operations-1793064355616.sqlite`: saldos humanos, estoques, propriedades, frota e configuração existente preservados. Mantidos 54 recibos, 102 remessas e 227 jobs; 22.658 lançamentos originais preservados. Os 150 novos lançamentos de orçamento explicam regionalização/capital inaugural, totalizando 22.808 na migração. Sem reset.

Relatório `.runtime/review/migration-main.json`. O parâmetro `--verify-from` serve para auditoria do momento da migração; não comparar um mundo que continuou jogando contra um backup antigo como se nada devesse mudar. A API retomou ticks, pedidos e ações dos bots sem erros nos logs observados.

## Cenário de 30 dias

- 742 viagens, 916 jobs concluídos e 35 contratos públicos concluídos.
- R$ 8.938.005,39 pagos em material/frete público; 1.488 t de aço consumidas.
- R$ 20.370.792,32 somados nos tesouros e R$ 24.261.792,51 nos consumidores ao fim.
- Nove pedidos pendentes; nenhum produto termina com oferta zero.
- 28/30 novos bots com operação ativa. Indústrias `rival-1` e `rival-21` pausam por caixa, além de uma expansão anterior. `e-warehouse2` começa pausado.

Isso demonstra circulação e ausência de criação monetária, não estabilidade integral ou balanceamento aprovado. Os números são deste cenário/configuração; disponibilidade contínua e experiência humana exigem playtests.

## Evidências de interface

`test-results/competition/`: `private-order.png`, `supply-desktop.png`, `workforce-mobile.png`, `public-contract.png`, `public-delivery.png`. Testes usam bancos novos e portas 5183/3013, sem reutilizar o principal 5173/3001. No fluxo de contratação, filtros vazios e escolhas explícitas foram preservados; regras já salvas da própria unidade são restauradas.

## Limites e próxima ação

Priorizar recuperação de insolvência, proteção da referência de editais contra coordenação e cenário de iniciante. Referência é mediana de ofertas, não negócios. Qualidade média por produto; agricultura/beneficiamento agregados; projeção de reposição é hipótese, sem garantia de venda. Sem escrow, crédito, aluguel, contratos recorrentes, autenticação pública ou aceite humano de fretes. Ver `docs/product/GAME-DESIGN-AUDIT.md`.
