# Economia interna · Temporada local

## Contrato da temporada

Referências do mundo real ajudam a escolher a configuração **antes da abertura**. Cada mundo persiste sua própria `season.config`: preços iniciais, faixas de calibração, receitas, salários, utilidades, combustível, consumo representado, população e qualificação. Editar os templates do código não muda uma temporada existente. Não há coleta de cotações externas pelo motor. Propostas de balanceamento devem gerar outra configuração e uma nova temporada, com migração/decisão explícita se houver mudança no mundo em andamento.

A migração v1 → v2 cria a configuração inaugural, mantém dinheiro, inventários, titularidades, lançamentos, recibos e prazos contratados. Recalibra apenas imóveis ainda disponíveis e anúncios de bots. Não cobra o novo custo retroativamente. O banco anterior é salvo em `.runtime/backups/pre-v2-*.sqlite` antes da conversão transacional.

Valores são parâmetros de jogo em escala brasileira, não cotações comerciais verificadas de cada município. Fontes e notas de calibração ficam em `packages/simulation/src/calibration.ts`; não são serviços consultados em execução. Âncoras nacionais de participação/desocupação não equivalem a uma pesquisa municipal. As faixas não impõem teto/piso ao mercado.

## Dinheiro, estoque e tempo

- Transferências em centavos inteiros, entre contas existentes. Salários voltam ao orçamento dos consumidores; serviços e utilidades são receitas do tesouro do estado da operação. Nenhum tick cria dinheiro ou estoque de reposição.
- Reservas de produção consomem entradas antes da fila. Extração reduz a reserva mineral. Coprodutos distribuem o custo total proporcionalmente ao valor interno na contratação; a soma alocada é conservada.
- Uma compra paga mercadoria e frete, reserva estoque na origem e ocupa o veículo. O destino recebe uma vez, ao evento de chegada. Custo médio inclui frete. Transferência interna não registra venda artificial entre unidades da mesma empresa.
- Laboratório a 120×: um minuto real equivale a duas horas do jogo; 12 ticks representam um dia. A interface mostra tempo real e virtual no frete.

## Mão de obra

Contratação disponível em todas as cidades, sem pool de candidatos. O limite técnico por unidade é 1.000 funcionários, não escassez regional.

Salário mensal = maior entre mínimo da season e salário da atividade × multiplicador estadual × índice salarial interno. Os 27 multiplicadores são parâmetros congelados em `season.config.competition.stateFactors`, não dados salariais ao vivo. O índice começa em 1 e, a cada sete dias virtuais, aumenta de 0,2% a 2%, pela folha paga no próprio estado: `min(0,02; 0,002 + salários pagos na semana / 10¹¹ centavos)`. A história estadual fica visível na equipe.

Folha diária = empregados × salário × encargos de cenário 1,65 ÷ 30. Abrir indústria contrata 18 funcionários; fazenda, seis; demais atividades, 12. A compra ainda agrega imóvel/instalação/equipe; separar estas decisões continua no backlog.

Educação de produtores custa funcionários × R$ 350 × nível de destino, dura 12 horas virtuais e tem cinco níveis. A formação média acrescenta três pontos de qualidade por nível, com limite de 100. Qualidade também depende das entradas e do local. O treinamento concluído beneficia somente novos jobs; não requalifica estoque nem lotes contratados. Novos empregados entram com formação zero: `média nova = média anterior × equipe anterior / equipe nova`. Equipe zerada perde a formação. Alterar equipe durante treinamento ou reduzir durante lotes reservados é rejeitado.

## Logística regional

Índice de 0–100 = 35% acesso + 35% frota + 30% fornecedor.

| Componente | Fórmula, limitada a 0–100                                 |
| ---------- | --------------------------------------------------------- |
| Acesso     | `100 − distância cadastrada até rodovia × 12`             |
| Frota      | `veículos livres até 150 km ÷ 5 × 100`                    |
| Fornecedor | `100 − distância estimada até fornecedor com estoque ÷ 3` |

O índice é informativo e dinâmico. Não garante capacidade para uma mercadoria específica. A compra faz uma cotação própria, verifica massa/volume e divide quantidades inteiras entre veículos compatíveis por massa e volume. Toda a frota é validada antes do primeiro débito. A ficha revela os componentes.

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

