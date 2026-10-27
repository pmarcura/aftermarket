import { describe, expect, it } from 'vitest';
import { runLab } from '../packages/simulation/src/lab';
import { queryLabReport } from '../packages/simulation/src/lab-query';

describe('consulta rápida do laboratório', () => {
  const report = runLab({ days: 2 });
  it('localiza bot, produto e dia com evidência limitada e sem mutação', () => {
    const before = JSON.stringify(report);
    const bot = report.observations[0].bots[0];
    const query = queryLabReport(report, {
      bot: bot.id,
      item: 'óleo',
      day: 1,
      limit: 2,
      series: true,
    });
    expect('bot' in query.snapshot ? query.snapshot.bot.id : undefined).toBe(bot.id);
    expect(query.snapshot.item?.id).toBe('oil');
    expect(query.snapshot.day).toBe(1);
    expect(query.events.returnedGroups).toBeLessThanOrEqual(2);
    expect(
      query.events.groups.every(
        (event) => event.day === 1 && event.productId === 'oil' && event.companyId === bot.id,
      ),
    ).toBe(true);
    expect(query.series).toHaveLength(3);
    expect(JSON.stringify(report)).toBe(before);
  });
  it('rejeita referências ambíguas e filtros inválidos em vez de escolher silenciosamente', () => {
    for (const query of [
      { day: -1 },
      { day: 3 },
      { limit: 0 },
      { limit: 501 },
      { bot: 'não existe' },
      { item: 'não existe' },
      { bot: 'rival-' },
    ])
      expect(() => queryLabReport(report, query)).toThrow();
    const query = queryLabReport(report, { day: 0 });
    expect(query.events.matchingGroups).toBe(0);
    expect(query.snapshot.moneyConserved).toBe(true);
  });
});
