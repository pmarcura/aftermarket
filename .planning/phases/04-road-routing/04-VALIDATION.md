# Validação · Rotas, recuperação e fluxo · 0.4.0

27/10/2026, America/Sao_Paulo. Escopo autorizado inclui regras do jogo e interface, mais o refinamento de frota/conexões/alertas pedido durante a execução.

## Resultado jogável

O jogador vê quais frotas atendem ao produto e quantidade, ajusta explicitamente ao máximo, revisa frete/veículos e contrata trajeto salvo pelas estradas. Pode conectar estoques/produtoras a destinos por regra de reposição, consultar a rede e receber erro visível na janela. Empresa sem caixa vê compromissos, custos pendentes e opções finitas de recuperação. Novos negócios precisam de instalação/equipe; dados analíticos são observados ou cenários identificados.

## Verificações

| Área                 | Evidência                                                                                                                                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compilação           | TypeScript e Vite passam; sem nova dependência. Aviso de bundles >500 kB permanece em MapLibre/ECharts                                                                                                                      |
| Domínio/persistência | 93 testes em nove arquivos: conservação, estoque, autorização, obrigações, garantias, reserva, referência, instalação e cenários                                                                                            |
| Roteamento           | Sem cobrança quando rota falta; validação de resposta, deduplicação, cache/falha/cooldown, enriquecimento de ruas, geometria imutável e migração visual sem mudar termos                                                    |
| Frota/espaço         | Arredondamento individual por caminhão, massa/volume, exclusão de veículos ocupados/manutenção, estoque e espaço já comprometido                                                                                            |
| Conexão fixa         | Origem própria, não desvia ao mercado se esgota, pré-cálculo respeita origem, sem movimentar caixa ao apenas configurar                                                                                                     |
| Navegador            | 12 fluxos completos: animação, negociação/automação, recuperação/gráficos, roteamento/recarga, compra/entrega/produção, inteligência, navegação desktop/móvel, instalação, edital, cartões/alerta/conexão, leitura agrupada |
| Refinamento final    | Navegação e teste de transporte verificam painel da rede, formulário vazio, desktop/celular e alertas dentro do dialog                                                                                                      |
| Geografia real       | Pedido existente FerroVale → Indústria: 31,4277 km, 630 pontos, 18 trechos; `.runtime/review/road-real.json` e `road-real-desktop.png`, sem erro JavaScript                                                                 |
| Mundo principal      | Migração aditiva, backup e integridade OK; 44.700 lançamentos mantidos, 57 recibos, 604 remessas, 829 jobs; parâmetros econômicos anteriores preservados                                                                    |

Capturas de interface em `test-results/design`: frota/erro desktop e móvel, rede de abastecimento, recuperação e abertura. A pasta é recriada a cada execução Playwright; não é arquivo histórico de season. Fixtures de rota na porta 3014 são curvas artificiais para testar o mecanismo; não demonstram aderência à rua. Essa demonstração é a captura real separada.

`npm run check`, `npm run test:e2e`, `npm run format:check` e `git diff --check` são os comandos de saída. SQLite experimental e bundles grandes são avisos materiais registrados, sem falha de compilação.

## Cenários econômicos isolados

Dinheiro conservado e nenhum saldo negativo em cada dia. Ações humanas desligadas; estimativa geográfica permitida explicitamente para o teste sem rede. Relatórios guardam configuração e observações diárias. Semente altera calendário/estratégias; IDs transacionais continuam UUIDs. Resultados agregados podem ser comparados, não hashes bit a bit.

| Cenário            | Dias | Viagens | Contratos concluídos |    Gasto público | Rivais novos ativos |       Atrasados | Principal aberto | HHI agregado |
| ------------------ | ---: | ------: | -------------------: | ---------------: | ------------------: | --------------: | ---------------: | -----------: |
| baseline, seed 0   |   90 |   1.935 |                   76 | R$ 17.364.174,03 |               21/30 | R$ 3.226.858,34 |    R$ 226.091,32 |     7.752,48 |
| baseline, seed 1   |   90 |   1.710 |                   71 | R$ 16.357.017,55 |               20/30 | R$ 3.213.779,05 |    R$ 251.270,69 |     7.746,44 |
| low-demand, seed 3 |   90 |   1.617 |                   74 | R$ 17.017.670,30 |               20/30 | R$ 3.044.815,44 |    R$ 208.244,34 |     7.803,51 |
| starter, seed 2    |   30 |   2.032 |                   52 | R$ 12.052.391,98 |               29/30 |    R$ 11.036,45 |     R$ 39.461,53 |     2.589,62 |

Todos terminam com oferta nos dez produtos; isso não prova oferta contínua nem mercado saudável por praça. Baseline 0 foi reexecutado depois da limitação de espaço na reposição e reproduziu os agregados acima. Outras rodadas foram executadas durante a mesma revisão antes desse refinamento; não são quatro replicações do código final. O iniciante redistribui ativos/capital na abertura: não é comparação controlada de uma regra isolada. No baseline final, há sete estruturas suspensas, 1.362 jobs concluídos e 3.000 t de aço consumidas. Não mascarar perdas com dinheiro/estoque infinito.

Arquivos: `.runtime/balance/season-0.4-{scenario}-{seed}-{days}d.json`. Reprodução: `npm run balance:season -- --days=90 --scenario=baseline --seed=0`; variantes `low-demand`, `starter`. Nenhum comando usa o banco principal. O cenário iniciante interativo usa `npm run dev:starter` e banco próprio.

## Limites e próximas decisões

A entrega de rotas não conclui perfil truck nem coleta/retorno vazio. A recuperação não conclui política de execução de garantia. A referência resiste a anúncios e repetição de pares, mas não comprova resistência a conluio com contas diversas. Não há identidade pública/concorrência entre conexões relacionais. Demanda baixa/base/alta é sensibilidade, não previsão probabilística.

Concentração e atrasados exigem playtest humano iniciante, revisão de custos/demanda/contratos por item e teste de season lenta antes de expandir catálogo. Dados externos só calibram outra abertura; não corrigir a season usando preço real ao vivo. Ver `docs/product/GAME-DESIGN-AUDIT.md` e `docs/research/ROUTING.md`.
