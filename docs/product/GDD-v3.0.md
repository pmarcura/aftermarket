# AFTERMARKET
## Game Design Document — Versão 3.0
### Especificação de produto, gameplay, economia e interface

**Gênero:** Persistent Economic MMO / Geographic Business Simulator / Idle Management

**Plataforma:** Navegador web, inicialmente desktop.

**Território:** Brasil, com geografia e malha rodoviária baseadas em dados reais.

**Mundo:** Uma única economia compartilhada por jogadores humanos e empresas automatizadas.

**Modelo:** Free-to-play sem venda de vantagens econômicas.

**Identidade:** Um simulador empresarial que utiliza a geografia como elemento fundamental das decisões econômicas.

---

# 1. CONCEITO FUNDAMENTAL

AFTERMARKET é um simulador de empreendedorismo em que os jogadores administram negócios localizados geograficamente no Brasil.

Em vez de construir uma cidade, o jogador participa de uma economia já existente, formada por cidades, regiões produtivas, empresas, consumidores, propriedades e redes de transporte.

Cada jogador começa com capital limitado e precisa identificar oportunidades economicamente viáveis.

Ele pode abrir uma loja, adquirir uma propriedade agrícola, operar uma mineradora, desenvolver uma indústria, estabelecer um centro de distribuição ou criar uma empresa de transporte.

Todas essas atividades dependem umas das outras.

Uma indústria precisa adquirir matérias-primas. Uma loja precisa comprar mercadorias. Uma mineradora precisa encontrar compradores. Uma transportadora precisa de cargas. Uma fazenda precisa de insumos e canais de distribuição.

O valor de um negócio depende não apenas do que ele produz, mas também de onde está localizado, quanto custa operá-lo, quais fornecedores estão próximos, quais clientes podem ser atendidos e quanto os concorrentes cobram.

**O jogador não administra o Brasil. Ele constrói uma empresa dentro da economia brasileira simulada.**

## 1.1. Objetivo do jogador

O objetivo principal é desenvolver uma empresa economicamente sustentável e competitiva.

Não existe uma única condição obrigatória de vitória.

O jogador pode buscar:

- Maior patrimônio líquido.
- Maior receita e lucratividade.
- Domínio de uma determinada categoria comercial.
- Maior participação de mercado regional.
- Maior eficiência logística.
- Maior volume industrial.
- Expansão para diferentes estados.
- Especialização como prestador de serviços.

Os indicadores são consequências da atividade empresarial, não tarefas artificiais.

## 1.2. Princípios inegociáveis

1. Uma única geografia compartilhada.
2. Empresas de bots e jogadores seguindo as mesmas regras.
3. Nenhuma fabricação sem insumos reais.
4. Nenhuma venda sem produto ou capacidade de atendimento.
5. Nenhum transporte sem origem, destino, carga e custo.
6. Nenhum recurso mineral ilimitado.
7. Nenhuma propriedade duplicada entre participantes.
8. Nenhum edifício 3D obrigatório no mapa.
9. Nenhum sistema de fusões.
10. Nenhum botão que execute uma ação fictícia.
11. Todas as decisões importantes devem ter consequências financeiras.
12. A interface deve facilitar decisões, não criar trabalho administrativo desnecessário.

---

# 2. O MUNDO GEOGRÁFICO

## 2.1. Mapa único do Brasil

O mapa utiliza a geografia real do território brasileiro, incluindo limites municipais, rodovias, rios e informações ambientais necessárias à jogabilidade.

Não será necessário reconstruir visualmente as cidades com milhares de casas e edifícios.

A representação cartográfica precisa ser limpa e semelhante a aplicativos profissionais de mapas.

A experiência central será:

**Localizar → Investigar → Comparar → Adquirir → Operar.**

O jogador pode navegar pelo Brasil inteiro, aproximar regiões e pesquisar municípios específicos.

O mundo permanece compartilhado: se um participante adquirir um estabelecimento em determinada localidade, esse negócio passará a existir para todos os usuários da mesma economia.

## 2.2. Níveis de zoom

**Brasil:** apresentar estados, grandes rotas, principais concentrações econômicas e indicadores regionais agregados.

**Estado:** apresentar municípios, polos produtivos, corredores logísticos e concentração empresarial.

**Município:** apresentar regiões comercializáveis, oportunidades econômicas, atividades instaladas e principais vias de acesso.

**Área comercializável:** apresentar limites da propriedade, negócios próximos e acesso rodoviário.

**Estabelecimento selecionado:** abrir painel administrativo sem mudar para uma cena 3D.

A quantidade de detalhes visuais deve aumentar gradualmente conforme o zoom.

Os marcadores serão agrupados automaticamente em escalas amplas.

## 2.3. Representação dos negócios

Cada estabelecimento é representado por dois elementos.

**Polígono territorial:** delimita visualmente sua área de operação, com uma cor discreta associada à categoria econômica.

**Marcador central:** apresenta um ícone identificando a atividade principal.

Exemplos:

- Mineração: picareta.
- Agricultura: planta.
- Indústria: fábrica.
- Comércio: loja.
- Logística: caminhão.
- Armazenamento: caixa.

O jogador visualiza apenas os marcadores relevantes à camada ativa e ao nível de aproximação.

Ao selecionar um estabelecimento, sua propriedade é destacada e um painel lateral apresenta suas informações.

A cor do polígono representa a atividade. Um contorno independente indica seleção ou propriedade, evitando confundir categoria com titularidade.

Os ícones devem manter tamanho legível mesmo quando a área territorial é extensa.

## 2.4. Propriedades geográficas

O jogo não precisa utilizar os lotes imobiliários reais do Brasil.

Essa informação não está disponível de maneira uniforme, completa e diretamente utilizável para todo o território.

AFTERMARKET deve criar **propriedades virtuais georreferenciadas**, vinculadas à geografia real.

As propriedades serão grandes o suficiente para serem identificadas no mapa e economicamente relevantes.

Categorias iniciais:

**Comerciais:** áreas destinadas a lojas e pontos de venda.

**Industriais:** áreas destinadas a transformação e fabricação.

**Rurais:** áreas aptas a determinadas atividades agrícolas.

