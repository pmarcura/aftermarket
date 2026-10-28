import { useState } from 'react';
import { useGame, cr, num } from '../../lib/game';
import { Rows, Select, Modal } from '../../components/ui';
import { operatingCosts, laborMarket } from '../../../../../packages/simulation/src/metrics';
import type { Establishment } from '../../../../../packages/simulation/src/model';
import { equipmentCostFor } from '../../../../../packages/simulation/src/design';
export function Installation({
  establishment: e,
  onInstalled,
}: {
  establishment: Establishment;
  onInstalled?: () => void;
}) {
  const { world, run, pending, navigate } = useGame(),
    [recipeId, setRecipe] = useState(e.installed === false ? '' : (e.specialization ?? '')),
    [lines, setLines] = useState(e.installed === false ? 1 : (e.equipmentLines ?? 0) + 1),
    [confirm, setConfirm] = useState(false);
  const p = world.properties.find((p) => p.id === e.propertyId)!,
    recipes = world.season.config.recipes.filter((r) => r.category === e.category),
    recipe = recipes.find((r) => r.id === recipeId),
    profile = recipe ? world.season.config.operations.profiles[recipe.id] : undefined;
  const maximum = profile ? Math.floor(p.area / profile.areaM2) : 1,
    current = e.installed === false ? 0 : (e.equipmentLines ?? maximum),
    perLine = equipmentCostFor(world, e.category, recipe?.id),
    price = Math.max(0, lines - current) * perLine,
    workers = profile ? profile.workers * lines : e.category === 'retail' ? 6 : 4;
  const valid = lines > current && lines <= maximum && (recipes.length === 0 || Boolean(recipe)),
    daily = operatingCosts(world, { ...e, installed: true, employees: workers, mothballed: false }),
    labor = laborMarket(world, p);
  return (
    <section className="panel-content business-section">
      <h2>{e.installed === false ? 'Instalar antes de operar' : 'Equipamentos e capacidade'}</h2>
      <p className="analysis-caption">
        O imóvel já é seu. Equipamentos e equipe são decisões separadas. A instalação é imediata
        neste laboratório; o valor entra no ativo, e não como despesa de venda.
      </p>
      <ol className="opening-steps">
        <li className="complete">Imóvel adquirido</li>
        <li className={e.installed !== false ? 'complete' : ''}>Instalar equipamentos</li>
        <li className={e.employees > 0 ? 'complete' : ''}>Contratar equipe</li>
        <li className={e.enabled ? 'complete' : ''}>Abastecer e operar</li>
      </ol>
      {recipes.length > 0 && (
        <Select
          label="Especialidade da instalação"
          value={recipeId}
          onChange={(ev) => {
            setRecipe(ev.target.value);
            setLines(1);
          }}
        >
          <option value="">Escolher especialidade</option>
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      )}
      <label className="field">
        Linhas de equipamento
        <input
          aria-label="Linhas de equipamento"
          type="number"
          min={current + 1}
          max={maximum}
          value={lines}
          onChange={(ev) => setLines(Number(ev.target.value))}
        />
      </label>
      <Rows
        rows={[
          { label: 'Área disponível', value: `${num(p.area)} m²` },
          {
            label: 'Capacidade física após instalação',
            value: `${num(Math.floor(p.area * world.season.config.design.storageMassPerM2[e.category]))} t / ${num(Math.floor(p.area * world.season.config.design.storageVolumePerM2[e.category]))} m³`,
          },
          {
            label: 'Equipamento por linha',
            value: cr(perLine),
          },
          { label: 'Investimento em equipamento agora', value: cr(price) },
          {
            label: 'Equipe sugerida (não contratada automaticamente)',
            value: `${workers} pessoas`,
          },
          { label: 'Salário mensal por funcionário', value: cr(labor.monthlySalary) },
          { label: 'Fixos estimados / dia com equipe sugerida', value: cr(daily.total) },
          {
            label: 'Capital de giro sugerido para sete dias, sem estoque/frete',
            value: cr(daily.total * 7),
          },
        ]}
      />
      <p className="recovery-note">
        A compra do equipamento não contrata pessoas nem inicia produção. Confira o capital de giro,
        depois ajuste equipe, suprimento e preços.
      </p>
      <div className="recovery-actions">
        <button className="primary" disabled={pending || !valid} onClick={() => setConfirm(true)}>
          Revisar investimento em equipamento
        </button>
        <button className="secondary" onClick={() => navigate('businesses')}>
          Voltar aos negócios
        </button>
      </div>
      {confirm && (
        <Modal
          title="Instalar equipamentos e capitalizar investimento"
          onClose={() => setConfirm(false)}
        >
          <p>
            Pagar {cr(price)} por {lines - current} linha(s). Nenhuma equipe será contratada
            automaticamente. Depois da instalação, contrate os funcionários e abasteça a unidade.
          </p>
          <button
            className="primary full"
            disabled={pending}
            onClick={async () => {
              if (
                await run(
                  { type: 'installBusiness', establishmentId: e.id, recipeId: recipe?.id, lines },
                  'Equipamentos instalados. Agora configure sua equipe.',
                )
              ) {
                setConfirm(false);
                onInstalled?.();
              }
            }}
          >
            Pagar equipamento e instalar
          </button>
        </Modal>
      )}
    </section>
  );
}
