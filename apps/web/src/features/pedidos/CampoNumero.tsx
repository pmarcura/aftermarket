import { useId } from 'react';
import { Minus, Plus } from 'lucide-react';

/** Campo numérico grande com − e +, para ajustar sem digitar. `casas` = 2 aceita centavos. */
export function CampoNumero({
  rotulo,
  valor,
  onChange,
  min = 0,
  max = 1_000_000_000,
  passo = 1,
  casas = 0,
  sufixo,
  ajuda,
}: {
  rotulo: string;
  valor: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  passo?: number;
  casas?: number;
  sufixo?: string;
  ajuda?: string;
}) {
  const id = useId();
  const fator = 10 ** casas;
  const ajustar = (v: number) => {
    if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, Math.round(v * fator) / fator)));
  };
  return (
    <div className="ped-campo">
      <label htmlFor={id}>{rotulo}</label>
      <div>
        <button
          type="button"
          className="secondary"
          aria-label={`Diminuir: ${rotulo}`}
          onClick={() => ajustar(valor - passo)}
        >
          <Minus size={16} />
        </button>
        <input
          id={id}
          type="number"
          inputMode={casas ? 'decimal' : 'numeric'}
          min={min}
          max={max}
          step={casas ? 1 / fator : 1}
          value={Number.isFinite(valor) ? valor : ''}
          onChange={(ev) => ajustar(Number(ev.target.value))}
        />
        <button
          type="button"
          className="secondary"
          aria-label={`Aumentar: ${rotulo}`}
          onClick={() => ajustar(valor + passo)}
        >
          <Plus size={16} />
        </button>
        {sufixo && <em>{sufixo}</em>}
      </div>
      {ajuda && <small>{ajuda}</small>}
    </div>
  );
}