**Extrativas:** concessões virtuais para exploração de recursos naturais.

**Logísticas:** depósitos, armazéns e centros de distribuição.

Cada propriedade terá uma geometria persistente, identificador único e conexão válida à rede viária.

As propriedades devem respeitar regras de geração por região, evitando sobreposições, posicionamentos dentro de rios, estradas ou áreas classificadas como indisponíveis.

## 2.5. Zoneamento predefinido

O jogador não define livremente o zoneamento de qualquer lugar.

As regiões já possuem categorias de uso e restrições determinadas pelo sistema do jogo, apoiadas em características geográficas reais.

Uma área predominantemente agrícola pode disponibilizar propriedades rurais. Uma região industrial consolidada pode oferecer instalações industriais. Zonas comerciais são vinculadas a núcleos urbanos e mercados consumidores.

O zoneamento do jogo é uma simplificação econômica e não uma reprodução oficial de autorização municipal de uso do solo.

Uma propriedade elegível à mineração também exige concessão virtual, depósito compatível e condições operacionais.

## 2.6. Aquisição de propriedades

O jogador pode:

**Comprar terreno disponível:** adquirir uma propriedade desocupada para estabelecer uma atividade permitida.

**Comprar estabelecimento existente:** adquirir um negócio com instalações, estoques e condições explicitamente identificados na oferta.

**Alugar propriedade:** iniciar uma operação com investimento inicial menor, mediante pagamentos recorrentes.

**Comprar de outro participante:** negociar propriedades anunciadas por jogadores ou empresas automatizadas.

O sistema precisa mostrar claramente se o preço anunciado inclui apenas o imóvel, as instalações, o estoque ou toda a operação.

Uma propriedade nunca pode pertencer simultaneamente a dois compradores exclusivos.

O mapa brasileiro continuará geograficamente estável, enquanto propriedade e titularidade mudarão com a economia.

---

# 3. RECURSOS GEOGRÁFICOS

A disponibilidade de recursos naturais será uma consequência da localização.

O jogador não poderá instalar uma mina de ferro em qualquer município nem plantar qualquer cultura com a mesma produtividade em todas as regiões.

## 3.1. Mineração

As áreas extrativas possuem depósitos minerais simulados.

Cada depósito registra:

- Substância mineral.
- Localização.
- Reserva estimada disponível.
- Teor ou qualidade.
- Dificuldade de extração.
- Custo operacional.
- Capacidade máxima de retirada.
- Infraestrutura exigida.
- Condições ambientais.
- Situação da concessão virtual.

Os depósitos serão gerados utilizando informações geológicas como referência.

A exploração reduz a reserva disponível.

Um depósito não deve gerar minério infinitamente porque o proprietário está offline.

A reserva pode ser estimada com incerteza; pesquisas geológicas do jogo poderão melhorar essa estimativa. A quantidade efetivamente extraída será registrada.

A existência real de um processo minerário ou de uma ocorrência geológica não será tratada automaticamente como prova de reservas economicamente recuperáveis.

## 3.2. Agricultura

A viabilidade agrícola depende da região, do solo, das condições climáticas e da cultura selecionada.

Cada propriedade rural apresenta um catálogo restrito de culturas compatíveis.

Para cada cultura, mostrar:

- Produtividade estimada.
- Período de plantio.
- Duração do cultivo.
- Necessidade de água e insumos.
- Custo de produção.
- Rendimento por hectare.
- Capacidade de armazenamento.
- Risco de perda.
- Próxima colheita.

As condições regionais serão baseadas em indicadores climáticos e agrícolas reais, mas simplificadas em parâmetros de gameplay.

A produção é executada por ciclos e continua offline.

O agricultor escolhe o que plantar considerando o preço esperado, o custo e a distância dos compradores.

## 3.3. Indústrias

Indústrias transformam recursos existentes em outros produtos.

Uma siderúrgica precisa de insumos metalúrgicos adequados. Uma indústria alimentícia precisa de produtos agrícolas. Uma serraria utiliza madeira obtida de fornecedores válidos.

Toda receita possui quantidade de entrada, saída, perdas, tempo e custo.

A localização industrial interfere em aluguel, trabalhadores, capacidade e frete.

As instalações possuem nível tecnológico e capacidade de processamento, mas **não existe fusão de construções**.

O jogador melhora uma indústria por meio de investimento, expansão de capacidade, equipamentos e tecnologia.

## 3.4. Comércio

Lojas compram produtos acabados de fabricantes, distribuidores ou comerciantes e vendem aos consumidores simulados.

Uma loja não fabrica automaticamente aquilo que vende.

Ela precisa manter estoques, definir preços e escolher fornecedores.

A demanda depende da localização, categoria comercial, preços concorrentes, tamanho do mercado e disponibilidade dos produtos.

Comércio atacadista e varejista terão funções diferentes.

Atacadistas negociam volumes maiores entre empresas.

Varejistas atendem principalmente a demanda agregada da população virtual.

---

# 4. TIPOS DE NEGÓCIO

O catálogo inicial será limitado a seis categorias funcionais.

| Categoria | Função | Receita principal |
|---|---|---|
| Fazenda | Cultivar e colher | Venda da produção agrícola |
| Mineradora | Extrair recursos | Venda de matérias-primas |
| Indústria | Transformar materiais | Venda de produtos e processamento |
| Loja | Distribuir ao consumidor | Margem de varejo |
| Armazém | Armazenar e distribuir | Serviço de armazenagem |
| Transportadora | Movimentar mercadorias | Pagamento por frete |

Uma mesma empresa pode possuir estabelecimentos de várias categorias.

Isso permite integração vertical, mas também possibilita especialização.

Um empreendedor pode prosperar administrando somente uma transportadora ou uma cadeia de lojas.

## 4.1. Operações individuais

Cada estabelecimento terá:

Identificador, nome, proprietário, localização geográfica, categoria, propriedade associada, capacidade, funcionários, estoque, custos, receita e estado operacional.

Quando aplicável, também terá energia, licenças, receitas produtivas, recursos disponíveis e rotas.

## 4.2. Expansão

A expansão de um negócio poderá acontecer de três formas:

**Melhoria:** investimento em equipamentos para aumentar a produtividade ou reduzir custos.

