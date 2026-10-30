# Validação da interface · 30/10/2026

Revisão das alterações locais antes de sincronizar o repositório. A direção visual
vigente está em [IDENTIDADE-JOGO](IDENTIDADE-JOGO.md); a evidência de Geist Pixel
em [TIPOGRAFIA](TIPOGRAFIA.md) descreve a versão anterior.

## Resultado entregue

- Livro-caixa nas telas: Archivo condensada, IBM Plex Mono e Caveat Brush locais,
  notas de papel, carimbos e ilustrações pixel. Protótipo e cinco imagens em
  `docs/design/direcao-autoral.html` e `docs/design/assets/direcao/`.
- Mapa com filtros de titularidade, camadas, painel do terreno e prévia de compra.
- Pedidos e entregas reunidos na implementação de `features/pedidos`; os módulos
  antigos de pedidos, contratos e entregas encaminham para as telas canônicas.
- Frota, loja, abastecimento, instalação e Início com os componentes atuais.

## Correções encontradas na revisão

- Instalação preserva capacidade zero quando uma especialidade não cabe no imóvel.
  Explica a área necessária e bloqueia instalação/confirmação inválida; expansão
  sem espaço também informa o limite. A validação autoritativa continua no motor.
- Aviso de mercadoria entregue abre Concluídos, inclusive quando Pedidos já está
  aberto em outra aba. Navegação comum limpa essa intenção; leitura persiste.
- Preferências informa a aceleração real a partir de `TIME_SCALE` e identifica
  economia/lotes como simulados. Acesso sem rota validada aparece como estimado.
- Testes de navegação e abertura foram atualizados para os controles atuais.
  O teste de entrada pela landing acompanha o título atual de Meus negócios.

## Verificações executadas

| Verificação                                                                                                  | Resultado                                                                    |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `npm run check`                                                                                              | Build, 230 testes em 31 arquivos, auditoria de recursos e catálogo aprovados |
| `npm run format:check` e `git diff --check`                                                                  | Aprovados                                                                    |
| `npm run ui:contraste`                                                                                       | Todos os pares declarados aprovados, incluindo texto sobre papel             |
| `npm run lab:catalog`                                                                                        | Catálogo regenerado: 14 telas, 92 fontes alcançáveis                         |
| `npx playwright test tests/e2e/navigation.spec.ts tests/e2e/notifications.spec.ts tests/e2e/landing.spec.ts` | 11 testes aprovados                                                          |
| `npx playwright test tests/e2e/opening.spec.ts --output=test-results/github-opening`                         | 3 testes aprovados                                                           |

Navegação cobre desktop 1920×1080 e celular 390×844: Início, Preferências, mapa e
seleção por teclado, prévia de compra, loja e suas quatro abas, Comprar, Cotações,
Pedidos, Contratos, frota, Empresa, busca e persistência da página. Sem erro de
JavaScript ou rolagem lateral da página nos fluxos exercitados.

Abertura executa compra, instalação e contratação pelo mesmo motor usado pelo
servidor, em memória: conserva dinheiro e não contrata equipe automaticamente.
Testes de área insuficiente e expansão no limite não enviam comando nem cobram.
Avisos de entrega testam abertura/reabertura, agrupamento e leitura após recarga.

Capturas locais: `test-results/mapa-desktop.png`, `mapa-mobile.png`,
`loja-desktop.png`, `loja-mobile.png`, `frota-desktop.png`, `frota-mobile.png`,
pastas `test-results/notifications-*` e `test-results/github-opening/`.
Capturas de mapa desktop e loja/frota no celular também foram inspecionadas.
Log final do check em `.runtime/review/github-check.log`. Esses artefatos de
execução são ignorados pelo Git; os testes e este registro são versionados.

## Limites e próxima ação

- Fixtures em memória e SQLite exclusivo de E2E; nenhum teste abre os bancos
  `.runtime/world.sqlite` ou `.runtime/economy-2.sqlite`.
- Tiles vazios controlados verificam layout/controles do mapa; não comprovam
  cartografia ou rotas reais. As entregas dos avisos são fixture de apresentação.
- Executados os quatro arquivos E2E acima, não a suíte inteira. Próxima ação:
  adaptar os seletores antigos de `business.spec.ts`, `transport.spec.ts`,
  `intelligence.spec.ts`, `procurement.spec.ts` e `economic-flow.spec.ts` antes
  de usar esses testes como evidência da interface atual.
- O coletor geral de capturas ainda precisa tratar títulos e modal de primeiros
  passos. Nenhuma referência visual do laboratório foi substituída nesta revisão.
- Permanecem os 29 alertas econômicos conhecidos da auditoria e os avisos de
  tamanho de MapLibre/ECharts. Estrutura válida não comprova balanceamento.
- Esta sincronização não conclui as etapas C/D, autenticação ou acesso público.
