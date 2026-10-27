# Fase 05 · Recursos rastreáveis antes de ampliar o catálogo

**Problema do jogador:** uma receita cadastrada não demonstra que seus insumos podem ser obtidos, que há comprador ou que a operação paga os custos.

**Resultado observável:** consultar cada item desde a origem até o consumo final, reproduzir custos e identificar os bloqueios antes de balancear ou adicionar conteúdo.

**Requisitos relacionados:** ECO-03/04/06/08/11/13 e CAT-01/02/03/04/05.

## Fontes e escopo

Catálogo físico em `model.ts`; receitas e configuração efetivas em `world.season.config`; estoque inicial em `seed.ts`/`competition.ts`; capacidade em `operations.ts`; cobranças em `metrics.ts`; execução em `engine.ts`. GDD preservado. Parâmetros são simulados, sem pesquisa de preços reais nesta etapa.

1. Unificar as listas já existentes de consumo familiar/programas públicos, preservando valores e ordem.
2. Gerar catálogo de dez itens/nove receitas com unidades, obtenção, consumo, custo, capacidade, massa e limitações.
3. Auditar referências, perfil, produtor bot, partida das cadeias, destino final e balanço de massa com fronteiras agregadas declaradas.
4. Registrar padrão matemático, ficha obrigatória de novo item, prioridades e experimentos de balanceamento.
5. Demonstrar produção e venda de cada saída pelos comandos comuns em mundos isolados; testar rejeições e conservação.
6. Complemento solicitado pelo usuário: relatório único de números das mecânicas, origem/valor das sementes e de óleo/farelo/leite, com inventário dos fluxos incompletos. Distinguir inicialização, preço de referência, custo contábil, anúncio e produção. Exportar configuração e números do código com origem, sem recalibrar o jogo.
7. Auditoria matemática solicitada: demonstrar inconsistências de capacidade, demanda, custeio, cronologia e equilíbrio das cadeias com fórmulas/provas em cenários isolados. Entregar achados priorizados e reproduzíveis, sem aplicar rebalanceamento ou alterar o banco.

## Invariantes

Sem alterar preços/receitas/saldos da season, migrar banco, avançar relógio do jogador ou adicionar dependências. Leitura opcional do SQLite usa conexão somente leitura, sem importar o store que migra/ticka. Relatório da season salva permanece em `.runtime`, separado do catálogo de abertura versionado. Auditoria aprovada estruturalmente não significa equilíbrio econômico.

## Critério de saída

Catálogo regenerável, contrato matemático e modelo de admissão; verificações automáticas integradas ao check; evidência por receita/item, cenários existentes contextualizados e pendências com próxima ação. Esta entrega prepara a calibração e não conclui a sustentabilidade da fase 05.
