# Economia hoje

Resumo em linguagem simples, 30/10/2026. Existe **uma única economia** no motor (D-042, spec 001): a do catálogo da etapa B. Os números de projeto estão em [ECONOMIA-ALVO](ECONOMIA-ALVO.md); o que os bots fazem de verdade está nas provas [PROVA-V2](PROVA-V2.md) e [PROVA-V2-ESCALA-20](PROVA-V2-ESCALA-20.md). Para atualizar os relatórios técnicos: `npm run economy:report`.

| Pergunta                                                                 | Relatório                                                                 |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Quais produtos e receitas existem, quem fornece, quanto rende uma linha? | [RESOURCE-CATALOG](RESOURCE-CATALOG.md)                                   |
| De onde vem cada coisa e que fluxos estão incompletos?                   | [MECHANICS-REPORT](MECHANICS-REPORT.md)                                   |
| Como admitir um produto ou receita novo?                                 | [RESOURCE-STANDARD](RESOURCE-STANDARD.md) e [ficha](RESOURCE-TEMPLATE.md) |

## As cadeias

20 itens e 14 receitas, em 59 municípios.

```mermaid
flowchart LR
  subgraph Metal
    ferro[Minério de ferro] --> aco[Aço]
    carvao[Carvão] --> aco
    sucata[Sucata<br/>coleta municipal] -->|mesmo forno| aco
    aco --> gov[Governo<br/>editais de obras]
    aco --> utensilios[Utensílios] --> loja
    aco --> caminhoes[Caminhões pesado e leve] --> frota[Frotas]
    utensilios -.30% da massa volta.-> sucata
  end
  subgraph Alimentos
    soja[Soja<br/>replanta a própria semente] --> oleo[Óleo + farelo]
    oleo -->|óleo| loja[Lojas → famílias]
    oleo -->|farelo| racao[Ração] --> leite[Leite<br/>rebanho de vacas]
    leite --> loja
    graos[Arroz, feijão, açúcar<br/>replantam a própria semente] --> loja
  end
```

## Os furos que continuam

Medidos na escala 20 ([PROVA-V2-ESCALA-20](PROVA-V2-ESCALA-20.md)): arroz, feijão, utensílios e caminhão leve no vermelho; aço ao governo abaixo da meta (cerca de 180 de 320 t/dia); lojas atendem 51% da procura (alvo 70%). Ficam para as specs de balanceamento (003 e 006).

## Contas dos bots corrigidas

As contas que enganavam os bots continuam provadas em `tests/formula-fixes.test.ts`, sobre as receitas atuais.

| Código | O que garante                                                                                 |
| ------ | --------------------------------------------------------------------------------------------- |
| M02    | O bot só reabre um negócio contando os ciclos que a linha consegue fazer por dia.             |
| M03    | Previsão, reposição e procura industrial usam a mesma conta da produção automática.           |
| M04    | Frações da procura ficam guardadas: duas lojas iguais vendem quase o mesmo que uma.           |
| M05    | Loja sem capacidade para tudo reparte as vendas pela procura de cada produto, não pela ordem. |
| M07    | A meta de estoque de uma fábrica é a procura do mundo dividida entre as fábricas ativas.      |