**Ampliação:** aumento de capacidade física ou operacional dentro dos limites do estabelecimento.

**Nova unidade:** abertura ou aquisição de outro negócio, possivelmente em uma localização diferente.

Isso substitui completamente o antigo sistema de fusões.

---

# 5. CADEIA DE SUPRIMENTOS

A economia será construída sobre cadeias produtivas compartilhadas.

Cada produto deve possuir origem e possíveis destinos.

Exemplo de cadeia metalúrgica:

Minério de ferro → Beneficiamento → Insumos metalúrgicos → Produção de aço → Componentes industriais → Distribuição.

A produção de aço deve exigir insumos energéticos e metalúrgicos coerentes com a rota tecnológica adotada. Etapas complexas podem ser agregadas para manter o jogo administrável, mas os custos e materiais essenciais não podem surgir gratuitamente.

Exemplo agrícola:

Cultivo de trigo → Colheita → Transporte → Moagem → Farinha → Panificação → Varejo.

A mesma matéria-prima poderá atender diferentes compradores e receitas.

Cada etapa pode pertencer a um jogador diferente.

A cadeia inteira não precisa estar sob o controle da mesma empresa.

## 5.1. Unidade física dos produtos

Todos os produtos utilizarão unidades padronizadas.

Cada item registra:

- Unidade comercial: unidade, kg, tonelada ou litro.
- Massa física por unidade.
- Volume por unidade.
- Valor comercial.
- Categoria.
- Condições especiais de armazenamento, quando aplicável.
- Origem e lote de estoque.
- Receitas nas quais é utilizado.

A massa e o volume não podem ser apenas elementos visuais. Devem influenciar capacidade de veículos e custos logísticos.

A interface pode converter automaticamente kg para toneladas conforme o volume negociado.

## 5.2. Produção idle

Uma indústria continua produzindo quando o jogador sai, desde que existam insumos, energia, trabalhadores e espaço para armazenar as saídas.

O sistema calcula produção com base no tempo transcorrido, capacidade e eventos que alteram suas condições.

Uma fábrica não pode acumular produtos além da capacidade de armazenamento.

Quando falta um insumo, a produção para e o jogador recebe uma notificação explicando o gargalo.

## 5.3. Automação

O jogador pode estabelecer regras simples:

- Comprar matéria-prima quando o estoque ficar abaixo de um limite.
- Produzir determinada receita enquanto houver insumos.
- Reservar parte do estoque para contratos.
- Enviar produtos a um depósito quando atingir determinada quantidade.
- Reabastecer uma loja com estoque de um armazém próprio.

As automações executam operações reais com orçamento e disponibilidade limitados.

Não devem garantir preços nem disponibilidade futura.

---

# 6. CONCORRÊNCIA E DEMANDA REGIONAL

Esta será uma das funcionalidades mais importantes do AFTERMARKET.

Antes de abrir um negócio, o jogador pode investigar o mercado da região.

A análise deve responder:

**Existe procura suficiente para o que pretendo vender?**

**Quantas empresas já atendem esse mercado?**

**Qual é o custo para abastecer essa localização?**

**Quanto os concorrentes estão cobrando?**

**Qual investimento faz sentido nesse contexto?**

## 6.1. Demanda por categoria

Cada município ou região comercial terá demanda agregada por determinadas categorias de produtos.

Essa demanda é gerada por um modelo econômico populacional, apoiado em dados regionais e calibrado para a simulação.

Os consumidores virtuais possuem orçamento agregado e necessidades de consumo.

A demanda não é uma quantidade infinita que compra qualquer produto oferecido.

Se várias lojas competem pela mesma população, elas disputam a mesma capacidade de consumo.

## 6.2. Análise de oportunidades

O jogador pode selecionar uma categoria, produto e área do mapa.

O sistema apresenta:

- Demanda estimada por período.
- Vendas efetivamente atendidas.
- Capacidade disponível de concorrentes.
- Preço médio praticado.
- Número de empresas participantes.
- Oferta regional.
- Rotas de abastecimento.
- Custo logístico estimado.
- Disponibilidade de propriedades compatíveis.

Uma região sem concorrentes não deve ser automaticamente considerada lucrativa.

Pode não haver clientes, mão de obra, fornecedores ou infraestrutura adequada.

## 6.3. Concorrência

Empresas disputam consumidores com base em uma combinação de:

Preço final, estoque disponível, localização, tempo de acesso, capacidade de atendimento e atributos comerciais relevantes.

Esses fatores devem seguir regras estáveis e compreensíveis.

O jogador deve conseguir descobrir por que uma loja está vendendo menos do que seus concorrentes.

Exemplos:

Preço acima do mercado, ruptura de estoque, demanda regional insuficiente ou vantagem de localização de outro estabelecimento.

Não utilizar distribuição inteiramente aleatória das vendas.

## 6.4. Indicador de oportunidade

Podemos fornecer uma estimativa de viabilidade econômica para cada atividade e região.

Ela deve ser derivada de receita projetada, despesas estimadas, competição e risco.

O resultado será exibido como:

- Potencial favorável.
- Potencial moderado.
- Potencial desfavorável.
- Dados insuficientes.

A interface precisa mostrar os motivos da avaliação e as premissas utilizadas.

Não apresentar o indicador como uma garantia de lucro.

---

# 7. EMPRESAS AUTOMATIZADAS — BOTS

**Bots são participantes econômicos completos.**

Essa regra define todo o desenho da simulação.

O Brasil virtual não começa vazio esperando que os jogadores construam sua economia.

O mundo inicia com empresas automatizadas espalhadas por regiões produtivas, cidades e corredores logísticos.

Essas empresas podem ser mineradoras, fazendas, indústrias, lojas, armazéns e transportadoras.

Elas possuem nomes fictícios, capital, patrimônio, estabelecimentos, estoques e objetivos comerciais.

## 7.1. Igualdade de regras

Jogadores e bots utilizam o mesmo sistema para:

Comprar e vender propriedades.

Criar empresas e estabelecimentos.

Produzir recursos e mercadorias.

Comprar insumos.

Contratar transportadoras.

Oferecer fretes.

Definir preços.

Publicar e aceitar contratos.

