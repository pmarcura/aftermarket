# Rotas rodoviárias, leitura analítica e recuperação · 0.4.0

Pedido do usuário em 26/10/2026: corrigir design de jogo e interface, gráficos legíveis e caminhões seguindo estradas.

## Resultado observável

Toda nova remessa no servidor usa geometria rodoviária persistida. Falta de rota adia contratação sem cobrança. Caminhões interpolam essa geometria e preservam cronograma na recarga. Gráficos compartilham contraste, escalas, legenda e ferramentas acessíveis. A empresa vê compromissos e dispõe de meios explícitos de recuperação, sem emissão oculta.

## Entregas

- Serviço de rotas com cache, validação, fila limitada, deduplicação e tratamento de indisponibilidade; humanos/bots/abastecimento/editais no mesmo caminho.
- Reconstituir apenas o trajeto visual de remessas estimadas antigas, preservando preço, quantidade e datas.
- Tema analítico e ferramentas de gráfico: ampliar, zoom, imagem, tabela e CSV; leitura móvel e dados observados versus cenários.
- Referência pública baseada em negócios qualificados, diversidade e limite de variação; contratos existentes preservados.
- Obrigações não pagas, caixa vinculado a pedidos, crédito de recuperação com garantia/verba finita, pagamento e suspensão operacional; bots cobrem regras novas.
- Aquisição separada de equipamento/equipe, cenário iniciante sem reset.
- Cartões de frota com quantidade máxima por massa/volume/estoque/espaço; conexão fixa por insumo; erros no modal, recebimentos agrupados e leitura local.
- Projeções baixo/base/alto, indicadores de liquidez/concentração, filtros/busca/paginação e cenários de playtest reproduzíveis.

## Invariantes

Dinheiro em centavos, sem emissão; estoque/capacidade/frota revalidados. Backup e migração aditiva. Nenhuma cotação econômica externa durante a season. A API geográfica não fornece preço/mercado. Não apresentar OSRM automotivo como validação de peso/altura de caminhão. Simulações offline usam política explícita para distinguir fixtures de geografia real.

## Verificação

Testes de rejeição sem cobrança/estoque, cache/falha/deduplicação, interpolação em curvas e recarga; compromissos/garantias/conservação; manipulação por anúncios; simulações de 30/90 dias e mundo com baixo caixa. Playtest desktop/celular/teclado, gráficos e rotas reais no mundo salvo. Atualizar estado, decisões e auditoria sem declarar um MMO público pronto.
