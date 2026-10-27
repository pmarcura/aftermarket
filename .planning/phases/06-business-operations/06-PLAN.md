# Fase 06 · Gestão, capacidade e pedidos

## Resultado jogável

Do mapa, identificar o dono e consultar a operação/ofertas. Nas unidades próprias, decidir abastecimento, margem, equipe e produção a partir de informações distintas. Automatizar extração/produção com orçamento. Receber e aceitar pedidos com quantidade, prazo e frete limitado pelo comprador, distribuído entre veículos reais.

## Fonte de verdade e invariantes

Comandos do servidor e regras puras da simulação. Dinheiro inteiro e conservado; estoque, espaço, reserva mineral e veículos reservados antes da partida. Humanos e bots compartilham comandos. Qualidade, capacidade e sazonalidade semanal são parâmetros de jogo persistidos. Migração aditiva, backup antes de alterar banco, sem recalcular saldos nem prazos antigos.

## Entregas e saída

1. Titularidade e catálogo no mapa; navegação para oferta/unidade.
2. Abas com estoque físico e em trânsito, custo/margem, vendas/pedidos, finanças e equipe com régua por receita e área.
3. Capacidade limitada por equipe e área; qualidade recebida/produzida conservada por média ponderada. Automação com teto diário e motivo de espera.
4. Consumo com calendário virtual, perfil semanal, preço, qualidade, capacidade e orçamento finito; histórico observado separado de estimativas.
5. Pedidos de jogadores/bots com aceitação, recusa, expiração, teto de frete e entrega rastreável. Divisão inteira de carga por massa e volume, frota própria e externa.
6. Expansão conservadora de bots com caixa e lucro, usando aquisição comum.
7. Regressões econômicas, migração/idempotência e playtest desktop, móvel e teclado; documentação com limites reais.

## Direção visual

Preservar a identidade existente: base #0d181e, painéis #192a32, linhas #304650, texto #e7edef, ouro #d9b16b e azul #72b2d1. Inter para leitura e números tabulares para comparação. Gestão organizada como caderno operacional: resumo curto, área principal ampla, réguas com unidades, tabelas específicas e gráficos com valores verificáveis. A característica central é explicar o gargalo e a próxima ação, sem acrescentar decoração ou indicadores sem fonte.

## Limites de escopo

Não declarar cadeias/insolvência resolvidas. Qualidade agregada por produto, sem validade/lotes individuais. Expansão limitada às propriedades existentes. Pedidos de venda com entrega integral distribuída entre caminhões, sem crédito, multas ou entregas parciais negociadas. Autenticação pública e aceitação de frete por transportadores humanos permanecem em fases próprias.
