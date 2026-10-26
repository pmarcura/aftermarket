# Validação · Fase 02

Data: 26/10/2026. Escopo: laboratório 0.2.0. Não é aprovação para MMO público.

## Evidências

- `npm run check`: TypeScript/build e 28 testes de domínio, migração e cartografia passaram. Regressões cobrem imutabilidade da season, ausência de fetch econômico, fórmulas, custos separados, coprodutos, orçamento, cotação alterada, conservação, recebimento único, tempo online/offline e snapshots intermediários.
- Teste SQLite real cria versão anterior, faz backup consistente, migra e reusa recibo sem cobrar. `npm run world:upgrade` foi executado no banco existente: integridade ok; saldos, estoques, titulares, parâmetros já salvos, 1.098 lançamentos, sete recibos, nove remessas e sete jobs preservados. Relatório local em `.runtime/review/migration-main.json`. Novos campos ausentes foram preenchidos; parâmetros já presentes não foram recalibrados.
- Cinco testes Playwright/Edge: dez telas; celular 390 px; compra → contratação → chegada → produção → recarga; titularidade/filtros vazios/avançado/tabela; animação temporizada e recarga. Cada execução inicia banco novo em `.runtime/e2e` e portas exclusivas 5183/3013, sem reutilizar o servidor principal. O teste de animação usa um contrato real gerado pelo domínio com relógio controlado, sem comandos no banco principal.
- Revisão visual 1920×1080 e 390×844. Corrigidos agrupamento de praças sobrepostas e enquadramento das cargas ativas. Marcadores agrupados aproximam sem selecionar um município; valores de áreas sobrepostas não são somados. A cartografia mínima da fase anterior foi preservada.
- Evidências ignoradas pelo Git em `test-results/economy`: painel avançado, análise móvel e rota. Testes verificam ausência de erros JavaScript e rolagem horizontal da página móvel; tabelas têm rolagem própria.
- `npm run balance:season -- --days=30`: cenário isolado, dinheiro conservado, 48 remessas, 34 jobs concluídos. Feijão/leite ficam sem estoque físico nem ofertas; aço não foi anunciado pelos humanos inativos. O relatório denuncia rupturas em vez de gerar reposição infinita.

## Limitações aceitas com próxima ação

O motor e a apresentação estão verificados, mas não há equilíbrio de temporada demonstrado. Agricultura, demanda final, planejamento dos bots, contratação, especialização, recuperação de insolvência e crédito permanecem incompletos. Ver `docs/product/GAME-DESIGN-AUDIT.md`.

Fontes e valores reais são âncoras de calibração, sem cotação econômica externa em runtime. O perfil de rota é automotivo/estimado e não representa trânsito/GPS. Retenção de observações é móvel. Histogramas/candles não inventam negócios ausentes.

Build emite aviso de tamanho nos módulos MapLibre/ECharts. Estão separados por importação de páginas, mas orçamento e desempenho em hardware modesto exigem medição antes do alpha. Não há alegação de melhoria percentual de FPS.

Uma tentativa inicial de E2E encontrou API antiga presa na porta; reiniciada usando banco de teste. Durante desenvolvimento, recarga de módulo do contexto produziu um erro transitório; a execução estável foi repetida sem alterações de código durante o fluxo. O teste de aba foi corrigido para o papel acessível `tab`. Esses resultados iniciais não são tratados como validação final.
