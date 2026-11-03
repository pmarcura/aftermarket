# Spec 008 · Estrutura das telas: cada coisa numa casa só

Estado: **aprovada** (Pedro, 03/11/2026). Branch `design/estrutura-telas`. Decisão D-043. Corre em paralelo às specs 006 e 007; toca só `apps/web`, salvo onde um requisito diz o contrário.

## Problema

Inventário de 03/11/2026 ([`docs/design/inventario.html`](../../docs/design/inventario.html), 12 telas e 9 abas no primeiro dia de jogo, escala 20):

- O Início e Meus negócios dizem "tudo em dia" enquanto a loja tem 3 de 11 funcionários, três produtos esgotados e procura sem atender.
- O mesmo dado mora em vários lugares: vendas de hoje (6), caixa livre (5), custo fixo (3), "Para onde foi o dinheiro" (Loja e Empresa), cartões dos negócios (Início e Meus negócios).
- O mesmo dado com valores diferentes: venda diária de leite ~5.772 (Prateleira), 300 (Abastecimento) e 396 (Finanças), sem dizer qual conta é cada uma.
- Sete botões levam a comprar mercadoria; o do topo da Loja tira o jogador da loja. "Negócios para abrir" mora dentro de Cotações, longe do Mapa. Vender está dividido entre Pedidos e Contratos.
- Abastecimento tem ~6.000 px, Cotações ~5.200, Contratos ~4.700 e Pedidos ~3.900, em boa parte com cartões repetidos.

## Estrutura aprovada

| Menu     | Conteúdo                                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Início   | A mesa do dono: hoje, o que precisa de você (alertas verdadeiros) e o próximo passo. Mostra só os negócios que pedem decisão.         |
| Mapa     | Com o painel "Onde abrir", que reúne Terrenos à venda e Negócios para abrir.                                                          |
| Negócios | Cartões de todas as unidades (única casa) · Frota · Loja com **Prateleira** (estoque e reposição juntos), **Equipe** e **Resultado**. |
| Mercado  | **Comprar** (preços de tudo; comprar sempre pela gaveta Mandar buscar) · **Vender** (quem quer comprar de você e contratos públicos). |
| Empresa  | Dinheiro, patrimônio e crédito; única casa de "Para onde foi o dinheiro".                                                             |

Minhas entregas vira um painel aberto pela barra do topo, sem aba própria.

## Requisitos

- **R1** Cada dado tem uma casa; fora dela, no máximo um atalho que leva até ela. A barra do topo é a casa de caixa livre, vendas de hoje e relógio.
- **R2** "Precisa de você" só diz "tudo em dia" quando nenhuma unidade tem produto esgotado, falta de equipe, procura sem atender ou conta atrasada. Os mesmos sinais acendem o cartão da unidade.
- **R3** Toda quantidade "por dia" diz de onde vem (estimativa no preço testado, média real, regra de reposição) e a mesma conta tem o mesmo número em todas as telas.
- **R4** Comprar mercadoria acontece sempre pela gaveta Mandar buscar, aberta de qualquer tela, sem tirar o jogador de onde está.
- **R5** Nenhuma lista despeja cartões iguais: pedidos e contratos começam pelo que o jogador consegue atender e agrupam o resto.
- **R6** Comércio passa a se chamar Mercado com duas abas; Cotações, Oportunidades, Pedidos e Contratos deixam de ser abas próprias.
- **R7** Interface não muda saldo, estoque nem prazos; os mesmos comandos de hoje (`trade`, propostas, contratos) continuam sendo usados.

## Critérios de aceite

- **A1** Em cada tela entregue, a tabela "Onde cada coisa aparece" do inventário fica com 1 casa por dado (refeita a cada tela).
- **A2** No cenário do inventário (loja com equipe curta e produtos esgotados), o Início mostra os alertas e não "tudo em dia" (teste de navegador).
- **A3** `npm run check` e e2e verdes; verificação em computador, celular e teclado; o Pedro aprova cada tela.

## Ordem

Uma tela por vez, na ordem da jornada: Início → Loja (Prateleira com reposição) → gaveta Mandar buscar → Mercado (Comprar) → Mapa com Onde abrir → Mercado (Vender) → Negócios e Frota → Empresa. Cada tela segue o ritual: entender, inventário fino, esboços, construir, testar, revisão independente, aprovação.

## Para a engenharia (fora desta spec)

Achados que não são de interface, para o John decidir onde entram:

1. O ajuste do capital inicial ("Começo enxuto… R$ 1 milhão", `kind: budget`, R$ 1.850.625 do jogador para o tesouro) aparece como gasto do jogador: Início mostra R$ 1,85 mi em gastos no dia 1 e a Empresa, caixa caindo R$ 1,9 mi (95% em "Energia, manutenção e outros").
2. Contratos mostra identificadores como "#7773cc" no cartão.
3. Oportunidades diz "Acima do seu caixa" e "Seu caixa cobre 100%" no mesmo cartão (provavelmente arredondamento: faltam R$ 1.993).

## Fora de escopo

Mapa 3D (ramo `pedro/mapa-3d`, integração pelo John), notícias e ranking, celular como plataforma principal, arte final de produtos.

## Andamento

### Tela 1 · Início (03/11/2026, direção A "Caderno do dia", escolhida pelo Pedro)

- **Caderno do dia:** pendências com o dinheiro em jogo por dia (estimativa) e o botão que resolve; o que foi resolvido fica riscado com o carimbo "Feito". Alertas novos: equipe curta (mesma conta da aba Equipe, `equipeDaLoja`) e preço longe do ponto de maior lucro; ordem por urgência e depois por valor.
- **Recibo** de enquanto você esteve fora (ou de hoje) e **porte** da empresa com a régua até o próximo porte (`patrimonioDe`, a mesma conta da Empresa).
- **Oportunidades:** produto que a cidade procura e a loja não vende (abre Mandar buscar), negócio que cabe no caixa (mesmo lucro de Negócios para abrir) e pedido de outra empresa que o estoque atende.
- **Pregão ao vivo:** até 8 produtos (primeiro os que a empresa negocia), preço nacional que corre e pisca ao mudar, variação contra um dia de jogo (ou "novo") e minigráfico que se desenha.
- **Mural:** placar dos empresários pelo patrimônio, a maior compra do dia como manchete e as últimas movimentações com filtro Tudo / Empresários / Empresas automáticas. Clã e amigos dependem do servidor de jogo (spec 007): ainda não há grupo nem convite no motor.
- Saíram do Início: cartões dos negócios (casa: Negócios) e vendas por dia (casa: Empresa).
- Correções: o ajuste do capital inicial (`budget`) e os investimentos (imóvel, caminhão) não contam mais como custo no Início; o cartão de carga a caminho não passa mais da tela no celular.
- **Correção do inventário:** arroz, feijão e açúcar nunca estiveram na loja. A aba Abastecimento rotula como "Esgotado" todo produto da temporada que a loja não vende; o rótulo engana e deve mudar quando a Loja for redesenhada.
