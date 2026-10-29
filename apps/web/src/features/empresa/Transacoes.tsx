import { useGame, cr } from '../../lib/game';
import { IconePixel } from '../../components/IconePixel';
import { gameCalendar } from '../../../../../packages/simulation/src/operations';
import { ICONE_DO_TIPO } from './resumo';

/** "Dia 83 · 14h": o horário do jogo de um lançamento. */
export function momentoDoJogo(world: Parameters<typeof gameCalendar>[0], at: number) {
  const data = gameCalendar(world, at).date;
  const dia = Math.floor((data.getTime() - world.season.startedAt) / 86_400_000) + 1;
  return { dia, hora: data.getUTCHours(), data };
}

/** Últimas movimentações de dinheiro, agrupadas por dia de jogo, com a hora do jogo. */
export function Transacoes({ limite = 12 }: { limite?: number }) {
  const { world, actor } = useGame();
  const itens = world.ledger
    .filter((l) => (l.from === actor || l.to === actor) && l.from !== l.to)
    .sort((a, b) => a.at - b.at)
    .slice(-limite)
    .reverse();
  if (!itens.length)
    return (
      <p className="emp-vazio">Quando você vender ou comprar algo, o dinheiro aparece aqui.</p>
    );
  const grupos: { dia: number; linhas: typeof itens }[] = [];
  for (const l of itens) {
    const { dia } = momentoDoJogo(world, l.at);
    const g = grupos.at(-1);
    if (g && g.dia === dia) g.linhas.push(l);
    else grupos.push({ dia, linhas: [l] });
  }
  return (
    <div className="emp-trans">
      {grupos.map((g) => (
        <section key={g.dia} aria-label={`Dia ${g.dia}`}>
          <h3>Dia {g.dia}</h3>
          <ul>
            {g.linhas.map((l) => {
              const entrou = l.to === actor;
              return (
                <li key={l.id}>
                  <IconePixel nome={ICONE_DO_TIPO[l.kind] ?? 'pedido'} tamanho={28} />
                  <span className="emp-trans-texto">
                    <b>{l.description}</b>
                    <small>{String(momentoDoJogo(world, l.at).hora).padStart(2, '0')}h no jogo</small>
                  </span>
                  <strong className={entrou ? 'entrou' : 'saiu'}>
                    {entrou ? '+' : '−'}
                    {cr(l.amount)}
                  </strong>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