Comprar e vender produtos.

Operar estoques.

Pagar salários, manutenção e custos.

Expandir ou encerrar atividades.

Nenhuma empresa automatizada possui direito a inventário infinito, produção gratuita ou execução instantânea de transportes.

## 7.2. Comportamento econômico

Cada bot avalia periodicamente suas condições.

Uma loja pode aumentar seus pedidos se as vendas crescerem.

Uma indústria pode procurar um fornecedor mais barato caso seu custo de produção aumente.

Uma transportadora pode reduzir preços para aproveitar capacidade ociosa.

Uma mineradora pode suspender extração caso não encontre compradores capazes de cobrir seus custos.

Um bot pode ter prejuízo, perder competitividade, vender ativos ou encerrar sua empresa.

## 7.3. Perfis empresariais

Para produzir comportamentos variados, os bots podem possuir parâmetros como:

- Tolerância ao risco.
- Margem mínima desejada.
- Preferência por fornecedores próximos.
- Reservas financeiras.
- Agressividade comercial.
- Grau de especialização.
- Política de estoque.
- Propensão ao investimento.

Esses perfis não concedem acesso a recursos impossíveis. Apenas modificam a maneira como os agentes tomam decisões.

## 7.4. Participação humana

O jogador pode negociar diretamente com qualquer bot elegível, assim como negocia com outros usuários.

As ofertas dos bots aparecem nos mesmos mecanismos comerciais.

A interface identifica empresas automatizadas de forma transparente.

Os bots devem garantir atividade econômica de base, mas não precisam manter artificialmente todos os mercados lucrativos.

A presença de concorrentes reais pode reduzir a participação relativa de agentes automatizados ao longo do tempo.

Ajustes populacionais de bots devem ocorrer por entrada, saída e comportamento econômico coerentes, sem apagar arbitrariamente negócios ou estoques existentes.

## 7.5. Tecnologia dos agentes

Não utilizar modelos de linguagem individuais para decidir cada compra, venda ou produção.

O sistema pode utilizar agentes baseados em objetivos, regras, preços, estoques e decisões periódicas.

Todos executam operações pela mesma camada de serviços econômicos usada pelos jogadores.

Isso reduz custo de processamento, melhora previsibilidade e permite auditar as decisões dos agentes.

---

# 8. MERCADO E NEGOCIAÇÃO

A economia será regionalmente distribuída, mas compartilhada.

Os estabelecimentos negociam entre si por meio de ordens e contratos.

A localização dos produtos importa.

Comprar ferro de uma empresa próxima pode ser mais vantajoso do que importar de outro estado, mesmo quando o preço anunciado é maior.

## 8.1. Ofertas

Cada vendedor pode estabelecer:

- Produto.
- Quantidade disponível.
- Preço unitário.
- Local de retirada.
- Lote ou qualidade, quando aplicável.
- Quantidade mínima de venda.
- Validade da oferta.
- Condições de entrega.

O produto deve estar fisicamente disponível em estoque ou claramente vinculado a um contrato de produção futura.

## 8.2. Ordens de compra

Os compradores também podem publicar demandas por produtos.

Uma ordem apresenta quantidade, preço máximo, destino e prazo.

Outras empresas podem atender integral ou parcialmente a ordem.

A contratação de transporte será integrada ao fechamento da negociação.

## 8.3. Comparação de fornecedores

O principal critério de comparação deve ser o **custo total colocado no destino**, não apenas o preço anunciado.

Exemplo ilustrativo:

| Fornecedor | Mercadoria | Frete | Total |
|---|---:|---:|---:|
| Empresa A — 40 km | 2.000 cr | 180 cr | 2.180 cr |
| Empresa B — 260 km | 1.750 cr | 620 cr | 2.370 cr |
| Empresa C — 95 km | 1.920 cr | 290 cr | 2.210 cr |

O fornecedor B anuncia a mercadoria mais barata, mas não oferece o menor custo final.

O jogador poderá comparar preço, prazo e confiabilidade em uma única interface.

## 8.4. Varejo

Lojas atendem a população simulada por meio de vendas agregadas.

O jogador define categorias, preços e estoque.

As vendas acontecem ao longo do tempo de acordo com a demanda local e a participação de mercado do estabelecimento.

A receita só pode ser gerada a partir de produtos existentes.

O consumo da população deve estar limitado a uma capacidade de compra calculada, sustentada pela economia simulada.

## 8.5. Contratos

Contratos complementam as ofertas comuns.

Servem para negociar:

Fornecimento recorrente, processamento industrial, compras programadas, entregas específicas e serviços logísticos.

Um contrato registra obrigações, prazo, quantidade, preço e condições de cancelamento.

O pagamento será reservado quando necessário e liberado conforme eventos de cumprimento verificáveis.

---

# 9. SISTEMA DE LOGÍSTICA

A logística será um dos mecanismos mais importantes do jogo.

Ela deverá funcionar como um negócio independente e também como serviço de apoio a outros empreendimentos.

Todas as remessas terão:

Origem, destino, material, quantidade, massa, volume, distância, custo, prazo e responsável pelo transporte.

## 9.1. Transportadores independentes

Jogadores e bots poderão atuar como caminhoneiros autônomos ou pequenas transportadoras.

O participante pode possuir um veículo e aceitar fretes publicados no mercado.

O veículo tem capacidade máxima, localização operacional e disponibilidade.

Uma viagem ocupa o veículo até a conclusão ou cancelamento válido.

Não haverá necessidade de conduzir caminhões manualmente.

## 9.2. Empresas transportadoras

Uma empresa logística poderá possuir:

- Sede operacional.
- Veículos.
- Capacidade de carga.
- Funcionários ou motoristas simulados.
- Contratos ativos.
- Rotas programadas.
- Custos de combustível e manutenção.
- Receita por serviço prestado.

O proprietário escolhe se os veículos atendem exclusivamente suas próprias empresas ou se também oferecem capacidade ao mercado.

## 9.3. Transporte próprio

Quando o jogador possui empresas em diferentes regiões, poderá configurar rotas internas.

Exemplo:

Mineradora → Refinaria → Centro de distribuição.

A rota apresenta quantidade transportada, frequência, custo estimado e utilização dos veículos.

