// Régua de desempenho do clique (spec 013, fase 0). Mede, num mundo de referência fixo, quanto
// cada etapa de um comando de jogador custa: cópia para desfazer, avanço do tempo, regra do jogo,
// gravação no disco e montagem da resposta. Também mede a foto do mundo inteiro (spec 014: a
// cada 5 min no servidor; aqui a cada 3 cliques, para ter amostras).
//
// Uso: npm run perf:click -- [--dir=.runtime/perf] [--scale=20] [--days=7] [--commands=60]
//                            [--copy=<mundo.sqlite>] [--out=<relatorio.json>]
//   --dir   pasta do mundo de referência e da cópia medida; aponte para outro disco (SSD × HD).
//   --copy  mede uma cópia de um mundo existente (VACUUM INTO) em vez do mundo de referência.
// O mundo de referência (playtest, semente fixa, N dias de jogo) é criado uma vez e nunca é
// alterado: cada execução mede uma cópia dele.
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStore, type Etapas } from '../apps/server/src/store';
import { worldView } from '../apps/server/src/view';
import { gameDay } from '../packages/simulation/src/clock';
import { defaultSupplyPolicy } from '../packages/simulation/src/competition';
import type { Command, ProductId } from '../packages/simulation/src/model';
import { RuleError } from '../packages/simulation/src/engine';

