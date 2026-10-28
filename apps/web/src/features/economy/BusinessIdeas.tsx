import { useMemo } from 'react';
import { MapPin } from 'lucide-react';
import { useGame, cr, num, CategoryIcon } from '../../lib/game';
import { Badge, Panel } from '../../components/ui';
import { analyzeDesign } from '../../../../../packages/simulation/src/economy-design';
import { equipmentCostFor, freeCash } from '../../../../../packages/simulation/src/design';
import type { ProductId } from '../../../../../packages/simulation/src/model';

// Versão 2: quanto custa e quanto rende abrir cada negócio, com o imóvel livre mais barato que
// comporta uma linha. Lucro é estimativa da calculadora a preços de referência e plena capacidade.
export function BusinessIdeas() {
  const { world, actor, focusMap } = useGame();
  const design = useMemo(() => analyzeDesign().recipes, []);
  const cash = freeCash(world, actor);
  const rows = world.season.config.recipes
    .filter((r) => !r.alternativeOf)
    .flatMap((r) => {
      const line = design.find((d) => d.id === r.id),
        profile = world.season.config.operations.profiles[r.id];
      if (!line || !profile) return [];
      const site = world.properties
        .filter((p) => p.ownerId === null && p.category === r.category && p.area >= profile.areaM2)
        .sort((a, b) => a.price - b.price)[0];
      const herd = (Object.entries(r.requires ?? {}) as [ProductId, number][]).reduce(
        (n, [id, q]) => n + q * world.season.config.basePrices[id],
        0,
      );
      const investment = (site?.price ?? 0) + equipmentCostFor(world, r.category, r.id) + herd;
      return [{ r, line, profile, site, investment, payback: investment / line.profit }];
    })
    .sort((a, b) => a.payback - b.payback);
  return (
    <Panel
      title="Negócios para abrir"
      subtitle="Uma linha de produção: imóvel livre mais barato, equipamento e rebanho. Lucro estimado a preços de referência, com a linha sempre ocupada."
      action={<Badge tone="blue">Caixa livre {cr(cash, 0)}</Badge>}
    >
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Negócio</th>
              <th className="numeric">Investimento</th>
              <th className="numeric">Lucro estimado / dia</th>
              <th className="numeric">Retorno</th>
              <th>Equipe</th>
              <th aria-label="Imóvel" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ r, line, profile, site, investment, payback }) => (
              <tr key={r.id}>
                <td>
                  <div className="table-name">
                    <i className="table-icon">
                      <CategoryIcon category={r.category} />
                    </i>
                    <div>
                      <strong>{line.name}</strong>
                      <small className="block">
                        {site ? `${site.city} — ${site.state}` : 'Nenhum imóvel livre que comporte'}
                      </small>
                    </div>
                  </div>
                </td>
                <td className="numeric">
                  {cr(investment, 0)}
                  {investment > cash && (
                    <small className="block">
                      <Badge tone="gold">acima do caixa</Badge>
                    </small>
                  )}
                </td>
                <td className="numeric positive">{cr(line.profit, 0)}</td>
                <td className="numeric">{num(payback)} dias</td>
                <td>{profile.workers} pessoas</td>
                <td>
                  <button
                    className="secondary"
                    disabled={!site}
                    onClick={() => site && focusMap(site.coordinates, site.id)}
                  >
                    <MapPin size={15} /> Ver imóvel
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