A automação pode manter estoques mínimos em destinos configurados.

## 9.4. Frete terceirizado

Na ausência de frota própria, o jogador contrata outro participante.

A interface apresenta prestadores compatíveis com:

- Massa e volume da carga.
- Origem e destino.
- Capacidade disponível.
- Preço ofertado.
- Prazo estimado.

O comprador pode contratar o transporte para retirar a mercadoria no fornecedor.

O vendedor também poderá oferecer entrega ao cliente, incorporando o frete à sua proposta.

## 9.5. Modalidades de entrega

**Retirada pelo comprador:** o comprador assume a contratação e o custo do transporte.

**Entrega pelo vendedor:** o vendedor assume a obrigação de entregar a mercadoria ao destino combinado.

**Transporte contratado separadamente:** comprador e vendedor acordam a transferência da carga a uma transportadora.

A negociação precisa definir quando acontece a transferência de propriedade, quem paga o frete e quem suporta perdas em caso de descumprimento.

## 9.6. Cálculo do frete

O preço de referência do transporte pode considerar:

Distância rodoviária, tempo estimado, combustível, pedágios, tipo de veículo, utilização da capacidade, despesas operacionais e margem pretendida.

A capacidade disponível de um veículo é limitada tanto pelo peso quanto pelo volume.

O preço final deve ser ofertado pelo transportador, e não obrigatoriamente igual ao custo calculado pelo sistema.

O cálculo de rota utilizará a malha rodoviária real. Restrições de veículos pesados poderão ser consideradas quando estiverem disponíveis e confiáveis na base de dados.

## 9.7. Remessas e estados

Toda remessa passará por estados:

Preparação → Reserva da carga → Coleta → Em trânsito → Entrega → Conclusão.

Falhas possíveis incluem carga indisponível, transportador indisponível, contrato cancelado e impossibilidade de executar a rota.

As viagens continuam progredindo com os participantes offline.

O progresso visual mostrado no mapa representa eventos de simulação, não localização GPS real.

---

# 10. MENUS PRINCIPAIS

O menu esquerdo terá seis seções.

A arquitetura foi desenhada para permitir todos os fluxos essenciais sem espalhar ferramentas por múltiplos menus.

## 10.1. MAPA

**Finalidade:** navegar pelo Brasil e interagir com propriedades e estabelecimentos.

Elementos principais:

Mapa vetorial, busca por município ou empresa, zoom, camadas, marcadores, contornos de propriedades e painel contextual.

Camadas disponíveis:

- Mapa padrão.
- Empresas.
- Propriedades disponíveis.
- Zoneamento.
- Recursos naturais.
- Demanda e concorrência.
- Rotas comerciais.

Ao selecionar um estabelecimento, o jogador visualiza informações compatíveis com a titularidade e as permissões.

Ações:

Ver estabelecimento, consultar produção pública, negociar, comprar propriedade disponível, alugar ou acessar a administração de uma unidade própria.

## 10.2. OPORTUNIDADES

**Finalidade:** descobrir onde abrir negócios e o que vale a pena produzir ou comercializar.

Esta será uma seção central, inspirada no planejamento empresarial de Big Ambitions.

Filtros:

Localização, categoria de empresa, produto, capital disponível, demanda, concorrência e distância de fornecedores.

Subseções:

**Explorar mercados:** selecionar município e categoria, visualizar demanda e oferta.

**Concorrentes:** identificar empresas que atendem à mesma região e categoria.

**Recursos:** consultar disponibilidade agrícola, mineral e industrial.

**Imóveis:** consultar propriedades e estabelecimentos disponíveis para compra ou aluguel.

**Comparar localizações:** comparar oportunidades entre municípios.

Cada resultado apresenta contexto econômico e links diretos para o local no mapa.

A comparação pode estimar capital inicial, despesas operacionais, logística e receita potencial.

A estimativa deve mostrar suas premissas.

## 10.3. MEUS NEGÓCIOS

**Finalidade:** administrar os estabelecimentos pertencentes ao jogador.

Visão inicial:

Lista de empresas com nome, local, categoria, receita, resultado operacional e status.

Subseções:

**Estabelecimentos:** todas as unidades produtivas e comerciais.

**Produção:** receitas, filas, capacidade, consumo de insumos e interrupções.

**Estoque:** materiais por localização, quantidades e reservas.

**Compras e vendas:** abastecimento, preços e pedidos relacionados às unidades próprias.

Cada estabelecimento possui uma página de administração específica para sua categoria.

Uma loja apresenta produtos, preços e vendas.

Uma fazenda apresenta culturas, colheitas e produtividade.

Uma indústria apresenta receitas, insumos e capacidade.

Uma mineradora apresenta depósito, reserva e extração.

Um armazém apresenta capacidade, estoque e movimentações.

Uma transportadora apresenta veículos, fretes e disponibilidade.

A navegação deve utilizar a mesma estrutura visual, com campos especializados para cada atividade.

## 10.4. MERCADO

**Finalidade:** comprar e vender produtos e negociar serviços entre participantes.

Subseções:

**Mercadorias:** ofertas e ordens de compra e venda.

**Serviços:** processamento industrial, armazenagem e serviços comerciais disponíveis.

**Contratos:** demandas publicadas, contratos aceitos e obrigações comerciais.

**Minhas ordens:** negociações abertas, parcialmente executadas e concluídas.

**Histórico:** preços, volumes e transações realizadas.

Cada item de mercado apresenta preço e estoque com localização.

A interface permite comparar custo total incluindo transporte.

Os contratos são integrados ao sistema econômico e financeiro.

## 10.5. LOGÍSTICA

**Finalidade:** movimentar materiais e operar serviços de transporte.

Subseções:

**Minhas cargas:** produtos aguardando transporte ou em trânsito.

**Contratar frete:** procurar transportadores para uma remessa.

**Fretes disponíveis:** ofertas de serviços que o jogador pode executar.

**Frota:** veículos próprios, capacidade, custo e localização operacional.

**Rotas:** conexões recorrentes entre empresas.

A logística deve permitir abrir o mapa para visualizar trajetos reais.

Um jogador sem transportadora própria ainda poderá utilizar todas as funções de contratação e acompanhamento de cargas.

