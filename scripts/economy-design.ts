import { analyzeDesign } from '../packages/simulation/src/economy-design';

// Mostra os números da proposta de economia (etapa B). `--json` imprime o resultado completo.
const result = analyzeDesign();
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(result, null, 2));
} else {
  const reais = (cents: number) =>
    `R$ ${(cents / 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
  console.table(
    result.recipes.map((r) => ({
      receita: r.name,
      linhas: Number(r.lines.toFixed(1)),
      'lucro/dia': reais(r.profit),
      margem: `${(r.margin * 100).toFixed(0)}%`,
      'equipamento/linha': reais(r.equipment),
    })),
  );
  for (const c of result.checks) console.log(c.ok ? 'ok   ' : 'FALHA', c.detail);
  const failed = result.checks.filter((c) => !c.ok).length;
  console.log(failed ? `${failed} verificações falharam.` : 'Todas as verificações passaram.');
  process.exitCode = failed ? 1 : 0;
}
