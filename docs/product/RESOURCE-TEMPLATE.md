# Ficha de admissão de recurso/receita

Copiar o conteúdo para a especificação da mudança; não duplicar o catálogo nem gerar uma segunda implementação. Seguir [RESOURCE-STANDARD.md](RESOURCE-STANDARD.md) e registrar a evidência na fase responsável.

## Problema e decisão do jogador

- Qual decisão nova este item permite?
- Que lacuna medida da cadeia resolve? Qual evidência demonstra a necessidade?
- Quais alternativas já existentes atendem ao problema?
- Categoria: item físico, serviço, ativo ou abstração? Por que precisa ser negociável?

## Identidade e unidades

| Campo                                                     | Preenchimento obrigatório |
| --------------------------------------------------------- | ------------------------- |
| ID estável / nome                                         |                           |
| Unidade inteira de estoque e venda                        |                           |
| Massa t/unidade / volume m³/unidade                       |                           |
| Embalagem, qualidade e limitações                         |                           |
| Hipótese de jogo / referência real verificada / agregação |                           |
| Fonte, data, canal e conversão da unidade                 |                           |

## Origem e receita

- Receita(s), categoria, entradas e saídas por ciclo, inclusive coprodutos.
- Primeira unidade/semente: de onde vem, quem paga, quantidade finita e como repor.
- Reserva e consumo por ciclo quando extrativo; identificar mineral.
- Duração virtual, trabalhadores, área por linha, equipamento e utilidades.
- Balanço de massa: entradas + origem externa = saídas + perdas/residual, com justificativa.
- Duração do lote, cadência de automação e capacidade efetivamente vendável.
- O que ocorre se faltar semente, caixa, água, energia, equipe, espaço ou rota?

## Mercado e matemática

- Compradores/consumo final e orçamento pagador executado pelo motor.
- Destino e absorção dos coprodutos, proporções em relação à demanda.
- Custo posto dos materiais, processamento, utilidades, frete e fixos.
- Contribuição por ciclo, utilização de equilíbrio e resultado em demanda baixa/base/alta.
- CAPEX, estoque/caixa até a primeira venda e recuperação após uma falha.
- Fornecedores/consumidores independentes e exposição à concentração.
- Preços/limites são parâmetros ou dados? Qual configuração/season recebem a mudança?

## Integração e evidência

- Arquivos canônicos alterados: tipo/catálogo, receita/config, capacidade, canais, bot, comando, interface e auditoria.
- Fluxo demonstrado: obter → transportar → produzir → anunciar → vender → consumir.
- Falhas sem débito/estoque parcial, conservação monetária, custeio e conclusão única.
- Se alterar UI: desktop, celular, teclado, estados vazios e recuperação.
- Auditoria, testes e cenários 30/90 dias com configuração/hash e métricas por item.
- Efeitos na season salva, migração explícita/backup quando aplicável.
- Critério de saída, alertas aceitos com justificativa e próxima ação concreta.

**Decisão de admissão:** pendente / aprovada para experimento / aprovada para nova season. Não marcar aprovada só porque compilou ou tem receita.