A administração de frota aparece apenas quando existir um veículo ou negócio logístico associado ao jogador.

## 10.6. EMPRESA

**Finalidade:** administrar o patrimônio financeiro e o desenvolvimento estratégico.

Subseções:

**Visão geral:** caixa, patrimônio líquido, resultado financeiro, ativos e desempenho.

**Finanças:** receitas, despesas, impostos simulados, transações e relatórios.

**Pesquisa e licenças:** tecnologias e atividades disponíveis.

**Estrutura empresarial:** empresas controladas, nome, informações e permissões.

**Participação econômica:** desempenho regional, participação de mercado e rankings.

As funcionalidades de corporações multiplayer poderão ser adicionadas posteriormente dentro dessa seção, sem modificar a navegação principal.

---

# 11. PAINÉIS CONTEXTUAIS

O mapa deve continuar visível durante a investigação dos negócios.

Ao clicar em um marcador, surge um painel lateral direito.

Não abrir uma página inteira para apresentar quatro números ou executar uma compra simples.

## 11.1. Propriedade disponível

Mostrar:

Local, categoria, área, preço, acesso rodoviário, condições geográficas, usos permitidos e titularidade virtual.

Ações:

Comprar, alugar quando disponível e comparar região.

## 11.2. Empresa de outro participante

Mostrar:

Nome, categoria, localização, tipo de participante, produtos ou serviços anunciados, ofertas comerciais e condições públicas.

Ações:

Comprar produtos, solicitar serviço, consultar contratos disponíveis e visualizar estabelecimento.

Não mostrar saldos privados, custos estratégicos ou estoques não anunciados.

## 11.3. Empresa própria

Mostrar:

Nome, localização, estado operacional, receita, resultado, estoque crítico, atividade e alertas.

Ações:

Administrar, configurar produção, gerenciar produtos, contratar transporte, anunciar produtos ou acessar relatórios.

As ações são filtradas pelas capacidades reais do tipo de negócio.

## 11.4. Regras de interface

O painel utiliza largura consistente.

As informações aparecem na ordem:

Identidade → Situação → Indicadores → Problemas → Ações.

Informações avançadas são abertas apenas quando necessárias.

O jogador deve conseguir fechar o painel e continuar navegando sem perder o estado do mapa.

---

# 12. EXPERIÊNCIA INICIAL DO JOGADOR

O onboarding não deve começar com uma explicação extensa da economia brasileira.

O jogador aprende realizando um negócio real.

## 12.1. Primeira sessão

A experiência inicial apresenta um capital de abertura, ajustado ao balanceamento, e uma seleção de atividades com investimento acessível.

O usuário começa próximo a um município com oferta comercial e fornecedores acessíveis.

Sequência inicial:

1. Explorar o mapa.
2. Abrir a ferramenta de oportunidades.
3. Consultar a demanda por uma categoria simples.
4. Comparar dois estabelecimentos disponíveis.
5. Alugar ou comprar uma pequena loja.
6. Comprar o primeiro lote de mercadorias.
7. Contratar um transportador, preferencialmente um bot disponível.
8. Receber a mercadoria.
9. Definir o preço de venda.
10. Acompanhar as primeiras vendas à população simulada.
11. Comparar receita, custo da mercadoria e frete.
12. Decidir se vale a pena reabastecer, mudar preços ou expandir.

O jogador passa a compreender o modelo econômico antes de investir em mineração ou indústria.

## 12.2. Progressão

**Primeira fase:** aprender comércio, abastecimento e margem.

**Segunda fase:** abrir mais unidades ou entrar no atacado.

**Terceira fase:** produzir mercadorias ou prestar serviços logísticos.

**Fase avançada:** controlar cadeias produtivas e negócios em diferentes estados.

Não obrigar o jogador a seguir uma única profissão empresarial.

---

# 13. MODELO ECONÔMICO

A economia opera em créditos virtuais, sem conversão em dinheiro real.

## 13.1. Despesas

Os estabelecimentos precisam considerar:

Aquisição ou aluguel, salários, insumos, energia, manutenção, armazenamento, transporte e tributos simulados.

Alguns custos serão fixos. Outros variáveis conforme volume e localização.

## 13.2. Receita

A receita pode surgir de:

Varejo para consumidores simulados, negociação entre empresas, processamento de materiais, transporte, armazenagem e prestação de serviços.

Transferências internas de estoque entre unidades da mesma empresa não criam receita externa automaticamente.

## 13.3. Lucro

O resultado deve considerar os custos econômicos efetivos.

Uma compra de mercadoria para estoque não deve ser confundida automaticamente com despesa operacional integral do período.

O jogo precisa separar fluxo de caixa, estoque, faturamento e lucro.

## 13.4. Moeda e liquidez

Uma moeda principal será suficiente.

O sistema precisa definir como o dinheiro circula e como entra na economia.

Empresas pagam trabalhadores, fornecedores e prestadores de serviços.

Consumidores simulados recebem renda por mecanismos definidos no modelo populacional e compram produtos.

Agentes públicos simulados podem possuir orçamentos definidos para atividades específicas, quando necessário.

A emissão monetária deve ter regras documentadas e limites de balanceamento.

Não implementar moedas privadas, bancos ou mercados de câmbio no primeiro produto.

## 13.5. Mercado regional

Diferentes regiões terão diferentes preços e graus de concorrência.

A oportunidade comercial surge quando um fornecedor consegue atender um mercado com custo total competitivo.

Isso possibilita arbitragem espacial legítima: comprar em uma região e vender em outra, assumindo transporte, risco e custos.

O jogador deverá descobrir rotas lucrativas analisando preços e distâncias.

---

# 14. PERSISTÊNCIA E TEMPO

AFTERMARKET será persistente.

As empresas continuam operando enquanto seus proprietários estão desconectados.

O jogo poderá utilizar um relógio econômico acelerado, com fator de conversão uniforme e claramente apresentado.

Exemplo inicial para teste:

1 hora real = 6 horas de simulação.

Viagens, produção, salários e demanda deverão utilizar a mesma base temporal ou conversões explicitamente definidas.

O tempo acelerado não modifica a distância geográfica.

