# Fase 01 · Fundação e fatia jogável

**Resultado:** demonstrar o ciclo de decisão, compra, transporte, recebimento e produção numa interface próxima às referências, com organização suficiente para continuar sem retrabalho.

## Entregas

- Git local, convenções, fonte original preservada e processo Game-GSD.
- Pesquisa de bibliotecas e dados com distinção entre integrado e candidato.
- Interface das dez telas, seis destinos e adaptações para largura reduzida.
- Mundo local com duas empresas, fornecedores e transportadores automatizados.
- Servidor autoritativo, saldo, ledger, estoques, capacidade e eventos persistidos.
- Critérios econômicos testados e roteiro da evolução para MMO.

## Critérios de saída

1. Uma propriedade não tem dois donos.
2. A repetição de uma solicitação não cobra duas vezes.
3. Uma mercadoria sai da origem e só chega ao destino após a entrega.
4. O veículo comporta peso e volume, e fica ocupado durante o serviço.
5. A produção consome entradas, reserva capacidade e cobra custos.
6. Vendas não ultrapassam estoque nem orçamento do consumidor.
7. Produção e remessa retomam com o tempo offline.
8. Dados geográficos e economia simulada têm identificação distinta.
9. Desktop e celular navegam sem erros JavaScript nem rolagem global lateral.
10. O próximo desenvolvedor consegue localizar visão, requisitos, código e próxima fase.

## Escopo posterior

Autenticação pública, PostGIS, transporte humano, planejamento completo de bots, contratos e geração territorial nacional. A presença de telas para esses domínios não encerra esses requisitos.

## Ajuste de cartografia · 26/10/2026

Pedido do usuário: retirar aeroportos, edificações e rótulos, preservando o realismo das estradas que conectam as rodovias. Entregar mapa e previews com base limpa, cores hierárquicas e continuidade viária entre zooms. Preservar seleção, busca, camadas do jogo e créditos; não alterar regras econômicas nem persistência.

Critério de saída: desktop, celular e teclado funcionam; aeroportos/prédios presentes nos tiles não são desenhados; estradas sem referência, alças, pontes e túneis usam a malha geométrica, com espessura contínua por zoom. Água e rodovias continuam visíveis. Registrar limites da generalização dos tiles e a distinção entre menos renderização e menos download, sem assumir ganhos de FPS.
