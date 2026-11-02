# Plan 003 · Régua honesta

## Princípio

Esta spec muda **como se mede**, não **o que o jogo faz**. O motor não pode mudar: a régua antiga (procura atendida, linhas por receita, aço ao governo, caminhões, `moneyDrift`) tem de dar números idênticos antes e depois, com a mesma semente. Só a métrica `margins` muda de definição, de propósito.

## Passos

### 0 · Régua de não regressão

- Gerar `test-results/spec-003-before.json` com o script atual: `--days=20 --window=10 --seeds=0 --scale=1`. Ao fim de cada passo que toca `packages/`, comparar `coverage*`, `lines.*.observed`, `governmentSteelPerDay`, `trucks*`, `moneyDrift` (tolerância zero; o motor é determinístico).

### 1 · Congelar o equipamento antes de mexer na calculadora

- Hoje `economy-v2.ts:89-90` deriva `equipmentByRecipe` de `analyzeDesign()` (equipamento = lucro × payback − terra). Se a fórmula do lucro mudar, o equipamento do motor muda junto.
- Criar em `catalog.ts` a tabela explícita `equipmentByRecipe` com os valores que o motor usa **hoje** (copiar exatamente do `season.config` de um mundo novo; já estão arredondados a R$ 1.000). `economy-v2.ts` passa a ler a tabela. Régua idêntica.
- `lineEconomics` passa a devolver `paybackDays = capex / profit` como saída; o equipamento derivado vira só "equipamento sugerido" no relatório da calculadora.

### 2 · Calculadora realista

- `designWorld.utilization = 0.7` e `designWorld.realizedPrice = 0.95`.
- `lineEconomics`: `profit = (revenue × realizedPrice − materials − freight − variable) × utilization − fixed`. O resultado "a plena capacidade" continua disponível como `profitAtCapacity` para comparação.
- `analyzeDesign` ganha três verificações por receita: `profit ≥ 1,5 × fixed`, `margin ≥ 0,15`, `paybackDays ∈ [20, 60]`. As receitas que falham hoje vão para uma lista explícita `knownBalanceDebt` no próprio teste (`tests/economy-design.test.ts`): o teste exige que a lista de falhas seja **exatamente** essa (nem nova falha, nem falha resolvida sem atualizar a lista). A spec 006 esvazia a lista.
- Corrigir `dailyFlows().cows` (`NaN`: lê `lines.dairy` em vez de `lines['milk-production']`).
- Régua de não regressão idêntica (a calculadora não alimenta mais o motor depois do passo 1, exceto preços — conferir que `priceList()` não depende de `profit`).

### 3 · Resultado por negócio honesto

- `stockValue` passa a valorar a custo: `q × unitCosts[id]` (custo médio ponderado que o motor já mantém), não `wholesalePrices`.
- **Lotes em curso**: somar, por empresa, `Σ output[id] × outputCosts[id]` dos `jobs` não concluídos (o insumo já saiu do estoque e o processamento já foi pago).
- **Mercadoria em trânsito**: somar, para o comprador, `cost + freight` das `shipments` não entregues (o caixa já saiu e a carga ainda não está no estoque). Para transferências internas, só o frete.
- Resultado da janela = fluxo operacional (já exclui capital) + Δ(estoque a custo + lotes em curso + trânsito). Documentar a fórmula no topo do script.

### 4 · KPIs novos

- **Utilização por receita**: ciclos concluídos na janela ÷ (Σ `equipmentLines` × `cyclesPerDay(r)` × janela) das unidades com aquela especialidade.
- **Lucro por linha observado ÷ projeto**: `margins[r] / lines[r].observed` ÷ `lineEconomics(r).profit` (com utilização e preço realizado).
- **Preço realizado ÷ referência**: média ponderada por quantidade do `unitPrice` nas vendas `wholesale` da janela ÷ `wholesalePrices[id]`.
- Manter os KPIs de mundo e fixar o alvo de cada um num objeto `targets` exportado (procura atendida ≥ 0,55 com bots; dias de estoque 1–7; HHI < 2.500 na escala 20; quebras 0; aço ao governo ≥ 0,8 da meta; `moneyDrift` = 0; lucro/linha ÷ projeto 0,8–1,2; utilização 0,7–0,95).

### 5 · Agregação entre sementes e parâmetros

- Padrão: `--days=60 --window=30 --seeds=0,1,2,3,4 --scale=1`. A escala do playtest (20) é passada explicitamente; documentar o comando paralelo (uma semente por processo com `--out`, junta com `--from`).
- Saída por métrica: `{ median, min, max }` entre sementes; o resumo do console e o documento usam mediana e faixa, nunca média.
- `runLab` (`lab.ts`) aceita `scale` e repassa a `createScenario`.

### 6 · Documento e regra de aceitação

- `--write-doc` escreve `docs/product/PROVA.md` (nome sem versão; a economia é única). Apagar `PROVA-V2.md` e `PROVA-V2-ESCALA-20.md`; atualizar referências (`STATE.md`, `DEVELOPMENT-LAB.md`, `ECONOMIA-ALVO.md`, `ECONOMIA-HOJE.md`, `README.md`). Histórico das provas antigas fica no Git.
- Tabelas: KPIs de mundo com alvo e situação (dentro/fora), e por receita: linhas, utilização, lucro/linha observado, projeto, quociente, preço realizado — sempre mediana [mín–máx].
- `CONSTITUTION.md` §5: registrar a regra de aceitação (mediana melhora e pior caso não piora em todos os KPIs com alvo).

### 7 · Baseline

- Rodar a régua padrão em escala 1 e em escala 20 (5 sementes, paralelo) e publicar o `PROVA.md` resultante como baseline da 006. Registrar o tempo (A4).

## Riscos

- **`unitCosts` em float e estoque inicial custeado a preço de fábrica** (D-033): o estoque de abertura entra a custo = preço; isso é aceitável porque a janela começa no dia 30 e mede só a variação.
- **Determinismo (A2)**: rodar a mesma semente duas vezes e comparar o JSON inteiro (exceto `msPerDay`).
- **Tempo na escala 20**: ~10 s por dia × 60 dias ≈ 10 min por semente; 5 processos em paralelo. Se a máquina não aguentar, publicar escala 20 com 3 sementes e registrar.

## Decisões técnicas reversíveis

1. `PROVA.md` substitui os dois documentos de prova.
2. Falhas da calculadora como dívida explícita no teste, em vez de teste vermelho.
3. Alvos dos KPIs em código (`targets`), lidos pelo documento.
