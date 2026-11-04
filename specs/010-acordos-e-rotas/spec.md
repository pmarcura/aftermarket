# Spec 010 · Abastecer a loja por acordos e rotas

Estado: **rascunho** (proposta do Pedro, 04/11/2026). Precisa do John: os acordos são "contratos recorrentes", que a D-042 deixou para depois de janeiro. Ver "Conflito com a D-042" no fim.

Evidência e números: [`docs/design/frete.html`](../../docs/design/frete.html) (Raio-x do frete, mundo `design-b`, escala 20, 04/11/2026).

## Problema

O repor sozinho da loja compra no avulso: quando o estoque cai, chama qualquer caminhão para a quantidade que o caixa ou o vendedor permitem. No mundo de teste:

- A loja do jogador pagou R$ 398 mil de frete para trazer R$ 206 mil de mercadoria, em 680 viagens. Na mediana, cada caminhão saiu com 0,1% da capacidade (8 sacos de arroz num pesado de 30 t).
- Em 133 de 171 saídas para a loja, vários produtos partiram no mesmo instante, em caminhões separados. Cinco atacados vendem 2 ou 3 produtos da loja cada um.
- O caminhão do próprio jogador fez 120 viagens a R$ 219 de frete médio, contra R$ 634 das transportadoras. Mesmo assim, o jogador não sabe como usar a frota a seu favor.
- Para configurar a regra é preciso entender mínimo, alvo, orçamento diário, reserva de caixa, teto de preço, distância e transportadora. É planilha, não decisão de negócio.
- As lojas-bot sofrem menos (frete de 13% da mercadoria) porque compram na própria cidade, mas 62% das viagens delas também levam menos de 5% do caminhão.

Na vida real, uma loja não fretou um caminhão para 84 caixas de leite. Ela abastece por **entrega do fornecedor** (dia certo na região, pedido mínimo, preço posto na loja), por **rota da própria frota** (um caminhão passa em vários fornecedores) ou por **contrato com uma transportadora**. A compra avulsa é exceção e feita pelo dono.

## Proposta

O abastecimento automático da loja passa a vir só de **acordos** e **rotas**. A compra avulsa continua existindo na mão, pela gaveta Mandar buscar.

| Jeito                     | Quem leva                                               | O que se combina                                                                              |
| ------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Fornecedor entrega        | Caminhão do vendedor ou transportadora que ele escolher | Produto, quantidade por entrega, a cada quantos dias, preço posto na loja, número de entregas |
| Busco eu (rota da frota)  | Caminhões do comprador                                  | Quais fornecedores visitar, o que trazer de cada um, a cada quantos dias                      |
| Transportadora contratada | Transportadora (bot; jogador depois da etapa D)         | Rota, frequência e preço por viagem                                                           |

## Requisitos

### Parte A · Rota da frota (só frota própria; não depende de contrato entre empresas)

- **R1** Uma viagem pode levar vários produtos de vários vendedores no mesmo caminhão, até a capacidade em peso e volume. O custo da viagem é um só e é rateado entre as cargas pelo peso.
- **R2** A loja pode ter uma rota: caminhão(ões) da empresa, paradas (vendedor e produtos), intervalo em dias e, para cada produto, "encher até N dias de venda". A quantidade de cada parada é calculada na saída pela venda diária real e pelo estoque, a caminho e já pedido.
- **R3** Na data da rota, se o caminhão estiver livre, ele sai da base, compra em cada parada ao preço da oferta do momento e volta. Sem caminhão livre, a rota espera e avisa; não chama transportadora sozinha.
- **R4** Uma parada só compra se a mercadoria entregue (preço + parte do frete) ficar abaixo do preço de venda menos a margem da trava "Só comprar com lucro"; senão é pulada e o motivo aparece na tela.
- **R5** Rotas usam o mesmo comando para jogadores e bots (`configureRoute`), com a mesma validação.

### Parte B · Acordo de entrega (fornecedor entrega)

- **R6** Comandos `proposeAgreement`, `answerAgreement` e `cancelAgreement`. Um acordo tem comprador, vendedor, produto, quantidade por entrega, intervalo, preço por unidade posto na loja (frete por conta do vendedor) e número de entregas.
- **R7** Bots respondem pela mesma verificação: aceitam se o preço cobre o custo médio, o frete estimado da carga e uma margem mínima da temporada, e se têm estoque e caminhão para a primeira entrega; senão recusam e dão o motivo.
- **R8** Em cada data, o vendedor reserva o estoque e despacha com a transportadora que escolher. O comprador paga na entrega. Dinheiro só por `transfer()`; estoque reservado antes do transporte.
- **R9** Entrega que falha (sem estoque, sem caminhão, sem caixa do comprador) é registrada e avisada às duas partes. Duas falhas seguidas encerram o acordo. Cancelar vale a partir da próxima entrega.

### As duas partes

- **R10** A compra automática avulsa (`runSupplyPolicies`) deixa de valer para lojas de jogadores que tenham acordos ou rotas para o produto. Se ela some de vez, ou fica como "emergência", é decisão de produto (Q1).
- **R11** A aba da loja mostra um calendário: próximas entregas e viagens, quem leva, quantidade, custo posto na loja e o que falhou. Criar um acordo ou uma rota leva no máximo três escolhas.
- **R12** Parâmetros novos (margem mínima do bot, limite de falhas, intervalo mínimo) moram na temporada, nunca em constantes soltas.

## Critérios de aceite

- **A1** Teste de motor: rota com 3 produtos de um mesmo atacado gera uma viagem por ciclo, com uma remessa por produto no mesmo caminhão e no mesmo horário, e a soma dos fretes rateados é igual ao custo da viagem.
- **A2** Teste de motor: acordo de leite a cada 3 dias por 30 dias entrega 10 vezes, com dinheiro e estoque conservados, incluindo uma entrega que falha e um cancelamento.
- **A3** Teste de motor: bot aceita uma proposta com preço acima do seu custo + frete + margem e recusa uma abaixo, pela mesma função que o jogador usa.
- **A4** Cenário de 30 dias com a loja do jogador abastecida só por rota e acordos: frete ≤ 15% da mercadoria e ocupação mediana do caminhão ≥ 30%, contra 193% e 0,1% de hoje.
- **A5** Prova da economia (constituição §5): na parte A os bots não mudam, então a prova sai idêntica. Na parte B, aceitar só se a mediana melhora e o pior caso não piora.
- **A6** Tela: calendário e criação em computador, celular e teclado; `npm run check` e e2e verdes.

## Perguntas para o Pedro e o John

- **Q1** A compra automática avulsa some para lojas de jogadores ou fica como "emergência" desligada por padrão? Recomendação: some. O Mandar buscar resolve a emergência e a loja já avisa quando um produto vai acabar.
- **Q2** Acordo tem multa por quebra? Recomendação: não no início; duas falhas encerram e o histórico fica visível para a outra parte.
- **Q3** Os bots passam a abastecer as lojas deles por acordos (parte C, depois)? Sem isso, jogador e bot abastecem de jeitos diferentes, embora pelos mesmos comandos.

## Fora de escopo

Acordos e fretes entre jogadores (etapa D), tabela de frete das transportadoras, carga fracionada, leilão de acordos, multa.

## Conflito com a D-042

A D-042 (John, 30/10) deixa "contratos recorrentes" e "frete por jogador" fora do playtest de janeiro. A parte A não cria contrato entre empresas nem frete por jogador: é a frota do próprio comprador, e poderia caber antes de janeiro se o John concordar. A parte B é um contrato recorrente e precisa da decisão dele.
