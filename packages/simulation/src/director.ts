import { execute, quote, RuleError } from './engine';
import { products, type Command, type ProductId, type World, type Establishment } from './model';
import { institutional, publicReference, trainingQuote } from './competition';
import { GAME_DAY, inventoryQuality, productionCapacity, productionQuality } from './operations';
import { operatingCosts, productionCharges, marketView } from './metrics';
import { arrears, freeCash, recoveryQuote, outstandingLoans } from './design';
import { emitDecisionTrace, hasDecisionTrace, withDecisionSource } from './decision-trace';

export const botCapabilities = [
  'production',
  'supply',
  'purchase-requests',
  'counteroffers',
  'infrastructure-bids',
  'internal-transfer',
  'education',
  'expansion',
  'recovery',
  'reserved-orders',
  'installation',
] as const;
export function botRecoveryPlan(w: World, e: Establishment, at: number) {
  const r = w.season.config.recipes.find((r) => r.id === e.specialization),
    profile = r ? w.season.config.operations.profiles[r.id] : undefined;
  if (!r || !profile || e.installed === false || (e.category === 'mine' && (e.reserve ?? 0) <= 0))
    return;
  const workers = profile.workers * (e.equipmentLines ?? 1),
    preview = { ...e, employees: workers, mothballed: false, enabled: true },
    fixed = operatingCosts(w, preview).total;
  let input = 0;
  for (const [id, quantity] of Object.entries(r.input) as [ProductId, number][]) {
    const prices = w.offers
      .filter(
        (o) =>
          o.product === id &&
          (w.establishments.find((x) => x.id === o.establishmentId)?.inventory[id] ?? 0) >=
            quantity,
      )
      .map((o) => o.price);
    const price =
      (e.inventory[id] ?? 0) >= quantity
        ? e.unitCosts[id]
        : prices.length
          ? Math.min(...prices)
          : undefined;
    if (price === undefined) return;
    input += price * quantity;
  }
  const outputProduct = Object.keys(r.output)[0] as ProductId,
    quantity = r.output[outputProduct]!,
    qualified = w.infrastructure.filter(
      (c) => c.product === outputProduct && c.createdAt >= at - GAME_DAY * 14,
    );
  const publicPrice = qualified.length ? Math.min(...qualified.map((c) => c.unitPrice)) * 0.94 : 0;
  const demand =
    marketView(w, outputProduct).demand + qualified.reduce((n, c) => n + c.quantity, 0) / 14;
  const competitors = Math.max(
    1,
    w.establishments.filter(
      (x) => x.specialization === r.id && w.companies.find((c) => c.id === x.companyId)?.bot,
    ).length,
  );
  const dailyQuantity = Math.min(
    quantity * 12 * (e.automationCycles ?? 1),
    (demand * 0.2) / competitors,
  );
  const marketPrice =
    marketView(w, outputProduct).price ?? w.season.config.basePrices[outputProduct];
  const price = publicPrice || marketPrice;
  const perCycle = productionCharges(w, preview, r.id, 1).total + input;
  const contribution = (price - perCycle / quantity) * dailyQuantity - fixed;
  if (contribution <= fixed * 0.15 || dailyQuantity <= 0) return;
  return {
    workers,
    fixed,
    upfront: Math.ceil(perCycle * 4 + fixed * 7 + arrears(w, e.companyId)),
    contribution,
  };
}
export function runBotDirector(w: World, at: number) {
  const tracing = hasDecisionTrace(w);
  const attempted = tracing ? new Set<string>() : undefined;
  const pricing = tracing ? new Set<string>() : undefined;
  const trace = (
    companyId: string,
    code: string,
    message: string,
    action: string,
    establishmentId?: string,
    targetId?: string,
    productId?: ProductId,
    outcome: 'blocked' | 'idle' = 'blocked',
  ) => {
    if (tracing)
      emitDecisionTrace(w, {
        at,
        companyId,
        source: 'director',
        outcome,
        action,
        code,
        message,
        establishmentId,
        targetId,
        productId,
      });
  };
  const act = (actor: string, cmd: Command, text: string) => {
    attempted?.add(actor);
    try {
      withDecisionSource(w, 'director', () => execute(w, actor, cmd, at));
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
            e.companyId !== o.buyerId &&
            bots.some((b) => b.id === e.companyId) &&
            (e.inventory[o.product] ?? 0) >= o.quantity,
        )
        .sort((a, b) => (a.unitCosts[o.product] ?? 0) - (b.unitCosts[o.product] ?? 0));
      if (tracing && !candidates.length)
        trace(
          o.buyerId,
          'no-order-seller',
          'Nenhum bot vendedor possui a quantidade pedida nesta rodada.',
          'proposeOrder',
          o.destinationId,
          o.id,
          o.product,
        );
      for (const e of candidates.slice(0, 4)) {
        if (o.proposals?.some((p) => p.sellerId === e.companyId)) continue;
        const q = [e.companyId, 'transbrasil', 'rodoleste', 'expresso']
          .map((c) => quote(w, e.id, o.destinationId, o.product, o.quantity, c))
          .filter((q) => q.compatible && q.price <= o.maxFreight)
          .sort((a, b) => a.price - b.price)[0];
        if (!q) {
          trace(
            e.companyId,
            'order-delivery-ineligible',
            'Nenhum dos fretes avaliados foi compatível e ficou dentro do teto deste pedido.',
            'proposeOrder',
            e.id,
            o.id,
            o.product,
          );
          continue;
        }
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
      else
        trace(
          buyer.id,
          o.proposals?.length ? 'proposal-terms-ineligible' : 'awaiting-counterparty',
          o.proposals?.length
            ? 'Nenhuma proposta de terceiro atende à quantidade, preço e frete exigidos pelo comprador.'
            : 'O comprador aguarda uma proposta da contraparte.',
          'acceptProposal',
          o.destinationId,
          o.id,
          o.product,
          'idle',
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
    c.behaviorVersion = 2;
    for (const e of w.establishments.filter((e) => e.companyId === c.id && e.installed === false)) {
      if (
        act(
          c.id,
          { type: 'installBusiness', establishmentId: e.id, recipeId: e.specialization, lines: 1 },
          'Instalou equipamentos na unidade adquirida',
        )
      ) {
        const recipe = w.season.config.recipes.find((r) => r.id === e.specialization),
          workers = recipe ? w.season.config.operations.profiles[recipe.id].workers : 6;
        if (
          act(
            c.id,
            { type: 'setWorkforce', establishmentId: e.id, employees: workers },
            'Contratou a equipe da nova unidade',
          )
        )
          act(
            c.id,
            { type: 'toggleOperation', establishmentId: e.id },
            'Iniciou operação da unidade equipada',
          );
        e.automation = e.category !== 'retail';
        if (e.supplyPolicy) e.supplyPolicy.enabled = true;
      }
    }
    const debt = arrears(w, c.id),
      allUnits = w.establishments.filter((e) => e.companyId === c.id);
    if (tracing && debt > 0 && freeCash(w, c.id) < debt)
      trace(
        c.id,
        'debt-cash-shortfall',
        'O caixa livre é menor que as obrigações que o diretor tenta regularizar integralmente.',
        'payObligations',
      );
    if (debt > 0 && freeCash(w, c.id) >= debt)
      act(
        c.id,
        { type: 'payObligations', amount: debt },
        'Regularizou salários e serviços em atraso',
      );
    if (debt > 0 && at - w.season.startedAt >= GAME_DAY * 3) {
      const fixed = allUnits.reduce((n, e) => n + operatingCosts(w, e).total, 0),
        place = w.properties.find((p) => p.id === allUnits[0]?.propertyId);
      const operatingProfit = allUnits.reduce((n, e) => n + e.revenue - e.expenses, 0);
      if (
        place &&
        operatingProfit > fixed * 3 &&
        outstandingLoans(w, c.id) === 0 &&
        !w.loans!.some((l) => l.companyId === c.id)
      ) {
        const wanted = debt + fixed * 7,
          q = recoveryQuote(w, c.id, place.state, wanted);
        if (
          wanted >= 100000 &&
          wanted <= q.maximum &&
          act(
            c.id,
            { type: 'takeRecoveryLoan', state: place.state, amount: wanted },
            'Contratou crédito limitado por garantia e verba',
          )
        )
          act(
            c.id,
            { type: 'payObligations', amount: Math.min(arrears(w, c.id), freeCash(w, c.id)) },
            'Pagou atrasados com plano de recuperação',
          );
      }
      if (operatingProfit <= 0 && debt > fixed * 2)
        for (const e of allUnits.filter((e) => !e.enabled && !e.mothballed))
          act(
            c.id,
            { type: 'mothball', establishmentId: e.id, enabled: true },
            'Suspendeu estrutura deficitária para reduzir compromissos',
          );
      else if (arrears(w, c.id) === 0)
        for (const e of allUnits.filter((e) => !e.enabled && !e.mothballed && e.employees > 0))
          act(
            c.id,
            { type: 'toggleOperation', establishmentId: e.id },
            'Retomou operação após regularização',
          );
    }
    if (at - (c.lastRecoveryAt ?? w.season.startedAt) >= GAME_DAY * 7) {
      for (const e of allUnits.filter((e) => e.mothballed)) {
        const plan = botRecoveryPlan(w, e, at);
        if (!plan) {
          trace(
            c.id,
            'recovery-plan-unavailable',
            'O cálculo de recuperação não aprovou um plano nesta rodada; este evento não atribui uma causa econômica adicional.',
            'recover',
            e.id,
          );
          continue;
        }
        let needed = Math.max(0, plan.upfront - freeCash(w, c.id));
        if (needed > 0 && !w.loans!.some((l) => l.companyId === c.id && l.principal > l.repaid)) {
          needed = Math.max(100000, Math.ceil(needed / (1 - w.season.config.design.loanFee)));
          const state = w.properties.find((p) => p.id === e.propertyId)!.state,
            q = recoveryQuote(w, c.id, state, needed);
          if (needed <= q.maximum)
            act(
              c.id,
              { type: 'takeRecoveryLoan', state, amount: needed },
              'Financiou retomada com margem projetada e garantia',
            );
        }
        if (freeCash(w, c.id) < plan.upfront) {
          trace(
            c.id,
            'recovery-upfront-cash',
            'O caixa livre não cobre o desembolso inicial calculado para a recuperação.',
            'recover',
            e.id,
          );
          continue;
        }
        if (arrears(w, c.id) > 0)
          act(
            c.id,
            { type: 'payObligations', amount: arrears(w, c.id) },
            'Regularizou obrigações antes da retomada',
          );
        if (
          act(
            c.id,
            { type: 'mothball', establishmentId: e.id, enabled: false },
            'Reativou estrutura com plano de caixa',
          )
        ) {
          act(
            c.id,
            { type: 'setWorkforce', establishmentId: e.id, employees: plan.workers },
            'Recontratou equipe para demanda observada',
          );
          act(
            c.id,
            { type: 'toggleOperation', establishmentId: e.id },
            'Retomou produção com orçamento finito',
          );
          e.automation = true;
          if (e.supplyPolicy) e.supplyPolicy.enabled = true;
          c.lastRecoveryAt = at;
        }
      }
    }
    const units = w.establishments.filter(
      (e) =>
        e.companyId === c.id && (e.enabled || Object.values(e.inventory).some((q) => (q ?? 0) > 0)),
    );
    for (const e of units) {
      // Os registros de receitas conduzem o plano; treinamento e estoque não recebem bônus ocultos.
      if (e.enabled && e.supplyPolicy?.enabled && at - w.season.startedAt >= GAME_DAY / 4) {
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
          const unitPrice = rule.maxPrice || Math.round(publicReference(w, rule.product) * 1.2),
            maxFreight = Math.max(
              200000,
              Math.round(qty * publicReference(w, rule.product) * 0.25),
            );
          const affordable = Math.min(
            qty,
            Math.floor(
              (freeCash(w, c.id) -
                Math.max(e.supplyPolicy.cashReserve, operatingCosts(w, e).total * 3) -
                maxFreight) /
                unitPrice,
            ),
          );
          if (affordable > 0)
            act(
              c.id,
              {
                type: 'createPurchaseRequest',
                reserveFunds: c.strategy === 'regional',
                destinationId: e.id,
                product: rule.product,
                quantity: affordable,
                unitPrice,
                maxFreight,
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
        const relevant = w.infrastructure.filter(
          (x) => x.product === contract.product && x.createdAt >= at - GAME_DAY * 14,
        );
        const producers = Math.max(
          1,
          w.establishments.filter(
            (x) =>
              x.specialization === e.specialization &&
              w.companies.find((z) => z.id === x.companyId)?.bot,
          ).length,
        );
        const expectedDaily = Math.max(
          contract.quantity / 7,
          ((relevant.reduce((n, x) => n + x.quantity, 0) / 14) * 0.2) / producers,
        );
        const floor = Math.ceil(
          ((e.unitCosts[contract.product] ?? 0) + operatingCosts(w, e).total / expectedDaily) *
            1.08,
        );
        const lost = w.infrastructure
          .slice(-30)
          .flatMap((x) => x.bids ?? [])
          .filter((b) => b.supplierId === c.id && b.status === 'lost').length;
        const discount =
          (c.strategy === 'value' ? 0.94 : c.strategy === 'quality' ? 0.99 : 0.97) -
          Math.min(0.12, lost * 0.02);
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
        (c.strategy === 'quality' ||
          w.infrastructure.some(
            (c) =>
              c.status === 'open' &&
              Object.keys(
                w.season.config.recipes.find((r) => r.id === e.specialization)?.output ?? {},
              ).includes(c.product) &&
              c.minQuality >
                productionQuality(
                  w,
                  e,
                  w.season.config.recipes.find((r) => r.id === e.specialization)!,
                ),
          )) &&
        e.enabled &&
        ['industry', 'farm', 'mine'].includes(e.category) &&
        (e.education ?? 0) < 5 &&
        e.employees > 0 &&
        c.balance > training.cost + fixed * 15 &&
        !w.training!.some((t) => t.establishmentId === e.id && !t.completed)
      )
        act(
          c.id,
          { type: 'trainWorkforce', establishmentId: e.id },
          'Investiu em educação da equipe',
        );
      if (e.category !== 'retail' || !e.enabled) continue;
      for (const id of Object.keys(e.inventory) as ProductId[]) {
        const demand = Math.max(
          1,
          w.consumptionHistory
            .filter((h) => h.establishmentId === e.id && h.product === id && h.at > at - GAME_DAY)
            .reduce((n, h) => n + h.desired, 0) || 100,
        );
        const previousPrice = tracing ? e.prices[id] : undefined;
        e.prices[id] = Math.max(
          1,
          Math.round(
            ((e.unitCosts[id] ?? w.season.config.basePrices[id]) +
              fixed / Math.max(100, demand * 5)) *
              (c.strategy === 'quality' ? 1.25 : 1.14),
          ),
        );
        if (tracing && previousPrice !== e.prices[id]) {
          pricing!.add(c.id);
          emitDecisionTrace(w, {
            at,
            companyId: c.id,
            source: 'director',
            outcome: 'executed',
            action: 'retail-pricing',
            code: 'retail-price-updated',
            message: `Preço de ${products[id].name} ajustado para ${e.prices[id]} centavos pela regra de varejo.`,
            establishmentId: e.id,
            productId: id,
          });
        }
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
      const previousPrice = tracing ? o.price : undefined;
      o.price = Math.max(
        o.price,
        Math.round(
          ((e.unitCosts[o.product] ?? w.season.config.basePrices[o.product]) + overhead) * margin,
        ),
      );
      if (tracing && previousPrice !== o.price) {
        pricing!.add(e.companyId);
        emitDecisionTrace(w, {
          at,
          companyId: e.companyId,
          source: 'director',
          outcome: 'executed',
          action: 'wholesale-pricing',
          code: 'wholesale-floor-updated',
          message: `Preço de ${products[o.product].name} ajustado para ${o.price} centavos pelo piso operacional de atacado.`,
          establishmentId: e.id,
          productId: o.product,
        });
      }
    }
  }
  w.botActivity = w.botActivity!.slice(-1000);
  if (tracing)
    for (const bot of bots)
      if (!attempted!.has(bot.id) && !pricing!.has(bot.id))
        trace(
          bot.id,
          'no-command-selected',
          'O diretor terminou a rodada sem selecionar comando ou alterar preço de varejo para este bot; a causa não foi inferida.',
          'plan',
          undefined,
          undefined,
          undefined,
          'idle',
        );
}
