import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useGame, cr, num } from '../../lib/game';
import { Modal } from '../../components/ui';
import { IconePixel } from '../../components/IconePixel';
import { ProdutoArte } from '../economy/Vitrine';
import { operatingCosts, laborMarket } from '../../../../../packages/simulation/src/metrics';
import {
  products,
  type Establishment,
  type ProductId,
} from '../../../../../packages/simulation/src/model';
import { equipmentCostFor, freeCash } from '../../../../../packages/simulation/src/design';
import '../../design/producao.css';

export function Installation({
  establishment: e,
  onInstalled,
}: {
  establishment: Establishment;
  onInstalled?: () => void;
}) {
  const { world, actor, run, pending, navigate } = useGame(),
    [recipeId, setRecipe] = useState(
      e.installed === false
        ? (world.season.config.recipes.find((r) => r.category === e.category)?.id ?? '')
        : (e.specialization ?? ''),
    ),
    [lines, setLines] = useState(e.installed === false ? 1 : (e.equipmentLines ?? 0) + 1),
    [confirm, setConfirm] = useState(false);
  const p = world.properties.find((p) => p.id === e.propertyId)!,
    recipes = world.season.config.recipes.filter(
      (r) => r.category === e.category && !r.alternativeOf,
    ),
    recipe = recipes.find((r) => r.id === recipeId) ?? recipes[0],
    profile = recipe ? world.season.config.operations.profiles[recipe.id] : undefined;
  const maximum = profile ? Math.floor(p.area / profile.areaM2) : 1,
    current = e.installed === false ? 0 : (e.equipmentLines ?? maximum),
    perLine = equipmentCostFor(world, e.category, recipe?.id),
    price = Math.max(0, lines - current) * perLine,
    workers = profile ? profile.workers * lines : e.category === 'retail' ? 6 : 4;
  const valid =
      Number.isInteger(lines) &&
      lines > current &&
      lines <= maximum &&
      (recipes.length === 0 || Boolean(recipe)),
    daily = operatingCosts(world, { ...e, installed: true, employees: workers, mothballed: false }),
    labor = laborMarket(world, p),
    caixa = freeCash(world, actor);

  return (
    <section className="prod-bloco" aria-label="Instalar equipamentos">
      {recipes.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          <h3>O que esta unidade vai produzir?</h3>
          <div className="fro-modelos" role="radiogroup" aria-label="Especialidade da instalação">
            {recipes.map((r) => {
              const saida = Object.keys(r.output)[0] as ProductId;
              const custoLinha = equipmentCostFor(world, e.category, r.id);
              const sel = (recipe?.id ?? '') === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  role="radio"
                  aria-checked={sel}
                  className={sel ? 'on' : ''}
                  onClick={() => {
                    setRecipe(r.id);
                    setLines(1);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ProdutoArte product={saida} escala={1} />
                    <strong>{r.name}</strong>
                  </div>
                  <span>{cr(custoLinha, 0)} por linha</span>
                  <small>
                    Produz {num(r.output[saida] ?? 0)} {products[saida].unit} por ciclo
                  </small>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {maximum === 0 && profile && (
        <p className="warning-text" role="status">
          Este terreno tem {num(p.area)} m²; uma linha de {recipe!.name} precisa de{' '}
          {num(profile.areaM2)} m². Escolha outra especialidade ou um imóvel maior.
        </p>
      )}
      {maximum > 0 && current >= maximum && (
        <p className="warning-text" role="status">
          Este terreno já atingiu o limite de {num(maximum)} {maximum === 1 ? 'linha' : 'linhas'} de
          equipamento. Escolha um imóvel maior para ampliar.
        </p>
      )}

      {maximum > 1 && current < maximum && (
        <div className="recibo-ciclos" role="group" aria-label="Linhas de equipamento">
          <span>
            Quantas linhas instalar? (cabem até {num(maximum)} em {num(p.area)} m²)
          </span>
          <div>
            <button
              type="button"
              className="secondary"
              aria-label="Menos uma linha"
              onClick={() => setLines(Math.max(current + 1, lines - 1))}
            >
              <Minus size={18} />
            </button>
            <input
              aria-label="Linhas de equipamento"
              type="number"
              min={current + 1}
              max={maximum}
              value={lines}
              onChange={(ev) =>
                setLines(
                  Math.max(
                    current + 1,
                    Math.min(maximum, Math.floor(Number(ev.target.value)) || current + 1),
                  ),
                )
              }
            />
            <button
              type="button"
              className="secondary"
              aria-label="Mais uma linha"
              onClick={() => setLines(Math.min(maximum, lines + 1))}
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
      )}

      <div className="compra-lote-tres">
        <div className="compra-lote-card">
          <span>
            <IconePixel nome="moeda" tamanho={22} /> Equipamento agora
          </span>
          <b>{cr(price, 0)}</b>
          <small>
            Caixa livre: {cr(caixa, 0)} ({cr(perLine, 0)} por linha)
          </small>
        </div>
        <div className="compra-lote-card">
          <span>
            <IconePixel nome="equipe" tamanho={22} /> Equipe sugerida depois
          </span>
          <b>{workers} pessoas</b>
          <small>
            Salário na cidade: {cr(labor.monthlySalary, 0)}/mês · fixos ~{cr(daily.total, 0)}/dia
          </small>
        </div>
        <div className="compra-lote-card ok">
          <span>
            <IconePixel nome="caixa" tamanho={22} /> Capacidade do armazém
          </span>
          <b>
            {num(Math.floor(p.area * world.season.config.design.storageMassPerM2[e.category]))} t
          </b>
          <small>
            {num(Math.floor(p.area * world.season.config.design.storageVolumePerM2[e.category]))} m³
            de espaço físico
          </small>
        </div>
      </div>

      <div className="recovery-actions">
        <button className="primary" disabled={pending || !valid} onClick={() => setConfirm(true)}>
          Instalar por {cr(price, 0)}
        </button>
        <button className="secondary" onClick={() => navigate('businesses')}>
          Voltar aos negócios
        </button>
      </div>

      {confirm && (
        <Modal title="Confirmar instalação" onClose={() => setConfirm(false)}>
          <p>
            Pagar <strong>{cr(price, 0)}</strong> para instalar{' '}
            <strong>
              {lines - current} {lines - current === 1 ? 'linha' : 'linhas'}
            </strong>{' '}
            em <strong>{e.name}</strong>. Em seguida você contrata a equipe e abastece a unidade.
          </p>
          <button
            className="primary full"
            disabled={pending || !valid}
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
