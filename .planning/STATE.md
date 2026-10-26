# Estado da continuidade

Atualizado em **26/10/2026**, America/Sao_Paulo.

## Onde estamos

Fases 01 e 02 entregues como laboratório local 0.2.0. Projeto canônico em `D:\Novidade`, branch `main`. Checkpoint inicial: `4cef185`. Não havia código anterior na pasta. GDD e 13 imagens preservados. React/TypeScript/MapLibre, API Node/Express e SQLite em `.runtime/world.sqlite`.

## Funciona

Dez telas, mapa com camadas e seleção, compra exclusiva de propriedade, ofertas finitas, confirmação de compra com frete, veículo ocupado por massa/volume, entrega real ao inventário, produção com entradas e custos, vendas de varejo, extração finita, dois perfis locais, preços/ofertas editáveis, aquisição de veículos e exportação financeira.

O custo médio incorpora frete e custos industriais. Eventos são processados em ordem e retomados após reinício. Contas locais compartilham estado e o navegador não é a autoridade financeira.

Cartografia simplificada e refinada a pedido do usuário: estilo local de 10 camadas com água, matas e malha viária completa para apresentação, incluindo estradas de ligação e acessos. Sem aeroportos, prédios ou rótulos. As vias usam `transportation`, sem exigir nome/ref; espessuras contínuas por zoom e hierarquia de cores. Mesma base nos previews; busca e camadas do jogo preservadas. Ver D-014.

## Validação

Build, 15 testes de domínio, 3 testes de navegador e formatação passaram. Produção local respondeu com assets compilados, e o backup teve `integrity_check = ok`. Ver `.planning/phases/01-foundation/01-VALIDATION.md`. Não considerar a fase seguinte pronta apenas porque as telas existem.

No ajuste cartográfico, inspeção no Edge validou desktop 1920 px, celular 390 px, seleção por teclado, busca, alternância de empresas e zoom 4–17. Os tiles contêm aeroportos/prédios, mas essas feições não são renderizadas. Dois testes de regressão cobrem conexões sem referência, pontes/túneis e continuidade de espessura. Nenhuma requisição de estilo remoto, glyphs ou sprites. Evidências locais em `test-results/map-review/`; a revisão usa banco separado e não altera comandos econômicos.

A fase 02 substitui as expectativas fixas antigas por custos reais do cenário e acrescenta regressões: build e 28 testes de domínio/migração passaram. Cinco fluxos de navegador cobrem navegação, móvel, compra/entrega/produção, filtros/análise e animação com recarga. Ver `02-economy-and-intelligence/02-VALIDATION.md`.

Economia agora em BRL; configuração da temporada persistida, sem cotações externas ao vivo. Água, energia, folha e manutenção têm pagamentos separados; pausa mantém custos fixos. Mão de obra/logística expõem fórmula. Oportunidades inclui os dez itens, mapa econômico com praças agrupadas, análise simples/avançada e ECharts. Seleções comerciais são explícitas e filtros abrem vazios. Reposição automática de lojas tem orçamento. Migração real preservou 1.098 lançamentos, sete recibos, nove cargas e sete jobs, com `integrity_check=ok` e backup anterior.

## Próxima ação concreta

Ler `docs/product/GAME-DESIGN-AUDIT.md` e o relatório de 30 dias em `.runtime/balance/season-2026-10-26-30d.json`. Fechar consumo final/fornecimento de duas cadeias e recuperação de insolvência antes de expandir o catálogo. Planejar identidade e persistência relacional na fase 03, pré-condição de season pública. Referências reais só calibram abertura/futuras temporadas.

## Limites conhecidos

- Perfis sem senha, acesso apenas ao loopback; nenhuma publicação pública foi feita.
- Snapshot JSON transacional em SQLite é adequado ao laboratório e não à escala MMO.
- Preços/estoques/negócios são observados; demanda, qualificação, tarifas e infraestrutura são parâmetros modelados. Praças vizinhas compartilham ofertas.
- Bots ainda não têm planejamento comercial completo.
- OSRM usa perfil de automóvel, sem garantias para caminhões/pedágios. Alternativa estimada é identificada.
- Catálogo nacional importado; pesquisa econômica e atividade limitadas ao piloto.
- Não existem aluguel, contratos recorrentes ou aceitação humana de frete. Reposição automática de lojas está entregue, com limite diário.
- Reservas, propriedades, nomes de empresas e infraestrutura comercial são fictícios.
- Frete paga combustível, motorista, manutenção por km, manuseio e pedágios estimados. Ainda faltam depreciação, retorno vazio planejado e contratos de frota.
- Cadeias incompletas esgotam feijão e leite no cenário de 30 dias; recuperação de insolvência e recirculação institucional ainda precisam de design.
- Histórico analítico tem retenção móvel; não há arquivo completo da season nem simulação de trânsito por trecho.
- A base mínima usa os mesmos tiles completos; tráfego e FPS em hardware modesto ainda precisam ser medidos. O provedor generaliza a malha e acrescenta detalhes conforme o zoom; a rota logística continua independente do estilo.

## Regras para não perder trabalho

Um código ativo por função. Histórico no Git. Temporários, banco e backups em `.runtime`. Referências imutáveis em `docs/references`. Dados importados têm proveniência. Ao terminar cada fase, atualizar plano, validação e este estado.
