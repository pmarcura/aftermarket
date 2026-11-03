import { describe, it, expect } from 'vitest';
import { createScenario } from '../packages/simulation/src/scenarios';
import { advance, execute, RuleError } from '../packages/simulation/src/engine';
import { applyLabOpening } from '../packages/simulation/src/lab-experiments';
import {
  assertMoney,
  InvariantError,
  invariantChecksEnabled,
  totalMoney,
} from '../packages/simulation/src/invariants';
import { migrateWorld } from '../packages/simulation/src/migrate';
import {
  products,
  type Command,
  type ProductId,
  type World,
} from '../packages/simulation/src/model';
import { createClock, gameDay } from '../packages/simulation/src/clock';

// Os mundos destes testes nascem no relógio padrão (120×).
const DAY = gameDay(createClock());

const AT = Date.UTC(2026, 9, 26, 12);

// Gerador determinístico (mulberry32): a mesma semente sorteia os mesmos comandos.
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Massa física por produto: estoque + carga a caminho (fora obras) + saída reservada em lotes.
function mass(w: World) {
  const total: Partial<Record<ProductId, number>> = {};
  const add = (p: ProductId, q: number) => (total[p] = (total[p] ?? 0) + q);
  for (const e of w.establishments)
    for (const [p, q] of Object.entries(e.inventory)) add(p as ProductId, q ?? 0);
  for (const s of w.shipments) if (!s.delivered && !s.infrastructureId) add(s.product, s.quantity);
  for (const j of w.jobs)
    if (!j.completed) {
      const output =
        j.output ??
        Object.fromEntries(
          Object.entries(w.season.config.recipes.find((r) => r.id === j.recipeId)!.output).map(
            ([p, q]) => [p, q! * j.cycles],
          ),
        );
      for (const [p, q] of Object.entries(output)) add(p as ProductId, q ?? 0);
    }
  return total;
}

