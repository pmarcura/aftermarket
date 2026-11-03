import { useMemo, useState } from 'react';
import { useGame, cr, num, ProductIcon } from '../../lib/game';
import { GraficoPixel } from '../../components/GraficoPixel';
import { Ficha } from '../inicio/pecas';
import { NumeroVivo } from '../inicio/vivo';
import { comecoDoDia } from '../inicio/tempo';
import { unidade } from '../economy/Carga';
import { Consumption } from '../business/Financas';
import {
  products,
  type Entry,
  type Establishment,
  type ProductId,
  type World,
} from '../../../../../packages/simulation/src/model';
import { gameCalendar } from '../../../../../packages/simulation/src/operations';
import { gameDay } from '../../../../../packages/simulation/src/clock';
import '../../design/inicio-ajustes.css';
import '../../design/loja-resultado.css';

type Periodo = 'hoje' | 'semana';
type Custo = 'mercadoria' | 'equipe' | 'energia' | 'outros';

const DEGRAUS: { id: Custo; rotulo: string }[] = [
  { id: 'mercadoria', rotulo: 'Mercadoria vendida' },
  { id: 'equipe', rotulo: 'Equipe' },
  { id: 'energia', rotulo: 'Energia e água' },
  { id: 'outros', rotulo: 'Manutenção e outros' },
];

const grupoDe = (kind: Entry['kind']): Custo | null =>
  kind === 'payroll' || kind === 'education'
    ? 'equipe'
    : kind === 'energy' || kind === 'water'
      ? 'energia'
      : kind === 'maintenance' || kind === 'operation' || kind === 'finance'
        ? 'outros'
        : null;

/**
 * O resultado da loja pelo extrato: vendas, o custo médio da mercadoria que saiu e as despesas da
 * operação, por dia e por produto. Compras de mercadoria não entram como custo: viram estoque e só
 * pesam quando vendem.
 */
function resultadoDaLoja(world: World, loja: Establishment, dias: number) {
  const fimHoje = comecoDoDia(world) + gameDay(world);
  const inicio = fimHoje - dias * gameDay(world);
  const balde = (at: number) => Math.min(dias - 1, Math.floor((at - inicio) / gameDay(world)));
  const vendas = new Array<number>(dias).fill(0);
  const custosDia = new Array<number>(dias).fill(0);
  const custos: Record<Custo, number> = { mercadoria: 0, equipe: 0, energia: 0, outros: 0 };
  const porProduto = new Map<ProductId, { qtd: number; receita: number; custo: number }>();
  let compras = 0;
  for (const l of world.ledger) {
    if (l.establishmentId !== loja.id || l.at < inicio) continue;
    const i = balde(l.at);
    if (l.kind === 'retail' && l.to === loja.companyId) {
      vendas[i] += l.amount;
      // Custo da mercadoria vendida pelo custo médio de agora (frete incluso): estimativa.
      const custo = l.product ? (loja.unitCosts[l.product] ?? 0) * (l.quantity ?? 0) : 0;
      custos.mercadoria += custo;
      custosDia[i] += custo;
      if (l.product) {
        const p = porProduto.get(l.product) ?? { qtd: 0, receita: 0, custo: 0 };
        p.qtd += l.quantity ?? 0;
        p.receita += l.amount;
        p.custo += custo;
        porProduto.set(l.product, p);
      }
      continue;
    }
    if (l.from !== loja.companyId) continue;
    if (l.kind === 'trade' || l.kind === 'freight') {
      compras += l.amount;
      continue;
    }
    const g = grupoDe(l.kind);
    if (!g) continue;
    custos[g] += l.amount;
    custosDia[i] += l.amount;
  }
  const totalVendas = vendas.reduce((n, v) => n + v, 0);
  const totalCustos = Object.values(custos).reduce((n, v) => n + v, 0);
  return {
    dias,
    inicio,
    vendas: totalVendas,
    custos,
    lucro: totalVendas - totalCustos,
    compras,
    lucroDia: vendas.map((v, i) => v - custosDia[i]),
    produtos: [...porProduto]
      .map(([id, p]) => ({ id, ...p, lucro: p.receita - p.custo }))
      .sort((a, b) => b.lucro - a.lucro),
  };
}

