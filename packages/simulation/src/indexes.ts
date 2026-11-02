import type { Job, PurchaseOrder, Shipment, World } from './model';

// Índices derivados do mundo (spec 005, R1). Não fazem parte do estado salvo: vivem num WeakMap
// por mundo e são atualizados na leitura, de forma incremental. As listas indexadas só recebem
// itens no fim (`push`); entregas, conclusões e mudanças de situação alteram campos no lugar, e
// as chaves (destino, estabelecimento) nunca mudam depois da criação. Por isso cada índice guarda
// até que posição da lista já indexou e, a cada consulta, indexa só o que entrou depois: uma
// compra feita por uma regra aparece para a regra seguinte da mesma rodada. Se a lista trocar de
// identidade (arquivamento, cenário que remove empresas) ou encolher, o índice é refeito do zero.
//
// Ordem: cada balde guarda os itens na ordem da lista. Quem trocou um `filter`/`find`/`some` por
// um índice recebe exatamente os mesmos itens, na mesma ordem (somas em ponto flutuante e
// "primeiro elemento" continuam idênticos).
//
// Itens fechados (remessa entregue, lote concluído, pedido que saiu de "pendente") nunca voltam a
// abrir; os índices de abertos os descartam do balde quando eles passam a ser maioria.

type Bucket<T> = T[];

class KeyedIndex<T> {
  private list: T[] | undefined;
  private seen = 0;
  private buckets = new Map<string, Bucket<T>>();
  constructor(
    private readonly key: (item: T) => string,
    // Ausente: o índice guarda todos os itens. Presente: só abertos, e poda os fechados.
    private readonly open?: (item: T) => boolean,
  ) {}
  private sync(list: T[]) {
    if (list !== this.list || list.length < this.seen) {
      this.list = list;
      this.seen = 0;
      this.buckets = new Map();
    }
    for (; this.seen < list.length; this.seen++) {
      const item = list[this.seen];
      if (this.open && !this.open(item)) continue;
      const k = this.key(item);
      const bucket = this.buckets.get(k);
      if (bucket) bucket.push(item);
      else this.buckets.set(k, [item]);
    }
  }
  // Itens da chave, na ordem da lista. Com `open`, só os abertos. O array devolvido é sempre novo:
  // quem o percorre não vê itens indexados depois por uma consulta feita no meio do laço.
  get(list: T[], key: string): readonly T[] {
    this.sync(list);
    const bucket = this.buckets.get(key);
    if (!bucket) return [];
    if (!this.open) return bucket.slice();
    const open = bucket.filter(this.open);
    if (open.length !== bucket.length) {
      if (open.length) this.buckets.set(key, open.slice());
      else this.buckets.delete(key);
    }
    return open;
  }
}

// Lista de abertos (sem chave), na ordem da lista original; poda os fechados na leitura e devolve
// sempre um array novo.
class OpenList<T> {
  private list: T[] | undefined;
  private seen = 0;
  private items: T[] = [];
  constructor(private readonly open: (item: T) => boolean) {}
  get(list: T[]): readonly T[] {
    if (list !== this.list || list.length < this.seen) {
      this.list = list;
      this.seen = 0;
      this.items = [];
    }
    for (; this.seen < list.length; this.seen++)
      if (this.open(list[this.seen])) this.items.push(list[this.seen]);
    const open = this.items.filter(this.open);
    if (open.length !== this.items.length) this.items = open.slice();
    return open;
  }
}

const isOpenShipment = (s: Shipment) => !s.delivered;
const isOpenJob = (j: Job) => !j.completed;
const isPendingOrder = (o: PurchaseOrder) => o.status === 'pending';

type SupplyRecord = NonNullable<World['supplyHistory']>[number];

interface WorldIndexes {
  shipmentsTo: KeyedIndex<Shipment>;
  jobsAt: KeyedIndex<Job>;
  openJobsAt: KeyedIndex<Job>;
  ordersTo: KeyedIndex<PurchaseOrder>;
  ordersBy: KeyedIndex<PurchaseOrder>;
  supplyOf: KeyedIndex<SupplyRecord>;
  openShipments: OpenList<Shipment>;
  openJobs: OpenList<Job>;
}
const indexes = new WeakMap<World, WorldIndexes>();
function of(w: World): WorldIndexes {
  let found = indexes.get(w);
  if (!found) {
    found = {
      shipmentsTo: new KeyedIndex<Shipment>((s) => s.destinationId, isOpenShipment),
      jobsAt: new KeyedIndex<Job>((j) => j.establishmentId),
      openJobsAt: new KeyedIndex<Job>((j) => j.establishmentId, isOpenJob),
      ordersTo: new KeyedIndex<PurchaseOrder>((o) => o.destinationId, isPendingOrder),
      ordersBy: new KeyedIndex<PurchaseOrder>((o) => o.buyerId, isPendingOrder),
      supplyOf: new KeyedIndex<SupplyRecord>((h) => h.establishmentId),
      openShipments: new OpenList<Shipment>(isOpenShipment),
      openJobs: new OpenList<Job>(isOpenJob),
    };
    indexes.set(w, found);
  }
  return found;
}

// Remessas não entregues para o destino (todas as mercadorias, ou só `product`).
export function openShipmentsTo(w: World, destinationId: string, product?: string) {
  const all = of(w).shipmentsTo.get(w.shipments, destinationId);
  return product === undefined ? all : all.filter((s) => s.product === product);
}
// Lotes de produção não concluídos do estabelecimento.
export function openJobsAt(w: World, establishmentId: string) {
  return of(w).openJobsAt.get(w.jobs, establishmentId);
}
// Todos os lotes do estabelecimento ainda na lista (abertos e concluídos não arquivados).
export function jobsAt(w: World, establishmentId: string) {
  return of(w).jobsAt.get(w.jobs, establishmentId);
}
// Pedidos de compra pendentes com o destino (todas as mercadorias, ou só `product`).
export function pendingOrdersTo(w: World, destinationId: string, product?: string) {
  const all = of(w).ordersTo.get(w.orders, destinationId);
  return product === undefined ? all : all.filter((o) => o.product === product);
}
// Pedidos de compra pendentes feitos pela empresa (comprador).
export function pendingOrdersBy(w: World, buyerId: string) {
  return of(w).ordersBy.get(w.orders, buyerId);
}
// Compras da reposição registradas para o estabelecimento (histórico ainda na lista).
const noSupply: SupplyRecord[] = [];
export function supplyHistoryOf(w: World, establishmentId: string) {
  return of(w).supplyOf.get(w.supplyHistory ?? noSupply, establishmentId);
}
// Todas as remessas não entregues e todos os lotes não concluídos do mundo, na ordem da lista.
export function openShipments(w: World) {
  return of(w).openShipments.get(w.shipments);
}
export function openJobs(w: World) {
  return of(w).openJobs.get(w.jobs);
}
