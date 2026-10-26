# Fase 01 · Evidências de validação

Data: **26/10/2026**. Ambiente: Windows, Node 25.5, Edge, interface em 1920×1080 e 390×844.

## Resultado

A fatia jogável local foi demonstrada. Isso não representa aprovação do MMO público: identidade autenticada, consultas permitidas, migração relacional e operação distribuída continuam na fase 02.

## Verificações automatizadas

| Verificação                                   | Resultado          | Evidência                                                                                 |
| --------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| TypeScript estrito e build Vite               | Passou             | `npm run build`; sem variáveis/importações sem uso                                        |
| Invariantes econômicos e SQLite               | 15 testes passaram | `tests/economy.test.ts`                                                                   |
| Navegação desktop das dez telas               | Passou             | `tests/e2e/navigation.spec.ts`                                                            |
| Navegação móvel e largura global              | Passou             | Mesmo arquivo; viewport 390 px                                                            |
| Compra → frete → entrega → produção → recarga | Passou             | `tests/e2e/economic-flow.spec.ts`; cerca de dois minutos reais                            |
| Captura do mapa após carregamento real        | Passou             | 21 marcadores; nenhum erro JavaScript ou de requisição na captura                         |
| Compilação servida em modo de produção        | Passou             | HTTP 200, HTML e assets compilados, API e mundo em banco de teste separado                |
| Backup consistente SQLite                     | Passou             | `npm run world:backup`; arquivo aberto em modo de leitura e `PRAGMA integrity_check = ok` |
| Referências preservadas                       | Passou             | 13 imagens, nomes estáveis, tamanhos e SHA-256 em `docs/references/manifest.json`         |
| Catálogo IBGE                                 | Passou             | 5.571 municípios e dez IDs piloto encontrados; proveniência registrada                    |

## Cobertura dos testes de domínio

Aquisição exclusiva, saldo insuficiente, reserva na origem, recebimento único, custo médio com frete, limites de massa/volume, capacidade já comprometida por remessas, consumo de insumos, unidades de outro dono, reserva mineral finita, consumo com orçamento, equivalência de tempo online/offline, quantidades inválidas, idempotência e rollback.

A disputa por propriedade é testada com dois atores sobre a mesma persistência. O teste entre processos/conexões independentes e a autorização autenticada permanecem critérios da fase 02.

## Fluxo de navegador demonstrado

1. Selecionar carvão no mercado e destinar 3 t à Indústria de Aço.
2. Confirmar mercadoria e frete com o custo total.
3. Conferir criação da remessa sem crédito antecipado no destino.
4. Aguardar o vencimento real e verificar o recebimento único das 3 t.
5. Recarregar, abrir a operação e iniciar um ciclo siderúrgico.
6. Conferir consumo de 12 t de minério e 3 t de carvão.
7. Aguardar conclusão e verificar acréscimo de 8 t de aço.
8. Recarregar novamente e conferir continuidade da unidade.

Os testes de navegador usam transações reais no mundo local. Não simulam sucesso com interceptações da API.

## Revisão visual

Foram comparados mapa, oportunidades, mercado, finanças e viewport móvel às referências originais. Ajustes aplicados: posição absoluta dos marcadores, enquadramento regional, paleta de vegetação, tamanho de textos e compactação do painel lateral. O mapa usa geometria real; polígonos não são ampliados artificialmente para reproduzir a escala ilustrativa dos mockups.

Há diferenças intencionais registradas em `docs/product/DECISIONS.md`: KPIs reais em vez de números decorativos, preview cartográfico em vez de satélite sem licença e preço coerente de aquisição.

## Limites de validação

Não foram demonstrados carga de produção, publicação pública, infraestrutura distribuída, restauro operacional completo, geração nacional de lotes, roteamento de caminhões com restrições nem comportamento comercial completo dos bots. As capturas e testes locais não substituem esses critérios.

O build informa um chunk cartográfico de aproximadamente 1,29 MB antes de compressão, concentrado no MapLibre e renderização. As páginas carregam sob demanda; a entrada da aplicação ficou em aproximadamente 254 kB antes de compressão. A medição em dispositivos lentos pertence ao playtest de desempenho.

## Ajuste cartográfico · 26/10/2026

- Estilo local validado pela especificação MapLibre sem erros: 10 camadas de base, ante 119 no Bright consultado. Nenhuma dependência adicionada pelo ajuste cartográfico.
- Edge, 1920×1080 e 390×844: 21 marcadores disponíveis, seleção com Enter, alternância da camada de empresas e busca de Campinas com enquadramento real. Sem erro JavaScript nem largura global excedente.
- Inspeção do estilo em zooms 4, 9, 10, 11, 12, 13, 13,5, 14, 14,5 e 17, além de zoom animado 9→14: sem `aeroway`, `building`, `poi`, `place` ou `landuse` renderizados. Em Viracopos, os tiles continham 118 feições de aeroporto; na visão urbana de Campinas, 89 feições de prédio. Ambas as categorias ficaram fora da renderização. Todas as estradas desenhadas vêm de `transportation`; a vista urbana mostrou vias locais e 1.353 feições viárias de superfície sem `ref`.
- Nenhuma requisição cartográfica a `/styles/`, `/fonts/` ou `/sprites/` no fluxo do aplicativo. A atribuição continua visível. Os dados urbanos ainda constam nos tiles recebidos, como demonstrado pela inspeção.
- Evidências locais: `test-results/map-review/report.json`, `desktop.png`, `mobile.png`, `aeroporto.png`, `cidade.png`, `agua.png`, `nacional.png`, `maximo.png`, `conexoes-9.png` até `conexoes-14.png` e `zoom-em-movimento.png`. Roteiro executável de inspeção em `.runtime/review-map.ts`; artefatos não versionados conforme convenção. Servidores de revisão em 5175/3005 com `.runtime/map-review.sqlite`, separados do mundo do jogador.
- Build e dois testes de navegação das dez telas/viewport móvel passaram. Dois testes de regressão em `tests/map-style.test.ts` passaram: seleção sem referência/alças/pontes/túneis/vaus e espessuras monotônicas/contínuas de zoom 4 a 17, iguais nos três estratos.
- Na execução conjunta, 13 dos 15 testes econômicos passaram; duas expectativas fixas de preços em `tests/economy.test.ts` (linhas 33 e 63) divergem da recalibração de propriedades/ofertas em andamento no simulador. Não houve alteração desses arquivos por este ajuste. Próxima ação dessa frente: alinhar as expectativas à calibração econômica atual e repetir a suíte. O resultado histórico da fase acima não equivale a aprovação da suíte atual com alterações paralelas.

Limite: quantidade de camadas não equivale a ganho proporcional de FPS ou download. O bundle MapLibre continua em aproximadamente 1,29 MB antes de compressão. Medir tráfego, memória e fluidez em hardware modesto antes de decidir por tiles filtrados/cache próprio. Os tiles são generalizados pelo provedor e acrescentam vias menores em zooms próximos; a apresentação não substitui a geometria da rota logística.