Uma viagem de longa distância continua sendo mais custosa e demorada do que uma entrega local equivalente.

O servidor administra eventos, estoques e estados.

Não será necessário simular continuamente todos os caminhões e estabelecimentos em intervalos de um segundo.

---

# 15. MUNDO PERSISTENTE E TEMPORADAS

A geografia compartilhada favorece um mundo econômico persistente, não resets frequentes de todos os ativos.

A aquisição de uma indústria ou mina deve representar uma decisão de longo prazo.

Portanto, a primeira versão não apagará propriedades e empresas ao final de cada temporada.

Temporadas podem existir como períodos de classificação e indicadores econômicos, sem destruir o patrimônio acumulado.

Recursos minerais continuam sujeitos a esgotamento, mas seu balanço deve contemplar períodos longos, e não somente semanas.

A expansão do conteúdo geográfico e novas áreas de concessão devem seguir regras públicas para evitar vantagens arbitrárias.

---

# 16. BASES GEOGRÁFICAS E DADOS REAIS

A arquitetura deve separar a geografia real dos atributos econômicos criados pelo jogo.

## 16.1. OpenStreetMap / Geofabrik

**Aplicação:** rede rodoviária, vias de acesso, rios e elementos básicos do mapa.

Usar os dados do OpenStreetMap como fundamento de um mapa vetorial próprio.

Preparar dados para renderização e roteamento sem depender permanentemente de requisições em serviços gratuitos comunitários.

## 16.2. IBGE

**Aplicação:** limites administrativos, municípios, população e parâmetros regionais para a economia simulada.

Os limites municipais permitem ancorar negócios, agregações e indicadores na geografia oficial.

## 16.3. Serviço Geológico do Brasil

**Aplicação:** referências geológicas e informações sobre ocorrências minerais.

Usar dados geológicos para orientar a localização de depósitos virtuais plausíveis.

O modelo de reservas, custos e produtividade continuará sendo definido e balanceado pelo jogo.

## 16.4. Agência Nacional de Mineração

**Aplicação:** informações geoespaciais de processos minerários e restrições relevantes.

Esses dados ajudam a compreender a distribuição de atividades e áreas de interesse mineral.

Não tratar processos minerários como títulos que possam ser vendidos livremente dentro do jogo, nem como prova de recurso disponível para extração imediata.

## 16.5. MapBiomas

**Aplicação:** classificação de cobertura e uso da terra, áreas agrícolas e características ambientais.

O jogo poderá utilizar a classificação territorial para apoiar decisões sobre propriedades rurais e zonas indisponíveis.

## 16.6. ZARC — Zoneamento Agrícola de Risco Climático

**Aplicação:** adequação regional e janelas de cultivo de determinadas culturas.

O sistema poderá utilizar as recomendações oficiais como referência e transformá-las em indicadores simplificados de risco e produtividade agrícola.

## 16.7. Dados simulados complementares

Precisarão ser gerados pelo motor econômico:

- Propriedades comercializáveis.
- Preços de terrenos virtuais.
- Estoques e depósitos exploráveis.
- Custos de instalação.
- Demandas e orçamentos simulados.
- Empresas automatizadas.
- Reservas e produtividade econômica.
- Licenças empresariais virtuais.
- Mercado de produtos e serviços.

A interface deve distinguir informação geográfica de referência, informação simulada e estimativa.

---

# 17. ARQUITETURA TÉCNICA

O projeto já possui uma base funcional. A implementação deve aproveitar essa estrutura antes de introduzir mudanças significativas de tecnologia.

A arquitetura precisa separar:

**Camada cartográfica:** renderização, zoom, busca, filtros e seleção geográfica.

**Camada territorial:** geometria de propriedades, zoneamento, disponibilidade e titularidade.

**Motor econômico:** produção, consumo, preços, custos e demanda.

**Motor de agentes:** decisões periódicas de empresas automatizadas.

**Motor logístico:** rede de transporte, capacidade, cotações, remessas e eventos.

**Camada financeira:** carteiras, reservas, transações e histórico auditável.

**Persistência:** estado compartilhado, estoques, contratos e operações offline.

## 17.1. Tecnologias candidatas

MapLibre GL JS para renderização cartográfica.

Dados vetoriais OpenStreetMap processados em infraestrutura própria ou serviço contratado compatível.

PostgreSQL com PostGIS para geometrias, propriedades e consultas espaciais.

Valhalla para cálculo de rotas, inclusive parâmetros de veículos de carga.

Um serviço de processamento de eventos e filas para produção, transporte e decisões dos bots.

Essas escolhas devem ser confirmadas após auditoria da base atual. A proposta não exige reescrever o frontend existente.

## 17.2. Integridade

A compra de propriedade precisa ser transacional.

O estoque precisa ser reservado antes de uma venda ou remessa.

O frete não pode transportar mais massa ou volume do que a capacidade real do veículo.

O saldo financeiro precisa ser verificado antes de aceitar contratos ou ordens.

Os bots devem executar as mesmas operações por serviços autoritativos.

O sistema precisa ser capaz de reconstruir o estado após interrupções, reconexões e atualizações do navegador.

---

# 18. PRIMEIRA VERSÃO JOGÁVEL

A primeira entrega não precisa simular todos os setores da economia brasileira.

Ela deve apresentar a geografia nacional, mas começar com um conjunto limitado de municípios economicamente ativos, conectados por rodovias.

Uma região piloto adequada seria o eixo São Paulo–Minas Gerais, permitindo negócios comerciais, agrícolas, industriais e rotas intermunicipais.

Outras regiões brasileiras poderão ser ativadas progressivamente.

## Escopo da primeira versão

- Mapa cartográfico do Brasil.
- Navegação e busca por municípios.
- Propriedades virtuais persistentes.
- Compra e aluguel de negócios.
- Empresas humanas e automatizadas.
- Duas cadeias produtivas completas.
- Lojas varejistas.
- Mercado de ofertas.
- Demanda regional de consumidores.
- Estoques físicos.
- Transporte rodoviário.
- Contratação de fretes.
- Produção e vendas offline.
- Administração financeira.
- Filtros de oportunidades e concorrentes.