describe('invariantes em tempo de execução (spec 005)', () => {
  it('verificação ligada nos testes; mundo novo grava a soma dos saldos', () => {
    expect(invariantChecksEnabled()).toBe(true);
    const w = createScenario(AT, 'baseline', 0);
    expect(w.invariants.totalMoney).toBe(totalMoney(w));
    w.companies[0].balance += 1;
    expect(() => assertMoney(w, 'teste')).toThrow(InvariantError);
    expect(() => assertMoney(w, 'teste')).toThrow(/diferença 1 centavos/);
  });

  it('mundo salvo sem invariantes migra com a soma de agora', () => {
    const w = createScenario(AT, 'baseline', 0);
    const saved = JSON.parse(JSON.stringify(w)) as Partial<World>;
    delete saved.invariants;
    const { world, changed } = migrateWorld(saved, AT);
    expect(changed).toBe(true);
    expect(world.invariants.totalMoney).toBe(totalMoney(world));
  });

  it('A3: 2.000 comandos aleatórios conservam dinheiro e massa por produto', () => {
    const w = createScenario(AT, 'baseline', 0);
    const rnd = random(5);
    const pick = <T>(list: readonly T[]) => list[Math.floor(rnd() * list.length)];
    const money = totalMoney(w);
    const expected = mass(w);
    const productIds = Object.keys(w.season.config.basePrices) as ProductId[];
    const carriers = [...new Set(w.vehicles.map((v) => v.companyId))];
    const counts: Record<string, { ok: number; refused: number }> = {};
    // Quantidade às vezes inválida (zero, negativa, fracionária ou enorme).
    const quantity = () =>
      rnd() < 0.15 ? pick([0, -3, 2.5, 1e9]) : 1 + Math.floor(rnd() * (rnd() < 0.5 ? 20 : 400));
    for (let i = 0; i < 2000; i++) {
      const now = w.updatedAt;
      const e = pick(w.establishments),
        other = pick(w.establishments);
      const offer = pick(w.offers);
      const owner = (id: string) => w.establishments.find((x) => x.id === id)?.companyId ?? 'x';
      const kind = pick([
        'trade',
        'transferStock',
        'requestOrder',
        'acceptOrder',
        'rejectOrder',
        'createPurchaseRequest',
        'proposeOrder',
        'acceptProposal',
        'produce',
        'setPrice',
        'publishOffer',
        'takeRecoveryLoan',
        'payObligations',
        'setWorkforce',
      ]);
      let actor = e.companyId;
      let command: Command;
      switch (kind) {
        case 'trade':
          actor = owner(other.id);
          command = {
            type: 'trade',
            offerId: rnd() < 0.05 ? 'inexistente' : offer.id,
            quantity: quantity(),
            destinationId: other.id,
            carrierId: pick(carriers),
          };
          break;
        case 'transferStock': {
          const mine = w.establishments.filter((x) => x.companyId === e.companyId && x !== e);
          if (!mine.length) mine.push(e);
          const product = pick(Object.keys(e.inventory) as ProductId[]) ?? pick(productIds);
          command = {
            type: 'transferStock',
            originId: e.id,
            destinationId: pick(mine).id,
            product,
            quantity: quantity(),
            carrierId: rnd() < 0.5 ? e.companyId : pick(carriers),
          };
          break;
        }
        case 'requestOrder':
          actor = owner(other.id);
          command = {
            type: 'requestOrder',
            reserveFunds: rnd() < 0.5,
            offerId: offer.id,
            destinationId: other.id,
            quantity: quantity(),
            carrierId: pick(carriers),
            maxFreight: Math.floor(rnd() * 5000000),
            deliveryDays: 1 + Math.floor(rnd() * 5),
          };
          break;
        case 'acceptOrder':
        case 'rejectOrder': {
          const order = w.orders.length ? pick(w.orders) : undefined;
          actor = rnd() < 0.8 ? (order?.sellerId ?? actor) : actor;
          command = { type: kind, orderId: order?.id ?? 'nenhum' };
          break;
        }
        case 'createPurchaseRequest':
          command = {
            type: 'createPurchaseRequest',
            reserveFunds: rnd() < 0.5,
            destinationId: e.id,
            product: pick(productIds),
            quantity: quantity(),
            unitPrice: Math.floor(rnd() * 200000),
            maxFreight: Math.floor(rnd() * 5000000),
            deliveryDays: 1 + Math.floor(rnd() * 5),
          };
          break;
        case 'proposeOrder': {
          const order = w.orders.length ? pick(w.orders) : undefined;
          command = {
            type: 'proposeOrder',
            orderId: order?.id ?? 'nenhum',
            establishmentId: e.id,
            unitPrice: Math.floor(rnd() * 200000),
            quantity: order && rnd() < 0.7 ? order.quantity : quantity(),
            maxFreight: Math.floor(rnd() * 5000000),
            deliveryDays: 1 + Math.floor(rnd() * 5),
            carrierId: rnd() < 0.5 ? e.companyId : pick(carriers),
          };
          break;
        }
        case 'acceptProposal': {
          const open = w.orders.filter((o) => o.status === 'pending' && o.proposals?.length);
          const order = open.length ? pick(open) : pick(w.orders);
          actor = order?.buyerId ?? actor;
          command = {
            type: 'acceptProposal',
            orderId: order?.id ?? 'nenhum',
            proposalId: order?.proposals?.at(-1)?.id ?? 'nenhuma',
          };
          break;
        }
        case 'produce':
          command = {
            type: 'produce',
            establishmentId: e.id,
            recipeId: rnd() < 0.9 ? (e.specialization ?? 'rice') : pick(w.season.config.recipes).id,
            cycles: rnd() < 0.1 ? 0 : 1 + Math.floor(rnd() * 3),
          };
          break;
        case 'setPrice':
        case 'publishOffer':
          command = {
            type: kind,
            establishmentId: e.id,
            product: pick(productIds),
            price: rnd() < 0.1 ? -1 : Math.floor(rnd() * 300000),
          };
          break;
        case 'takeRecoveryLoan':
          command = {
            type: 'takeRecoveryLoan',
            state: pick(w.properties).state,
            amount: Math.floor(rnd() * 50000000),
          };
          break;
        case 'payObligations':
          command = { type: 'payObligations', amount: Math.floor(rnd() * 1000000) };
          break;
        default:
          command = {
            type: 'setWorkforce',
            establishmentId: e.id,
            employees: Math.floor(rnd() * 60),
          };
      }
      // Validação estrita: o lote reservado só pode ser checado depois, se o comando passar.
      const recipe =
        command.type === 'produce'
          ? w.season.config.recipes.find((r) => r.id === command.recipeId)
          : undefined;
      const tally = (counts[command.type] ??= { ok: 0, refused: 0 });
      try {
        execute(w, actor, command, now);
        tally.ok++;
        if (command.type === 'produce' && recipe)
          for (const [p, q] of Object.entries(recipe.input))
            expected[p as ProductId] = (expected[p as ProductId] ?? 0) - q! * command.cycles;
        if (command.type === 'produce' && recipe) {
          // A saída reservada no lote entra na massa (o lote acabou de ser criado).
          const job = w.jobs.at(-1)!;
          const output =
            job.output ??
            Object.fromEntries(
              Object.entries(recipe.output).map(([p, q]) => [p, q! * command.cycles]),
            );
          for (const [p, q] of Object.entries(output))
            expected[p as ProductId] = (expected[p as ProductId] ?? 0) + (q ?? 0);
        }
      } catch (error) {
        if (!(error instanceof RuleError)) throw error;
        tally.refused++;
      }
      expect(totalMoney(w)).toBe(money);
      const now2 = mass(w);
      for (const p of new Set([...Object.keys(expected), ...Object.keys(now2)]) as Set<ProductId>)
        expect(now2[p] ?? 0, `${command.type} · ${products[p]?.name ?? p}`).toBeCloseTo(
          expected[p] ?? 0,
          6,
        );
    }
    const ok = Object.values(counts).reduce((n, c) => n + c.ok, 0);
    const refused = Object.values(counts).reduce((n, c) => n + c.refused, 0);
    expect(ok + refused).toBe(2000);
    // Os dois caminhos foram exercitados de verdade, inclusive cargas despachadas.
    expect(ok).toBeGreaterThan(100);
    expect(refused).toBeGreaterThan(100);
    expect(w.shipments.filter((s) => !s.delivered).length).toBeGreaterThan(10);
    // Depois de entregar tudo, a soma continua igual.
    advance(w, w.updatedAt + 3 * DAY);
    expect(totalMoney(w)).toBe(money);
  }, 120000);

  it('A4: TypeError num bot não derruba a rodada; os outros bots agem e o erro fica registrado', () => {
    const w = createScenario(AT, 'playtest', 0, { scale: 1 });
    applyLabOpening(w, {
      seed: 0,
      seedMode: 'conditions',
      demandMultiplier: 1,
      costMultiplier: 1,
      capacityMultiplier: 1,
      freightMultiplier: 1,
      botPolicy: 'mixed',
    });
    const broken = w.companies.find((c) => c.bot && c.id.startsWith('rival-'))!;
    // Defeito injetado: a decisão de frota do bot lê um campo que lança TypeError.
    Object.defineProperty(broken, 'lastFleetAt', {
      configurable: true,
      get() {
        throw new TypeError('defeito injetado no teste');
      },
    });
    expect(() => advance(w, AT + DAY)).not.toThrow();
    const errors = (w.botActivity ?? []).filter((a) => a.kind === 'error');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every((a) => a.companyId === broken.id)).toBe(true);
    expect(errors[0].text).toMatch(/TypeError: defeito injetado/);
    const others = (w.botActivity ?? []).filter(
      (a) => a.kind !== 'error' && a.companyId !== broken.id,
    );
    expect(others.length).toBeGreaterThan(0);
    expect(totalMoney(w)).toBe(w.invariants.totalMoney);
  }, 60000);
});