Demanda das famílias = população representada (1% da praça) × consumo mensal por produto ÷ 30. Vendas são limitadas por caixa, estoque, equipe e elasticidade do preço interno. Demanda industrial usa a especialização persistida e a capacidade por equipe/área, limitada pelo plano de ciclos da operação. É potencial modelado, não ordens de compra garantidas. Cobertura = estoque anunciado ÷ demanda diária modelada.

O mapa usa bolhas comparáveis por preço, estoque, cobertura ou demanda. Sem produto selecionado, agrega valores em reais, não toneladas com embalagens. A análise municipal inclui fornecedores num raio padrão de 120 km: praças vizinhas compartilham ofertas e **não devem ser somadas**. O filtro estadual inclui apenas estabelecimentos do estado. Limite de raio altera os números atuais; histórico municipal permanece em 120 km e isso é informado.

Histórico contém observações geradas pelo mundo. Não há série sintética anterior à abertura. A retenção atual é de 33.000 amostras multidimensionais, uma janela móvel, não o arquivo completo de uma temporada. Candles usam transações de atacado executadas em intervalos de um minuto real (duas horas do jogo). A média móvel precisa de sete observações válidas. Zoom, cursor cruzado, escala logarítmica, livro de vendas, tabela, CSV e PNG oferecem aprofundamento progressivo.

## Pedidos, propostas e logística por pedido

Humanos e bots publicam necessidades de compra com destino, quantidade, preço desejado, frete máximo e prazo. Um pedido aberto não movimenta dinheiro. Fornecedores propõem termos e o comprador pode contrapropor; somente a contraparte aceita. Pedidos dirigidos continuam disponíveis ao consultar uma oferta. Aceitação revalida saldo, estoque, qualidade aplicável, espaço, veículos, frete e prazo, reserva mercadoria e despacha tudo na mesma transação.

Pedidos pendentes entram nas autorizações de caixa ao publicar novas necessidades. Isso não é escrow: compras e custos posteriores ainda podem consumir o saldo; o aceite pode falhar. Nenhuma proposta reserva estoque antes do aceite, portanto é possível perdê-lo para outra venda. Não há dívida automática, multa ou pagamentos parcelados.

Logística agrupa por contrato público, pedido comercial ou lote de transferência. Mostra todas as viagens, o total recebido e cada caminhão na rota persistida. Só conclui após todos os recebimentos. Pequeno deslocamento visual entre marcadores evita sobreposição; não modifica tempo, posição econômica ou distância contratada.

Transferência própria aceita origem/destino pausados, porque pausa de produção não bloqueia movimentação do depósito. Usa estoque físico sem exigir oferta, paga somente o transporte e preserva custo/qualidade. Não cria receita interna. Caixa/frete continuam obrigatórios.

## Abastecimento configurável

Lojas, indústrias, mineradoras e armazéns têm política própria, inicialmente desativada para humanos. Mínimo dispara reposição; o ciclo continua até o alvo, considerando o que já está em trânsito ou pendente. Cada regra controla produto, mínimo, alvo, quantidade por compra e preço máximo. Controles avançados: orçamento diário, caixa protegido, origem interna prioritária/exclusiva ou mercado, distância, qualidade mínima, frete por unidade, frota e compra imediata ou pedido negociado.

A política paga materiais/frete reais e registra consumo do orçamento. Transferência interna gasta só frete. Orçamento de produção é separado: cobre processamento/utilidades; não substitui o orçamento de abastecimento. Fornecedor humano recebe pedido para aceitar. Regra sem fornecedor/caixa/frota informa a espera e não inventa material. Sem teto de preço/frete significa zero configurado; os demais limites continuam ativos.

A visão simples mostra necessidades e dinheiro sinalizado. A avançada compara estoque com e sem uma reposição, por sete dias, e respeita os horários de chegada existentes. Pedidos ainda não aceitos não viram estoque previsto. Custo da configuração é zero; a interface separa desembolso de compras, contribuição potencial, fixos e resultado hipotético. Valores usam preços/capacidade atuais, antes dos limites de orçamento e sem garantia de venda. Não é previsão de equilíbrio nem lucro assegurado; futuros pedidos, preços e múltiplas rodadas de reposição não são simulados no gráfico.

## Tesouros estaduais e programas municipais

Cada UF possui conta própria; somente estados com praças piloto recebem projetos neste laboratório. Arrecadação segue a unidade/UF que gerou a despesa. O tesouro legado guarda apenas compromissos anteriores; saldo livre/liberado é distribuído entre os estados piloto, com lançamento de orçamento e sem emissão.

