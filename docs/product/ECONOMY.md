# Economia interna · Temporada local

## Contrato da temporada

Referências do mundo real ajudam a escolher a configuração **antes da abertura**. Cada mundo persiste sua própria `season.config`: preços iniciais, faixas de calibração, receitas, salários, utilidades, combustível, consumo representado, população e qualificação. Editar os templates do código não muda uma temporada existente. Não há coleta de cotações externas pelo motor. Propostas de balanceamento devem gerar outra configuração e uma nova temporada, com migração/decisão explícita se houver mudança no mundo em andamento.

A migração v1 → v2 cria a configuração inaugural, mantém dinheiro, inventários, titularidades, lançamentos, recibos e prazos contratados. Recalibra apenas imóveis ainda disponíveis e anúncios de bots. Não cobra o novo custo retroativamente. O banco anterior é salvo em `.runtime/backups/pre-v2-*.sqlite` antes da conversão transacional.

Valores são parâmetros de jogo em escala brasileira, não cotações comerciais verificadas de cada município. Fontes e notas de calibração ficam em `packages/simulation/src/calibration.ts`; não são serviços consultados em execução. Âncoras nacionais de participação/desocupação não equivalem a uma pesquisa municipal. As faixas não impõem teto/piso ao mercado.

## Dinheiro, estoque e tempo

- Transferências em centavos inteiros, entre contas existentes. Salários voltam ao orçamento dos consumidores; serviços e utilidades acumulam no tesouro. Nenhum tick cria dinheiro ou estoque de reposição.
- Reservas de produção consomem entradas antes da fila. Extração reduz a reserva mineral. Coprodutos distribuem o custo total proporcionalmente ao valor interno na contratação; a soma alocada é conservada.
- Uma compra paga mercadoria e frete, reserva estoque na origem e ocupa o veículo. O destino recebe uma vez, ao evento de chegada. Custo médio inclui frete. Transferência interna não registra venda artificial entre unidades da mesma empresa.
- Laboratório a 120×: um minuto real equivale a duas horas do jogo; 12 ticks representam um dia. A interface mostra tempo real e virtual no frete.

## Mão de obra

`pool = população congelada × 75% idade ativa × 62,1% participação × 5,4% disponíveis × 10% mercado jogável × qualificação`.

Qualificação é uma simplificação por atividade: indústria/mineração 30%, transporte 40%, demais 60%. Candidatos disponíveis = pool arredondado − funcionários das unidades da praça, incluindo operações pausadas. São candidatos modelados, não pessoas identificadas no mundo real. O cadastro piloto mais próximo representa municípios ainda sem praça própria.

Salário mensal = maior entre mínimo do cenário e salário da atividade × `(1 + pressão de ocupação × 15%)`. Folha diária = empregados × salário × fator de encargos 1,65 ÷ 30. O fator é simplificado, sem tentar implementar toda a legislação. Uma nova unidade requer 12 candidatos e abre com 12 contratos; a interface informa o compromisso antes de comprar.

O limite de contratação é uma abstração inicial: não há seleção por profissão, treinamento, deslocamento pendular ou demissão. Ver auditoria de design.

## Logística regional

Índice de 0–100 = 35% acesso + 35% frota + 30% fornecedor.

| Componente | Fórmula, limitada a 0–100                                 |
| ---------- | --------------------------------------------------------- |
| Acesso     | `100 − distância cadastrada até rodovia × 12`             |
| Frota      | `veículos livres até 150 km ÷ 5 × 100`                    |
| Fornecedor | `100 − distância estimada até fornecedor com estoque ÷ 3` |

O índice é informativo e dinâmico. Não garante capacidade para uma mercadoria específica. A compra faz uma cotação própria, verifica massa/volume e escolhe o veículo compatível mais próximo. A ficha revela os componentes.

Preço do frete = combustível + manutenção por km + motorista + pedágios estimados + manuseio + margem do transportador. Inclui deslocamento até a coleta. O total contratado é revalidado; alteração de cotação rejeita a operação antes de cobrar. OSRM usa perfil automotivo; a alternativa geográfica é identificada. Não há tarifa de pedágio nem trânsito externo em tempo real.

A remessa salva a geometria e os horários de coleta, carregamento, saída e chegada. O veículo animado interpola a distância acumulada da linha em função do tempo. Ao atingir o destino, aguarda o servidor confirmar a entrega. Recarregar não reinicia o trajeto. A animação representa cronograma, não telemetria GPS nem trânsito.

## Energia, água e pausa

Sim, são pagas. Tarifas iniciais por estado ficam congeladas na temporada. Em SP: R$ 0,92/kWh e R$ 20/m³ de água + esgoto. São tarifas agregadas do cenário, sem faixas ou tributos reais detalhados.

- Operação diária: 5 kWh e 0,12 m³ por funcionário, além de folha e manutenção.
- Produção: quantidade de kWh e m³ da receita × ciclos × tarifa; cobra no início e capitaliza no lote.
- Pausar interrompe novas operações, mantendo folha/manutenção/consumos da estrutura. A fábrica não recebe desconto fictício por alternar a pausa entre ticks.
- Extrato e finanças separam pagamentos de energia, água, folha e manutenção. Pagamento em caixa e custo reconhecido no resultado podem ocorrer em momentos diferentes.

## Preços e oportunidades

O catálogo mostra todos os dez itens, suas unidades e abertura da temporada, mesmo quando não existe oferta. Preço das ofertas é média ponderada pelo estoque; preço médio de varejo aparece separado. Ausência de oferta é `null`, nunca preço zero. Variação é contra a abertura; não se apresenta como retorno diário.

Demanda das famílias = população representada (1% da praça) × consumo mensal por produto ÷ 30. Vendas são limitadas por caixa, estoque, equipe e elasticidade do preço interno. Demanda industrial estima entradas das receitas habilitadas, limitada a 24 ciclos/dia. É potencial modelado, não ordens de compra garantidas. Cobertura = estoque anunciado ÷ demanda diária modelada.

O mapa usa bolhas comparáveis por preço, estoque, cobertura ou demanda. Sem produto selecionado, agrega valores em reais, não toneladas com embalagens. A análise municipal inclui fornecedores num raio padrão de 120 km: praças vizinhas compartilham ofertas e **não devem ser somadas**. O filtro estadual inclui apenas estabelecimentos do estado. Limite de raio altera os números atuais; histórico municipal permanece em 120 km e isso é informado.

Histórico contém observações geradas pelo mundo. Não há série sintética anterior à abertura. A retenção atual é de 33.000 amostras multidimensionais, uma janela móvel, não o arquivo completo de uma temporada. Candles usam transações de atacado executadas em intervalos de um minuto real (duas horas do jogo). A média móvel precisa de sete observações válidas. Zoom, cursor cruzado, escala logarítmica, livro de vendas, tabela, CSV e PNG oferecem aprofundamento progressivo.

Bots usam comandos iguais: compram de fornecedores finitos, contratam veículos, produzem, publicam ofertas e ajustam preço por custo e estoque. Reposição automática de lojas é opt-in para humanos, com teto de R$ 30 mil por dia do jogo e limite de 25% do caixa por compra. Preços de bots não consultam serviços externos. Estoques esgotados continuam esgotados até uma entrega ou produção real.

## Limites e próxima validação

O ciclo ainda não fecha para todo o catálogo: não confundir uma economia movimentada com equilíbrio sustentável. Ver [auditoria de design](GAME-DESIGN-AUDIT.md) para riscos, métricas e próximos experimentos. O cenário inclui patrimônio inicial de demonstração; não é a progressão de um novo jogador de temporada pública.
