import { regionsOf } from '../../../packages/simulation/src/metrics';
import type { ProductId, World, MarketSample, Entry } from '../../../packages/simulation/src/model';

export function marketHistories(world: World, ids: ProductId[], regionId = '') {
  const selected = [...new Set(ids)];
  const result = Object.fromEntries(
    selected.map((product) => [
      product,
      {
        product,
        regionId,
        startedAt: world.economyStartedAt,
        seasonId: world.season.id,
        samples: [] as MarketSample[],
        trades: [] as Entry[],
      },
    ]),
  );
  let samplesLeft = selected.length;
  for (let i = world.marketHistory.length - 1; i >= 0 && samplesLeft; i--) {
    const sample = world.marketHistory[i],
      target = result[sample.product];
    if (!target || target.samples.length >= 1000 || sample.regionId !== regionId) continue;
    target.samples.push(sample);
    if (target.samples.length === 1000) samplesLeft--;
  }
  const states = regionId.startsWith('state:')
    ? new Map(regionsOf(world).map((r) => [r.id, r.state]))
    : null;
  let tradesLeft = selected.length;
  for (let i = world.ledger.length - 1; i >= 0 && tradesLeft; i--) {
    const trade = world.ledger[i],
      target = trade.product ? result[trade.product] : undefined;
    if (!target || target.trades.length >= 2000 || trade.channel !== 'wholesale') continue;
    if (
      regionId &&
      (states
        ? states.get(trade.regionId ?? '') !== regionId.slice(6)
        : trade.regionId !== regionId)
    )
      continue;
    target.trades.push(trade);
    if (target.trades.length === 2000) tradesLeft--;
  }
  for (const target of Object.values(result)) {
    target.samples.reverse();
    target.trades.reverse();
  }
  return result;
}
