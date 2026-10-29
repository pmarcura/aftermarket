import { num } from '../lib/game';

/** O estado do estoque numa palavra e numa cor: brasa até 1 dia, ouro até 3, lavoura daí em diante. */
export function estadoDeEstoque(estoque: number, dias: number) {
  const horas = Math.round(dias * 24);
  const estado =
    estoque <= 0
      ? { tom: 'brasa', texto: 'Esgotado' }
      : dias === Infinity
        ? { tom: 'apagado', texto: 'Parado neste preço' }
        : dias < 1
          ? { tom: 'brasa', texto: `Acaba em ~${num(Math.max(1, horas))} h` }
          : dias < 3
            ? { tom: 'ouro', texto: `Dura ~${num(dias, 1)} dias` }
            : {
                tom: 'lavoura',
                texto: `Em dia: ${num(Math.min(dias, 99), dias < 10 ? 1 : 0)} dias`,
              };
  return { ...estado, cheio: dias === Infinity ? 0 : Math.min(1, dias / 7) };
}

/** Palavra de estado mais um medidor liso que enche até 7 dias de estoque. */
export function EstadoEstoque({ estoque, dias }: { estoque: number; dias: number }) {
  const e = estadoDeEstoque(estoque, dias);
  return (
    <>
      <span className={`item-estado tom-${e.tom}`}>{e.texto}</span>
      <div
        className="item-medidor"
        role="img"
        aria-label={
          dias === Infinity ? 'Sem vendas neste preço' : `Estoque para ${num(dias, 1)} dias`
        }
      >
        <i className={`tom-${e.tom}`} style={{ width: `${e.cheio * 100}%` }} />
      </div>
    </>
  );
}
