import { execute, quote, RuleError } from './engine';
import { products, type Command, type ProductId, type World } from './model';
import { institutional, publicReference, trainingQuote } from './competition';
import { GAME_DAY, inventoryQuality, productionCapacity } from './operations';
import { operatingCosts } from './metrics';

export const botCapabilities = [
  'production',
  'supply',
  'purchase-requests',
  'counteroffers',
  'infrastructure-bids',
  'internal-transfer',
  'education',
  'expansion',
] as const;
export function runBotDirector(w: World, at: number) {
  const act = (actor: string, cmd: Command, text: string) => {
    try {
      execute(w, actor, cmd, at);
      w.botActivity!.push({ at, companyId: actor, text, kind: cmd.type });
      return true;
    } catch (error) {
      if (!(error instanceof RuleError)) throw error;
      return false;
    }
  };
  const bots = w.companies.filter((c) => c.bot && !institutional(c.id));
  for (const o of w.orders.filter((o) => o.status === 'pending' && o.deadline > at)) {
    if (!o.sellerId) {
      const candidates = w.establishments
        .filter(
          (e) =>
            e.enabled &&
            e.companyId !== o.buyerId &&
            bots.some((b) => b.id === e.companyId) &&
            (e.inventory[o.product] ?? 0) >= o.quantity,
        )
        .sort((a, b) => (a.unitCosts[o.product] ?? 0) - (b.unitCosts[o.product] ?? 0));
      for (const e of candidates.slice(0, 4)) {
        if (o.proposals?.some((p) => p.sellerId === e.companyId)) continue;
        const q = [e.companyId, 'transbrasil', 'rodoleste', 'expresso']
          .map((c) => quote(w, e.id, o.destinationId, o.product, o.quantity, c))
          .filter((q) => q.compatible && q.price <= o.maxFreight)
          .sort((a, b) => a.price - b.price)[0];
        if (!q) continue;
        const price = Math.max(
          1,
          w.offers.find((x) => x.establishmentId === e.id && x.product === o.product)?.price ??
            Math.round((e.unitCosts[o.product] ?? publicReference(w, o.product)) * 1.15),
        );
        act(
          e.companyId,
          {
            type: 'proposeOrder',
            orderId: o.id,
            establishmentId: e.id,
            quantity: o.quantity,
            unitPrice: price,
            maxFreight: o.maxFreight,
            deliveryDays: 3,
            carrierId: q.carrierId,
          },
          `Propôs ${products[o.product].name} ao pedido #${o.id.slice(0, 6)}`,
        );
      }
    }
    const buyer = bots.find((b) => b.id === o.buyerId);
    if (buyer && at - o.createdAt >= 60000) {
      const best = o.proposals
        ?.filter(
          (p) =>
            p.proposedBy !== buyer.id &&
            p.quantity === o.quantity &&
            p.unitPrice <= o.unitPrice &&
            p.maxFreight <= o.maxFreight,
        )
        .sort(
          (a, b) =>
            a.unitPrice * a.quantity + a.maxFreight - b.unitPrice * b.quantity - b.maxFreight,
        )[0];
      if (best)
        act(
          buyer.id,
          { type: 'acceptProposal', orderId: o.id, proposalId: best.id },
          `Aceitou proposta de ${products[o.product].name}`,
        );
    }
    const negotiatedSeller = o.sellerId || o.proposals?.at(-1)?.sellerId;
    if (negotiatedSeller && bots.some((b) => b.id === negotiatedSeller) && o.status === 'pending') {
      const latest = o.proposals?.at(-1);
      if (latest && latest.proposedBy === o.buyerId) {
        const e = w.establishments.find((e) => e.id === latest.originId)!;
        const minimum = Math.max(1, Math.round((e.unitCosts[o.product] ?? 0) * 1.08));
        if (latest.unitPrice >= minimum)
          act(
            negotiatedSeller,
            { type: 'acceptProposal', orderId: o.id, proposalId: latest.id },
            'Aceitou contraproposta do comprador',
          );
        else
          act(
            negotiatedSeller,
            {
              type: 'proposeOrder',
              orderId: o.id,
              establishmentId: e.id,
              quantity: latest.quantity,
              unitPrice: minimum,
              maxFreight: latest.maxFreight,
              deliveryDays: Math.max(1, Math.min(14, Math.ceil((latest.deadline - at) / GAME_DAY))),
              carrierId: latest.carrierId,
            },
            'Contrapropôs para preservar custo e margem',
          );
      } else if (!latest) {
        const e = w.establishments.find((e) => e.id === o.originId)!;
        const minimum = Math.round((e.unitCosts[o.product] ?? 0) * 1.08);
        if (o.unitPrice >= minimum)
          act(
            o.sellerId,
            { type: 'acceptOrder', orderId: o.id },
            `Atendeu pedido de ${products[o.product].name}`,
          );
        else
          act(
            o.sellerId,
            {
              type: 'proposeOrder',
              orderId: o.id,
              quantity: o.quantity,
              unitPrice: minimum,
              deliveryDays: 3,
              maxFreight: o.maxFreight,
              carrierId: o.carrierId,
            },
            'Enviou contraproposta para preservar margem',
          );
      }
    }
  }
  for (const c of bots) {
    c.behaviorVersion = 1;
    const units = w.establishments.filter((e) => e.companyId === c.id && e.enabled);
    for (const e of units) {
      // Os registros de receitas conduzem o plano; treinamento e estoque não recebem bônus ocultos.
      if (e.supplyPolicy?.enabled && at - w.season.startedAt >= GAME_DAY / 4) {
        const rule = e.supplyPolicy.rules.find(
          (r) =>
            (e.inventory[r.product] ?? 0) <= r.minimum &&
            !w.orders.some(
              (o) => o.destinationId === e.id && o.product === r.product && o.status === 'pending',
            ) &&
            !w.shipments.some(
              (s) => s.destinationId === e.id && s.product === r.product && !s.delivered,
            ),
        );
        if (
          rule &&
          !(w.botActivity ?? []).some(
            (a) =>
              a.companyId === c.id &&
              a.kind === 'createPurchaseRequest' &&
              a.at > at - GAME_DAY / 2,
          )
        ) {
          const qty = Math.min(rule.maxBuy, rule.target - (e.inventory[rule.product] ?? 0));
          if (qty > 0)
            act(
              c.id,
              {
                type: 'createPurchaseRequest',
                destinationId: e.id,
                product: rule.product,
                quantity: qty,
                unitPrice: rule.maxPrice || Math.round(publicReference(w, rule.product) * 1.2),
                maxFreight: Math.max(
                  200000,
                  Math.round(qty * publicReference(w, rule.product) * 0.25),
                ),
                deliveryDays: 3,
              },
              `Publicou necessidade de ${products[rule.product].name}`,
            );
        }
      }
      for (const contract of w.infrastructure.filter(
        (c) => c.status === 'open' && c.biddingEndsAt && at < c.biddingEndsAt,
      )) {
        if (
          contract.bids?.some((b) => b.supplierId === c.id) ||
          (e.inventory[contract.product] ?? 0) < contract.quantity ||
          inventoryQuality(e, contract.product) < contract.minQuality
        )
          continue;
        const q = [c.id, 'transbrasil', 'rodoleste', 'expresso']
          .map((id) =>
            quote(w, e.id, contract.destinationId, contract.product, contract.quantity, id),
          )
          .filter((q) => q.compatible && q.price <= contract.maxFreight)
          .sort((a, b) => a.price - b.price)[0];
        if (!q) continue;
        const floor = Math.ceil((e.unitCosts[contract.product] ?? 0) * 1.08),
          discount = c.strategy === 'value' ? 0.94 : c.strategy === 'quality' ? 0.99 : 0.97;
        const price = Math.max(floor, Math.round(contract.unitPrice * discount));
        if (price <= contract.unitPrice)
          act(
            c.id,
            {
              type: 'bidInfrastructure',
              contractId: contract.id,
              establishmentId: e.id,
              carrierId: q.carrierId,
              unitPrice: price,
            },
            `Disputou ${contract.title} em ${contract.municipality}`,
          );
      }
      const training = trainingQuote(w, e),
        fixed = operatingCosts(w, e).total;
      if (
        c.strategy === 'quality' &&
        ['industry', 'farm', 'mine'].includes(e.category) &&
        (e.education ?? 0) < 3 &&
        e.employees > 0 &&
        c.balance > training.cost + fixed * 15 &&
        !w.training!.some((t) => t.establishmentId === e.id && !t.completed)
      )
        act(
          c.id,
          { type: 'trainWorkforce', establishmentId: e.id },
          'Investiu em educação da equipe',
        );
      if (e.category !== 'retail') continue;
      for (const id of Object.keys(e.inventory) as ProductId[]) {
        const demand = Math.max(
          1,
          w.consumptionHistory
            .filter((h) => h.establishmentId === e.id && h.product === id && h.at > at - GAME_DAY)
            .reduce((n, h) => n + h.desired, 0) || 100,
        );
        e.prices[id] = Math.max(
          1,
          Math.round(
            ((e.unitCosts[id] ?? w.season.config.basePrices[id]) +
              fixed / Math.max(100, demand * 5)) *
              (c.strategy === 'quality' ? 1.25 : 1.14),
          ),
        );
      }
    }
  }
  // Preços de oferta cobrem também a parcela operacional da capacidade instalada.
  for (const e of w.establishments.filter(
    (e) => bots.some((b) => b.id === e.companyId) && e.enabled && e.category !== 'retail',
  )) {
    const r = w.season.config.recipes.find((r) => r.id === e.specialization),
      lines = r ? productionCapacity(w, e, r).lines : 0;
    const dailyOutputValue = r
      ? Object.entries(r.output).reduce(
          (n, [id, q]) => n + q! * w.season.config.basePrices[id as ProductId],
          0,
        ) * Math.min(12 * (e.automationCycles ?? 1), (lines * GAME_DAY) / r.duration)
      : 0;
    for (const o of w.offers.filter((o) => o.establishmentId === e.id)) {
      const overhead = dailyOutputValue
        ? (operatingCosts(w, e).total * w.season.config.basePrices[o.product]) / dailyOutputValue
        : operatingCosts(w, e).total / Math.max(1, (e.inventory[o.product] ?? 0) / 3);
      const margin =
        w.companies.find((c) => c.id === e.companyId)!.strategy === 'value' ? 1.1 : 1.18;
      o.price = Math.max(
        o.price,
        Math.round(
          ((e.unitCosts[o.product] ?? w.season.config.basePrices[o.product]) + overhead) * margin,
        ),
      );
    }
  }
  w.botActivity = w.botActivity!.slice(-1000);
}