/** Cascata do lucro: das vendas, cada custo desce um degrau até o que sobra. */
function Cascata({ r }: { r: ReturnType<typeof resultadoDaLoja> }) {
  const max = Math.max(1, r.vendas);
  const min = Math.min(0, r.lucro);
  const y = (v: number) => ((v - min) / (max - min)) * 100;
  let nivel = r.vendas;
  const degraus = DEGRAUS.map((d) => {
    const de = nivel;
    nivel -= r.custos[d.id];
    return { ...d, de, ate: nivel, valor: r.custos[d.id] };
  });
  const bar = (de: number, ate: number) => ({
    bottom: `${y(Math.min(de, ate))}%`,
    height: `${Math.max(0.6, Math.abs(y(de) - y(ate)))}%`,
  });
  return (
    <div
      className="rl-cascata"
      role="img"
      aria-label={`Vendas ${cr(r.vendas, 0)}; ${degraus.map((d) => `${d.rotulo} −${cr(d.valor, 0)}`).join('; ')}; lucro ${cr(r.lucro, 0)}.`}
    >
      <div className="rl-coluna vendas">
        <span className="rl-valor">{cr(r.vendas, 0)}</span>
        <i style={bar(0, r.vendas)} />
        <span className="rl-rotulo">Vendas</span>
      </div>
      {degraus.map((d, k) => (
        <div key={d.id} className={`rl-coluna custo c${k}`}>
          <span className="rl-valor">−{cr(d.valor, 0)}</span>
          <i style={bar(d.de, d.ate)} />
          <span className="rl-rotulo">{d.rotulo}</span>
        </div>
      ))}
      <div className={`rl-coluna lucro ${r.lucro >= 0 ? 'pos' : 'neg'}`}>
        <span className="rl-valor">{cr(r.lucro, 0)}</span>
        <i style={bar(0, r.lucro)} />
        <span className="rl-rotulo">Lucro</span>
      </div>
      <span
        className="rl-zero"
        style={{ bottom: `calc(46px + (100% - 76px) * ${y(0) / 100})` }}
        aria-hidden="true"
      />
    </div>
  );
}

