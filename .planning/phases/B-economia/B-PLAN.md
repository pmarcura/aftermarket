# Etapa B · Levar a economia alvo ao motor

Plano de 27/10/2026. Base: proposta aprovada (D-028, D-029), números em [`ECONOMIA-ALVO`](../../../docs/product/ECONOMIA-ALVO.md) ; itens e receitas em `packages/simulation/src/catalog.ts`.

## Resultado jogável

Um mundo novo em que as duas cadeias fecham. Sementes compradas viram colheitas, o farelo vira ração para vacas, o aço vira utensílios e caminhões, e caminhões velhos viram sucata. Bots e jogadores usam os mesmos comandos.

## Regra de segurança

A nova economia vale para **mundos novos**: o cenário iniciante, o laboratório e o mundo do playtest. O mundo principal salvo mantém a configuração congelada da sua season e só recebe as correções de fórmula. Nenhuma migração altera saldos, estoques ou receitas existentes.

## Fatias

Cada fatia termina com build, testes e commit próprio.

Andamento: fatias 1 a 7 entregues em 27/10 (catálogo, configuração, sementes, rebanho, ração, aço para bens com sucata e caminhão como mercadoria) e fatias 8 e 9 em 28/10 (30 rivais em todas as especialidades, lojas por população, frota dos bots e gasto público com as famílias, D-031; telas de frota com compra por montadora, desgaste, venda e desmontagem, rebanho e semente nas telas de estoque e produção, ícones por item, D-032). O mundo de teste da versão 2 abre com `npm run dev:v2`. Testes em `tests/economy-v2*.test.ts`. Prova de 90 dias da fatia 8: dinheiro conservado, nenhum rival quebrado, todas as especialidades produzindo nos dias 60 a 90, exceto as montadoras, paradas por falta de procura (frotas cheias, nenhum caminhão no fim da vida útil). Vendas atendem de 43% a 60% da procura; aço ao governo dá 8 t/dia contra 16 previstas. Os três pontos vão para a calibração da fatia 10. O mundo versão 2 é criado com `createWorld(agora, { economy: 2 })`; o padrão continua sendo a versão 1 até a fatia 10 provar a nova economia.

| #   | Fatia                    | O que entra                                                                                                                                                        | Pronto quando                                                                                                                             |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Catálogo                 | Módulo de dados puro com os 20 itens e 14 receitas, importado pelo motor e pela calculadora; itens novos com massa, volume e unidade; perda declarada nas receitas | Mundo novo lista os itens; calculadora e motor leem os mesmos números                                                                     |
| 2   | Calibração do mundo novo | Parcela de consumo 2%, utensílios no consumo das famílias, loja com 50 unidades por pessoa por rodada, equipamento e equipe por receita, preços de abertura        | Teste de mundo novo confere parâmetros contra a calculadora                                                                               |
| 3   | Sementes                 | Colheitas consomem semente e devolvem semente; estoques iniciais declarados nos bots                                                                               | Fazenda sem semente para; colheita repõe 110%                                                                                             |
| 4   | Rebanho                  | Vaca como item que fica na linha: cada 150 vacas liberam uma linha de ordenha; nascimentos (0,2%/dia) e aposentadorias (0,14%/dia) com fração acumulada            | Leite limitado pelo rebanho; rebanho cresce devagar e sem números quebrados                                                               |
| 5   | Ração                    | Fábrica de ração transforma farelo; ordenha consome ração                                                                                                          | Farelo deixa de encalhar no laboratório                                                                                                   |
| 6   | Aço para bens            | Fábrica de utensílios; lojas vendem kits; coleta municipal vende sucata urbana; siderúrgica pode reciclar sucata                                                   | Governo abaixo de 50% do aço consumido                                                                                                    |
| 7   | Caminhão como mercadoria | Montadora produz caminhões leve e pesado; comando para registrar o caminhão na frota; desgaste por km com manutenção crescente; vender como sucata ou usado        | Caminhão novo só existe se foi montado (ou importado, ver abaixo). Pendente: mercado de usados entre jogadores (hoje só venda ao tesouro) |
| 8   | Bots                     | Rivais para as novas especialidades, políticas de abastecimento e decisões com os mesmos comandos                                                                  | 90 dias no `/lab` sem especialidade parada por falta de bot                                                                               |
| 9   | Interface                | Telas de frota (registrar caminhão, vender sucata), rebanho e itens novos; ícones simples                                                                          | Fluxos principais testados no navegador desktop                                                                                           |
| 10  | Prova                    | 90 dias, várias sementes aleatórias: margem por cadeia, estoque parado, empresas quebradas, concentração por produto                                               | Critérios da ECONOMIA-ALVO dentro das faixas, ou desvios explicados                                                                       |

## Decisão do Pedro (D-030)

**Importação de caminhões como válvula de segurança, aprovada.** Se ninguém montar caminhões, ninguém consegue frota e o mundo trava. Por isso fica uma concessionária institucional que vende caminhões importados 30% mais caros que o preço alvo. Ela funciona como teto de preço para a montadora e o dinheiro sai da economia.

## Riscos

- O motor e a interface assumem uma lista fixa de dez produtos em poucos lugares; a fatia 1 precisa encontrar todos.
- Rebanho e caminhão são mecânicas novas, não só números. Exigem testes de conservação de massa e dinheiro.
- A procura por caminhões cai depois que as frotas crescem; o desgaste por km precisa ser calibrado na fatia 10.