const arg = (name: string, fallback?: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const dir = resolve(arg('dir', '.runtime/perf')!);
const scale = Number(arg('scale', '20'));
const days = Number(arg('days', '7'));
const total = Number(arg('commands', '60'));
const copy = arg('copy');
mkdirSync(dir, { recursive: true });

const vacuum = (from: string, to: string) => {
  rmSync(to, { force: true });
  const db = new DatabaseSync(from, { readOnly: true });
  db.exec(`VACUUM INTO '${to.replaceAll("'", "''")}'`);
  db.close();
};
const mb = (path: string) => statSync(path).size / 1e6;

// 1. Mundo de referência: criado uma vez, depois só copiado.
const reference = resolve(dir, `referencia-s${scale}-d${days}.sqlite`);
if (!copy && !existsSync(reference)) {
  const building = `${reference}.criando`;
  rmSync(building, { force: true });
  const t = performance.now();
  const store = createStore(building, { scenario: 'playtest', scale });
  const w = store.read();
  const target = w.updatedAt + days * gameDay(w);
  for (let at = w.updatedAt; at < target;) {
    at = Math.min(target, at + gameDay(w) / 12);
    // Avança em lotes até não haver mais eventos até `at`.
    let revision = -1;
    while (revision !== store.read().revision) {
      revision = store.read().revision;
      store.tick(at);
    }
  }
  store.flush();
  store.close();
  vacuum(building, reference);
  rmSync(building, { force: true });
  for (const sufixo of ['-wal', '-shm']) rmSync(`${building}${sufixo}`, { force: true });
  console.log(
    `Mundo de referência criado em ${Math.round((performance.now() - t) / 1000)} s: ${reference}`,
  );
}

// 2. Cópia medida (o original nunca é aberto para escrita).
const run = resolve(dir, 'medicao.sqlite');
for (const sufixo of ['', '-wal', '-shm']) rmSync(`${run}${sufixo}`, { force: true });
let t = performance.now();
vacuum(copy ? resolve(copy) : reference, run);
console.log(`Cópia para medir: ${Math.round(performance.now() - t)} ms, ${mb(run).toFixed(0)} MB`);
t = performance.now();
const store = createStore(run, { scale });
const abrir = performance.now() - t;
let w = store.read();

// 3. Comandos de jogador reais: preço, regra de reposição e compra no pregão.
const actor = w.companies.find((c) => !c.bot && c.id === 'player')?.id ?? 'player';
const shop = w.establishments.find((e) => e.companyId === actor && e.category === 'retail');
if (!shop) throw new Error('O jogador não tem loja neste mundo.');
const carrier =
  w.establishments.find((e) => e.category === 'logistics' && e.companyId !== actor)?.companyId ??
  'transbrasil';
const commands: ((i: number) => Command | null)[] = [
  (i) => {
    const product = Object.keys(shop.inventory)[
      i % Math.max(1, Object.keys(shop.inventory).length)
    ];
    return product
      ? {
          type: 'setPrice',
          establishmentId: shop.id,
          product: product as ProductId,
          price: (shop.prices[product as ProductId] ?? 1000) + (i % 7),
        }
      : null;
  },
  (i) => ({
    type: 'configureSupply',
    establishmentId: shop.id,
    policy: { ...defaultSupplyPolicy(store.read(), shop), dailyBudget: 5000000 + i },
  }),
  (i) => {
    const now = store.read();
    const offers = now.offers.filter(
      (o) =>
        (now.establishments.find((e) => e.id === o.establishmentId)?.inventory[o.product] ?? 0) > 0,
    );
    const offer = offers[(i * 7919) % Math.max(1, offers.length)];
    return offer
      ? {
          type: 'trade',
          offerId: offer.id,
          quantity: 1,
          destinationId: shop.id,
          carrierId: carrier,
        }
      : null;
  },
];

type Linha = Etapas & { vista: number; total: number; tipo: string; ok: boolean };
const linhas: Linha[] = [];
const gravacoes: { avanco: number; gravacao: number }[] = [];
let real = store.read().updatedAt + 1000;
for (let i = 0; i < total; i++) {
  // 15 s reais entre cliques: a cada 4 cliques passa uma rodada econômica (a 120×).
  real += 15000;
  const command = commands[i % commands.length](i);
  if (!command) continue;
  const inicio = performance.now();
  let ok = true;
  try {
    w = store.command(actor, command, crypto.randomUUID(), real);
  } catch (error) {
    if (!(error instanceof RuleError)) throw error;
    ok = false;
  }
  const antesDaVista = performance.now();
  if (ok) worldView(w, actor);
  const fim = performance.now();
  const etapas = store.ultimoClique() ?? { copia: 0, avanco: 0, comando: 0, gravacao: 0 };
  linhas.push({
    ...etapas,
    vista: ok ? fim - antesDaVista : 0,
    total: fim - inicio,
    tipo: command.type,
    ok,
  });
  // Passagem do tempo + foto do mundo inteiro (a cada 5 min no servidor real).
  if (i % 3 === 2) {
    const a = performance.now();
    store.tick(real + 5000);
    const b = performance.now();
    store.flush();
    gravacoes.push({ avanco: b - a, gravacao: performance.now() - b });
  }
}
store.close();

// 4. Relatório: p50, p95 e máximo de cada etapa.
const pct = (xs: number[], p: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};
const resumo = (xs: number[]) => ({
  p50: Math.round(pct(xs, 50)),
  p95: Math.round(pct(xs, 95)),
  max: Math.round(Math.max(0, ...xs)),
});
const etapas = ['copia', 'avanco', 'comando', 'gravacao', 'vista', 'total'] as const;
const report = {
  em: new Date().toISOString(),
  disco: dir.slice(0, 2),
  mundo: copy ?? reference,
  tamanhoMb: Math.round(mb(run)),
  extrato: w.ledger.length,
  estabelecimentos: w.establishments.length,
  abrirMs: Math.round(abrir),
  cliques: linhas.length,
  recusados: linhas.filter((l) => !l.ok).length,
  porEtapa: Object.fromEntries(etapas.map((e) => [e, resumo(linhas.map((l) => l[e]))])),
  porTipo: Object.fromEntries(
    [...new Set(linhas.map((l) => l.tipo))].map((tipo) => [
      tipo,
      resumo(linhas.filter((l) => l.tipo === tipo).map((l) => l.total)),
    ]),
  ),
  gravacaoAutomatica: {
    avanco: resumo(gravacoes.map((g) => g.avanco)),
    gravacao: resumo(gravacoes.map((g) => g.gravacao)),
  },
};
for (const sufixo of ['', '-wal', '-shm']) rmSync(`${run}${sufixo}`, { force: true });

console.log(
  `\nDisco ${report.disco} · mundo ${report.tamanhoMb} MB · extrato ${report.extrato} linhas · ${report.estabelecimentos} estabelecimentos · abrir ${report.abrirMs} ms`,
);
console.log(`${report.cliques} cliques (${report.recusados} recusados pela regra do jogo)\n`);
console.log('etapa        p50 ms   p95 ms   máx ms');
for (const e of etapas) {
  const r = report.porEtapa[e];
  console.log(
    `${e.padEnd(10)} ${String(r.p50).padStart(8)} ${String(r.p95).padStart(8)} ${String(r.max).padStart(8)}`,
  );
}
const g = report.gravacaoAutomatica;
console.log(
  `\nfoto do mundo inteiro (a cada 5 min): avanço p95 ${g.avanco.p95} ms · gravação p95 ${g.gravacao.p95} ms (máx ${g.gravacao.max} ms)`,
);
const out = arg('out');
if (out) {
  writeFileSync(resolve(out), JSON.stringify(report, null, 2));
  console.log(`Relatório em ${resolve(out)}`);
}
