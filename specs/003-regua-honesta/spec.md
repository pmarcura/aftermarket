# Spec 003 · Régua honesta da prova econômica e KPIs de balanceamento

Estado: **rascunho**. Semana 2. Depende da 001.

## Problema

`scripts/economy-proof.ts` é a régua de todas as decisões de balanceamento (D-033, D-036 a D-041), e mede errado: o "resultado" de cada negócio é fluxo de caixa + Δestoque **a preço de referência** (`economy-proof.ts:137-163`), então quem compra a 0,92× registra +8% de lucro na hora e quem produz sem vender registra receita; lotes em curso não contam, o que penaliza colheitas de 96 h na borda da janela; a janela padrão é de 10 dias em 20; usa 2 sementes e publica média sem dispersão; `runLab` nem aceita `scale`. Na auditoria de 30/10, quatro negócios trocaram de sinal entre duas sementes com código idêntico: a régua não distingue balanceamento de ruído.

## Requisitos

- **R1** Resultado por negócio = caixa operacional (entradas − saídas no extrato, excluindo imóvel, equipamento, crédito e venda de ativos) + Δestoque **a custo médio** (`unitCosts`) + Δlotes em curso a custo. Nenhum preço de referência entra no resultado.
- **R2** Parâmetros padrão: `--days=60 --window=30 --seeds=0,1,2,3,4 --scale=<escala do mundo playtest>`; `runLab` e `economy-proof` aceitam `scale`.
- **R3** Saída por métrica: mediana, mínimo e máximo entre sementes. Nunca só média.
- **R4** KPIs novos por receita: `utilização` (ciclos executados ÷ ciclos possíveis), `lucro/linha observado ÷ lucro/linha de projeto` (projeto = `economy-design.ts` **com** `utilization` e `realizedPrice`, ver R6), `preço realizado ÷ referência` (vendas no atacado).
- **R5** KPIs de mundo (mantidos e com alvo explícito): procura atendida, dias de estoque por produto, HHI por produto, empresas quebradas/suspensas, aço ao governo ÷ meta, caminhões comprados/aposentados, `moneyDrift` (sempre 0).
- **R6** Calculadora: `designWorld.utilization = 0,7` e `realizedPrice = 0,95` aplicados em `lineEconomics`; `analyzeDesign` passa a exigir `profit ≥ 1,5 × fixed` e `margin ≥ 0,15` por receita; `equipmentByRecipe` deixa de ser derivado e vira tabela explícita em `catalog.ts` (valores iniciais = os derivados hoje, arredondados), com payback como **saída** e alvo [20, 60] dias. `tests/economy-design.test.ts` protege as três regras. `flows.cows` NaN corrigido.
- **R7** `--write-doc` regenera `docs/product/PROVA-V2.md` no formato novo (tabelas com mediana/min/máx, KPIs de R4/R5, hash da temporada); `PROVA-V2-ESCALA-20.md` é substituído por esse único documento parametrizado por escala.
- **R8** Critério de aceitação de mudanças de balanceamento registrado na constituição (§5): aceitar só se a mediana melhora e o pior caso não piora em todos os KPIs com alvo.

## Critérios de aceite

- **A1** Rodar a régua nova no código da 001 (sem mudar parâmetros) e publicar o baseline: é esperado que arroz/feijão/cana/esmagamento apareçam negativos e que a calculadora **falhe** o check de margem para essas receitas — a spec termina com o baseline registrado, não com a economia corrigida (isso é a 006).
- **A2** Mesmo mundo, mesma semente, duas execuções → resultados idênticos (determinismo preservado).
- **A3** `npm run check` verde; `economy-design.test.ts` com as regras novas.
- **A4** Tempo da régua padrão na escala do playtest ≤ 30 min em paralelo (5 processos).

## Fora de escopo

Mudar qualquer parâmetro para melhorar os KPIs (006); testes de adversário (006); UI do `/lab`.
