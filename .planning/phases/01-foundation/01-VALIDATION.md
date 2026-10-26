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
