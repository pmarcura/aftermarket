import type { LabOptions } from '../../../../packages/simulation/src/lab';
import { recipes } from '../../../../packages/simulation/src/model';
import { expansionRecipes } from '../../../../packages/simulation/src/operations';

export type LabParametersValue = Pick<
  LabOptions,
  | 'costMultiplier'
  | 'capacityMultiplier'
  | 'freightMultiplier'
  | 'botPolicy'
  | 'shock'
  | 'capacityRecipe'
>;
export const initialParameters: LabParametersValue = {
  costMultiplier: 1,
  capacityMultiplier: 1,
  freightMultiplier: 1,
  botPolicy: 'mixed',
};
export function LabParameters({
  value,
  onChange,
  days,
}: {
  value: LabParametersValue;
  onChange: (value: LabParametersValue) => void;
  days: number;
}) {
  return (
    <details className="lab-parameters">
      <summary>Custos, capacidade e comportamento</summary>
      {(
        [
          ['costMultiplier', 'Multiplicador de custo operacional'],
          ['capacityMultiplier', 'Multiplicador de velocidade de produção'],
          ['freightMultiplier', 'Multiplicador de frete'],
        ] as const
      ).map(([field, label]) => (
        <label key={field}>
          {label}
          <input
            type="number"
            min={0.25}
            max={3}
            step={0.05}
            required
            value={value[field]}
            onChange={(event) => onChange({ ...value, [field]: Number(event.target.value) })}
          />
        </label>
      ))}
      <label>
        Receita alvo da velocidade (opcional)
        <select
          value={value.capacityRecipe ?? ''}
          onChange={(event) =>
            onChange({ ...value, capacityRecipe: event.target.value || undefined })
          }
        >
          <option value="">Todas as receitas</option>
          {[...recipes, ...expansionRecipes].map((recipe) => (
            <option key={recipe.id} value={recipe.id}>
              {recipe.name}
            </option>
          ))}
        </select>
      </label>
      <p className="lab-footnote">
        Velocidade divide a duração dos ciclos, preservando receitas e cargas. Custos alteram
        salários, manutenção, utilidades e processamento. Frete preserva o mínimo comercial.
      </p>
      <label>
        Política dos bots
        <select
          value={value.botPolicy}
          onChange={(event) =>
            onChange({ ...value, botPolicy: event.target.value as LabOptions['botPolicy'] })
          }
        >
          <option value="mixed">Estratégias distribuídas</option>
          <option value="regional">Todos regionais</option>
          <option value="quality">Todos focados em qualidade</option>
          <option value="value">Todos focados em preço</option>
        </select>
      </label>
      <label className="lab-check">
        <input
          type="checkbox"
          checked={!!value.shock}
          onChange={(event) =>
            onChange({
              ...value,
              shock: event.target.checked
                ? { day: Math.min(15, days), type: 'demand', multiplier: 0.5 }
                : undefined,
            })
          }
        />{' '}
        Aplicar choque durante a simulação
      </label>
      {value.shock && (
        <div className="lab-shock">
          <label>
            Dia do choque
            <input
              type="number"
              min={1}
              max={days}
              required
              value={value.shock.day}
              onChange={(event) =>
                onChange({ ...value, shock: { ...value.shock!, day: Number(event.target.value) } })
              }
            />
          </label>
          <label>
            Fator afetado pelo choque
            <select
              value={value.shock.type}
              onChange={(event) =>
                onChange({
                  ...value,
                  shock: {
                    ...value.shock!,
                    type: event.target.value as 'demand' | 'freight' | 'cost',
                  },
                })
              }
            >
              <option value="demand">Demanda familiar</option>
              <option value="freight">Frete</option>
              <option value="cost">Custo operacional</option>
            </select>
          </label>
          <label>
            Multiplicador do choque
            <input
              type="number"
              min={0.25}
              max={3}
              step={0.05}
              required
              value={value.shock.multiplier}
              onChange={(event) =>
                onChange({
                  ...value,
                  shock: { ...value.shock!, multiplier: Number(event.target.value) },
                })
              }
            />
          </label>
          <p className="lab-footnote">
            Choque aplicado no dia escolhido. A configuração efetiva e o evento ficam no relatório.
          </p>
        </div>
      )}
    </details>
  );
}