Caixa disponível = saldo estadual − reservas de editais abertos. Quantidade de projetos simultâneos: no máximo cinco, limitada por caixa livre, custo de cada projeto e cadência de meio dia virtual. Um edital só abre se couber **mercadoria + frete**. Estado sem verba não cria obrigação. Pagamento acontece na adjudicação/despacho; a reserva do edital é liberada e o estoque é consumido pelo programa ao chegar.

Referência do item = mediana de anúncios com estoque de pelo menos três empresas diferentes; se não houver, abertura congelada da season. Teto por unidade = referência × 1,25, salvo no edital. Referência não acompanha mudanças posteriores. É uma referência interna de ofertas, não preço externo nem média de negócios executados.

Programas variam quantidade, qualidade mínima, item e prazo: pontes/acessos, escola, saúde, drenagem, cobertura pública, cozinhas comunitárias e alimentação escolar. Prefeituras são pontos virtuais de recebimento perto da praça, não prédios oficiais geocodificados. A janela de disputa dura seis horas virtuais; quantidade e qualidade estão no edital.

Julgamento: qualidade até 45 pontos; desconto até 25; prazo até 20; frete até dez. Desconto pontua linearmente até 25% do teto; prazo e frete usam a fração restante da verba/janela contratada. No fechamento, estoque, qualidade e frota são reavaliados e os pontos recalculados. Melhor pontuação válida vence; empate favorece proposta anterior. Se a vencedora perdeu condições, a próxima válida é tentada. Sem fornecedor viável, encerra sem pagamento. Entrega integral pode usar vários caminhões e vai à prefeitura indicada.

Contratos antigos conservam preços, prazos e regras já acordados. Não há prêmio como fração do caixa estadual em novos editais. Crédito e emissão monetária continuam ausentes: este fluxo recircula parte da arrecadação via compras públicas; não garante equilíbrio macroeconômico.

## Concorrentes automatizados

Trinta novas empresas, além das oito anteriores, usam os mesmos comandos: publicam necessidades, propõem e contrapropõem, aceitam pedidos, compram/transferem, produzem, anunciam, disputam editais, investem em educação e expandem sob restrições. Estratégias regionais, de custo e de qualidade variam decisões. O painel Mercado → Concorrentes mostra caixa e atividade efetivamente executada, sem eventos decorativos.

Capital inaugural é transferido da conta existente dos consumidores, até R$ 1 milhão por empresa, limitado a 60% do caixa institucional dividido entre os concorrentes faltantes. Instalação, estoques finitos e veículo usado são pagos e registrados. Isso redistribui liquidez; não cria dinheiro. Educação inicial é um parâmetro de formação da abertura, não treinamento gratuito durante a season. Nenhum tick repõe dinheiro/estoque. Reservas minerais são finitas; produção agrícola automatizada protege uma unidade de semente nas receitas agregadas.

`director.ts` publica o registro de capacidades e a versão de comportamento. O teste de cobertura exige perfil e produtor bot para cada receita: novas receitas precisam atualizar concorrentes e verificação. Isso não significa que todas as funções futuras estarão cobertas automaticamente. O planejador é heurístico e sujeito a falta de caixa, atrasos e perda de oportunidades.

Arroz, feijão e açúcar combinam cultivo e beneficiamento; leite combina criação/envase no mesmo estabelecimento. São cadeias agregadas do laboratório, com custo, duração, energia, água e entradas finitas. Não modelam agronomia, área cultivada por ciclo, rebanho, validade ou clima.

## Migração e manutenção

`operationsVersion=3` adiciona políticas, concorrentes e contas estaduais sem resetar o mundo. Migração transacional faz backup, conserva saldos humanos, estoques, titularidade, frota, histórico, recibos, jobs e prazos existentes. Novas receitas/perfis complementam a configuração; parâmetros de receitas existentes permanecem salvos. Lançamentos de abertura explicam toda redistribuição institucional.

O período da atualização de regras não é cobrado retroativamente: se o tick econômico está vencido, o primeiro novo tick passa para o instante da migração. Entregas e lotes vencidos mantêm seus eventos e são liquidados normalmente. Reinícios comuns sem migração continuam processando o tempo offline.

## Limites e próxima validação

O ciclo ainda não fecha para todo o catálogo: não confundir uma economia movimentada com equilíbrio sustentável. Ver [auditoria de design](GAME-DESIGN-AUDIT.md) para riscos, métricas e próximos experimentos. O cenário inclui patrimônio inicial de demonstração; não é a progressão de um novo jogador de temporada pública.