As cadeias iniciais devem ser selecionadas por viabilidade técnica e coerência regional. Uma cadeia alimentar completa e uma cadeia de materiais industriais são suficientes para demonstrar o funcionamento do modelo.

## Fora do escopo inicial

Não implementar:

Construção de cidades, fusões, personagens 3D, condução manual de caminhões, moedas privadas, cassino, bolsa de ações, sistema político completo, centenas de receitas ou dezenas de categorias industriais.

Corporações avançadas e contratos multiparticipantes podem ser introduzidos depois que o comércio básico estiver estável.

---

# 19. PRIMEIRO CENÁRIO DE VALIDAÇÃO

O primeiro teste funcional deve demonstrar toda a cadeia econômica.

**Cenário: matéria-prima → indústria → varejo.**

Uma empresa automatizada opera uma propriedade extrativa no interior de Minas Gerais.

A empresa possui reserva disponível, capacidade operacional e estoque de matéria-prima.

Outra empresa, controlada por um jogador, possui uma indústria em São Paulo.

O jogador encontra o fornecedor através do mapa ou mercado, consulta o preço e escolhe o lote que deseja comprar.

O sistema apresenta opções de transporte, comparando custo, prazo e capacidade.

O jogador contrata uma transportadora automatizada ou humana.

O estoque é reservado na origem, o pagamento é tratado conforme as condições comerciais e a remessa inicia sua viagem.

Quando a carga chega, a matéria-prima entra no inventário da indústria.

A instalação consome materiais e energia para produzir um item intermediário.

Esse produto é anunciado no mercado.

Outro participante, que possui um negócio comercial ou industrial compatível, compra a mercadoria e contrata o transporte.

O item é efetivamente recebido e utilizado na próxima etapa produtiva ou vendido ao consumidor, conforme sua categoria.

Durante esse processo:

- Nenhum material aparece sem origem.
- Nenhum participante paga com saldo inexistente.
- Nenhuma mercadoria é vendida duas vezes.
- Nenhum caminhão ultrapassa sua capacidade.
- O custo de frete afeta a margem.
- O estoque de cada estabelecimento é atualizado.
- As transações são registradas.
- As empresas dos bots seguem as mesmas regras.
- O sistema permanece consistente quando os usuários estão offline.

Esse cenário deverá funcionar antes de expandir o jogo.

---

# 20. DESIGN VISUAL

AFTERMARKET precisa parecer uma plataforma de gestão econômica sofisticada, e não um city builder estilizado.

## 20.1. Linguagem visual

Mapa claro com ruas e limites geográficos discretos.

Interface escura para navegação e painéis administrativos.

Tipografia sans-serif contemporânea.

Ícones consistentes, pequenos e reconhecíveis.

Cores semitransparentes para áreas comerciais, agrícolas, industriais, logísticas e extrativas.

Gráficos simples com valores e escalas compreensíveis.

Tabelas para comparação de produtos, preços e estabelecimentos.

Sem excesso de animações, iluminação ornamental ou efeitos visuais.

## 20.2. Barra superior

Exibir permanentemente:

Logotipo, busca global, saldo, resultado operacional estimado, notificações e perfil.

Métricas secundárias ficam nas telas correspondentes.

## 20.3. Menu esquerdo

Apenas os seis destinos:

**Mapa — Oportunidades — Meus Negócios — Mercado — Logística — Empresa.**

Ícones e textos claros.

O menu pode ser recolhido.

Navegação com estado persistente, permitindo voltar ao mesmo ponto do mapa.

## 20.4. Interações

Um clique no marcador seleciona o negócio.

Um segundo comando abre a administração ou página pública correspondente.

Ações comerciais devem ser concluídas em fluxos curtos e verificáveis.

Toda confirmação financeira mostra valor, encargos, condições e consequência.

Não usar botões visualmente ativos para funcionalidades que ainda não existem.

## 20.5. Estados de interface

Cada funcionalidade deverá possuir estados de carregamento, vazio, disponível, indisponível, confirmação, sucesso e falha.

Mensagens de erro devem informar ações recuperáveis.

Uma entrega concluída deve indicar o recebimento real da carga, não somente o término de uma animação.

---

# 21. CRITÉRIOS DE QUALIDADE

O sistema será considerado pronto para seu primeiro teste econômico quando:

1. Dois jogadores visualizarem o mesmo mapa e a mesma titularidade das propriedades.
2. Um jogador conseguir adquirir uma propriedade disponível.
3. A propriedade não puder ser vendida simultaneamente a outro comprador.
4. Um negócio puder produzir utilizando insumos reais.
5. A produção persistir corretamente offline.
6. Uma empresa automatizada puder comprar, produzir, vender e contratar serviços.
7. O mercado apresentar ofertas sustentadas por estoque ou obrigações válidas.
8. Um comprador conseguir comparar custo da mercadoria e frete.
9. Um transportador conseguir aceitar e concluir uma remessa.
10. A carga chegar ao estoque correto.
11. Uma loja conseguir vender produtos existentes à população simulada.
12. A receita e os custos alterarem corretamente os resultados financeiros.
13. O mapa e os painéis exibirem dados provenientes do estado real do jogo.
14. Não existirem controles sem função implementada.
15. Erros de saldo, estoque, permissão e concorrência forem tratados sem duplicações.

---

# 22. DIRETRIZ FINAL DE DESENVOLVIMENTO

AFTERMARKET deve ser construído a partir da profundidade das relações econômicas, e não da quantidade de elementos visuais.

A experiência é observar o mapa e reconhecer oportunidades.

Encontrar uma cidade com demanda insuficientemente atendida.

Perceber que uma empresa distante oferece produtos baratos, mas o frete destrói sua margem.

Descobrir um fornecedor próximo.

Abrir uma indústria estrategicamente localizada.

Contratar uma transportadora independente.

Desenvolver uma rede de abastecimento.

Entrar em um novo mercado e encontrar concorrentes já estabelecidos.

Vencer pela eficiência, especialização, localização e capacidade administrativa.

**O jogo não deve perguntar ao jogador como ele deseja construir uma cidade. Deve perguntar qual negócio ele deseja criar, onde vale a pena operá-lo e como pretende torná-lo lucrativo.**

Esse é o fundamento definitivo do AFTERMARKET.