export function ResultadoLoja({ loja }: { loja: Establishment }) {
  const { world } = useGame();
  const [periodo, setPeriodo] = useState<Periodo>('semana');
  const dias = periodo === 'hoje' ? 1 : 7;
  const r = useMemo(
    () => resultadoDaLoja(world, loja, dias),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision, loja.id, dias],
  );
  const semana = useMemo(
    () => (periodo === 'semana' ? r : resultadoDaLoja(world, loja, 7)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [r, periodo, world.revision, loja.id],
  );
  const margem = r.vendas > 0 ? r.lucro / r.vendas : 0;
  const maiorProduto = Math.max(1, ...r.produtos.map((p) => Math.abs(p.lucro)));
  const rotulos = semana.lucroDia.map((_, i) =>
    i === 6
      ? 'hoje'
      : gameCalendar(world, semana.inicio + (i + 0.5) * gameDay(world))
          .label.slice(0, 3)
          .toLocaleLowerCase('pt-BR'),
  );

  return (
    <div className="rl">
      <div className="rl-topo">
        <article className="rl-nota">
          <span className="rl-etiqueta lv-rotulo">
            {periodo === 'hoje' ? 'Lucro de hoje' : 'Lucro dos últimos 7 dias'}
          </span>
          <b className={`rl-lucro ${r.lucro >= 0 ? 'pos' : 'neg'}`}>
            <NumeroVivo valor={r.lucro} formato={(v) => cr(v, 0)} id={`rl-${loja.id}-${periodo}`} />
          </b>
          <span className="lv-mao">
            {r.vendas === 0
              ? 'nenhuma venda ainda'
              : r.lucro >= 0
                ? margem > 0.2
                  ? 'a loja dá bom lucro'
                  : 'lucro apertado'
                : 'a loja está no prejuízo'}
          </span>
          <small>
            Vendas menos o custo médio da mercadoria vendida e as despesas da loja. Estimativa com o
            extrato disponível.
          </small>
        </article>
        <div className="rl-lado">
          <div className="rl-periodo" role="radiogroup" aria-label="Período">
            {(
              [
                ['hoje', 'Hoje'],
                ['semana', '7 dias'],
              ] as const
            ).map(([id, rotulo]) => (
              <button
                key={id}
                role="radio"
                aria-checked={periodo === id}
                className={periodo === id ? 'on' : ''}
                onClick={() => setPeriodo(id)}
              >
                {rotulo}
              </button>
            ))}
          </div>
          <div className="rl-fichas">
            <Ficha rotulo="Vendas" tom="lavoura" valor={cr(r.vendas, 0)} />
            <Ficha
              rotulo="Margem"
              tom={margem >= 0.15 ? 'lavoura' : margem >= 0 ? 'ouro' : 'brasa'}
              valor={`${num(margem * 100)}%`}
            />
            <Ficha
              rotulo="Lucro por dia"
              tom={r.lucro >= 0 ? 'lavoura' : 'brasa'}
              valor={cr(r.lucro / r.dias, 0)}
            />
            <Ficha rotulo="Virou estoque" tom="ceu" valor={cr(r.compras, 0)} />
          </div>
        </div>
      </div>

      <section className="rl-bloco" aria-labelledby="rl-cascata">
        <h4 id="rl-cascata" className="lv-grande">
          De onde vem o lucro
        </h4>
        <Cascata r={r} />
      </section>

      <section className="rl-bloco" aria-labelledby="rl-produtos">
        <h4 id="rl-produtos" className="lv-grande">
          Lucro por produto
        </h4>
        {r.produtos.length === 0 ? (
          <p className="rl-vazio">Nenhuma venda no período.</p>
        ) : (
          <ul className="rl-produtos">
            {r.produtos.map((p) => {
              const m = p.receita > 0 ? p.lucro / p.receita : 0;
              return (
                <li key={p.id} className={p.lucro >= 0 ? 'pos' : 'neg'}>
                  <ProductIcon product={p.id} size={22} />
                  <span className="rl-prod-nome">
                    <b>{products[p.id].name}</b>
                    <small>
                      {num(p.qtd)} {unidade(p.id, p.qtd)} · vendeu {cr(p.receita, 0)} · margem{' '}
                      {num(m * 100)}%
                    </small>
                  </span>
                  <span className="rl-prod-barra">
                    <i style={{ width: `${(Math.abs(p.lucro) / maiorProduto) * 100}%` }} />
                  </span>
                  <b className="rl-prod-lucro">
                    {p.lucro >= 0 ? '+' : '−'}
                    {cr(Math.abs(p.lucro), 0)}
                  </b>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rl-bloco" aria-labelledby="rl-dias">
        <h4 id="rl-dias" className="lv-grande">
          Lucro dia a dia
        </h4>
        <GraficoPixel
          titulo="Lucro da loja em cada um dos últimos 7 dias de jogo"
          tipo="barras"
          altura={220}
          rotulos={rotulos}
          destaque={6}
          series={[{ nome: 'Lucro', valores: semana.lucroDia, cor: 1 }]}
          formato={(v) => cr(v, 0)}
          formatoEixo={(v) => cr(v, 0)}
        />
      </section>

      <details className="rl-bloco rl-procura">
        <summary className="lv-grande">Procura da cidade por produto</summary>
        <Consumption key={`${loja.id}-consumo`} establishment={loja} />
      </details>
    </div>
  );
}
