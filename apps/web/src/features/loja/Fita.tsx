import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame, cr, num, ProductIcon } from '../../lib/game';
import { Carimbo } from '../../components/Livro';
import { unidade } from '../economy/Carga';
import { comecoDoDia } from '../inicio/tempo';
import { NumeroVivo } from '../inicio/vivo';
import { products, type Establishment } from '../../../../../packages/simulation/src/model';
import { gameCalendar } from '../../../../../packages/simulation/src/operations';
import '../../design/loja-fita.css';

const RODADAS = 4;

/**
 * As últimas vendas como a fita de uma caixa registradora: um talão por rodada de 2 horas, com o
 * que saiu, o subtotal e o total do dia no topo. A rodada nova chega com o carimbo "nova".
 */
export function Fita({ loja }: { loja: Establishment }) {
  const { world } = useGame();
  const { grupos, hoje } = useMemo(() => {
    const vendas = world.ledger.filter((l) => l.establishmentId === loja.id && l.kind === 'retail');
    const porRodada = new Map<number, typeof vendas>();
    for (const l of vendas.slice(-80)) porRodada.set(l.at, [...(porRodada.get(l.at) ?? []), l]);
    const inicio = comecoDoDia(world);
    return {
      grupos: [...porRodada]
        .sort((a, b) => b[0] - a[0])
        .slice(0, RODADAS)
        .map(([at, itens]) => ({
          at,
          itens: itens.sort((a, b) => b.amount - a.amount),
          total: itens.reduce((n, l) => n + l.amount, 0),
        })),
      hoje: vendas.filter((l) => l.at >= inicio).reduce((n, l) => n + l.amount, 0),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world.revision, loja.id]);

  // Marca como "nova" a rodada que acabou de chegar, sem marcar as que já estavam na tela.
  const vista = useRef<number | null>(null);
  const [nova, setNova] = useState<number | null>(null);
  const maisRecente = grupos[0]?.at ?? null;
  useEffect(() => {
    if (maisRecente === null) return;
    if (vista.current !== null && maisRecente > vista.current) {
      setNova(maisRecente);
      const t = setTimeout(() => setNova(null), 6000);
      vista.current = maisRecente;
      return () => clearTimeout(t);
    }
    vista.current = maisRecente;
  }, [maisRecente]);

  return (
    <section className="fita" aria-labelledby="fita-titulo">
      <header>
        <h3 id="fita-titulo" className="lv-grande">
          Caixa da loja
        </h3>
        <span className="fita-hoje">
          <small>vendido hoje</small>
          <b>
            <NumeroVivo valor={hoje} formato={(v) => cr(v, 0)} id={`fita-${loja.id}`} />
          </b>
        </span>
      </header>
      {grupos.length === 0 ? (
        <p className="fita-vazio lv-mao">
          As famílias compram a cada 2 horas de jogo. A primeira venda aparece aqui.
        </p>
      ) : (
        <ol className="fita-lista">
          {grupos.map((g, i) => {
            const data = gameCalendar(world, g.at).date;
            return (
              <li key={g.at} className={`talao ${nova === g.at ? 'nova' : ''}`}>
                <div className="talao-topo">
                  <time dateTime={data.toISOString()}>
                    {String(data.getUTCHours()).padStart(2, '0')}h
                  </time>
                  {nova === g.at && (
                    <Carimbo tom="lavoura" giro={-5}>
                      nova
                    </Carimbo>
                  )}
                  <b className="talao-total">+{cr(g.total, 0)}</b>
                </div>
                <ul>
                  {g.itens.slice(0, i === 0 ? 8 : 4).map((l) => (
                    <li key={l.id}>
                      {l.product && <ProductIcon product={l.product} size={20} />}
                      <span>
                        {num(l.quantity ?? 0)}{' '}
                        {l.product ? unidade(l.product, l.quantity ?? 0) : ''} de{' '}
                        {l.product ? products[l.product].name : l.description}
                      </span>
                      <b>{cr(l.amount, 0)}</b>
                    </li>
                  ))}
                  {g.itens.length > (i === 0 ? 8 : 4) && (
                    <li className="talao-mais">
                      <span>+{g.itens.length - (i === 0 ? 8 : 4)} itens menores</span>
                    </li>
                  )}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
