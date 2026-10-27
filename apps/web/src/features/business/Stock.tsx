import { useState } from 'react';
import { TransferStock } from './TransferStock';
import { PackagePlus } from 'lucide-react';
import { useGame, cr, num } from '../../lib/game';
import { Badge, Empty, Progress } from '../../components/ui';
import {
  products,
  type Establishment,
  type ProductId,
} from '../../../../../packages/simulation/src/model';
import { loadOf } from '../../../../../packages/simulation/src/engine';
import { inventoryQuality } from '../../../../../packages/simulation/src/operations';

export function Stock({
  establishment: e,
  inputsOnly = false,
}: {
  establishment: Establishment;
  inputsOnly?: boolean;
}) {
  const { world, openMarket } = useGame();
  const [transfer, setTransfer] = useState<{
    originId?: string;
    destinationId?: string;
    product?: ProductId;
  }>();
  const recipe = world.season.config.recipes.find((r) => r.id === e.specialization);
  const incoming = world.shipments.filter((s) => s.destinationId === e.id && !s.delivered);
  const jobs = world.jobs.filter((j) => j.establishmentId === e.id && !j.completed);
  const ids = [
    ...new Set([
      ...Object.keys(e.inventory),
      ...incoming.map((s) => s.product),
      ...jobs.flatMap((j) => Object.keys(j.output ?? {})),
      ...Object.keys(recipe?.input ?? {}),
    ]),
  ] as ProductId[];
  const visible = inputsOnly ? ids.filter((id) => id in (recipe?.input ?? {})) : ids;
  const current = loadOf(e.inventory);
  const reserved = loadOf(
    Object.fromEntries(
      ids.map((id) => [
        id,
        (e.inventory[id] ?? 0) +
          incoming.filter((s) => s.product === id).reduce((n, s) => n + s.quantity, 0) +
          jobs.reduce((n, j) => n + (j.output?.[id] ?? 0), 0),
      ]),
    ),
  );
  return (
    <>
      <div className="business-section">
        <div className="panel-content">
          <button className="secondary" onClick={() => setTransfer({ destinationId: e.id })}>
            Trazer de outro estoque
          </button>
          <h3>{inputsOnly ? 'Cobertura dos insumos por ciclo' : 'Ocupação física e reservada'}</h3>
          <div className="business-two-col">
            <div>
              <div className="simple-entry">
                <span>Massa física</span>
                <strong>
                  {num(current.mass, 2)} / {num(e.capacityT)} t
                </strong>
              </div>
              <Progress value={(current.mass / e.capacityT) * 100} />
              <small>Com entradas reservadas: {num(reserved.mass, 2)} t</small>
            </div>
            <div>
              <div className="simple-entry">
                <span>Volume físico</span>
                <strong>
                  {num(current.volume, 2)} / {num(e.capacityM3)} m³
                </strong>
              </div>
              <Progress value={(current.volume / e.capacityM3) * 100} color="blue" />
              <small>Com entradas reservadas: {num(reserved.volume, 2)} m³</small>
            </div>
          </div>
        </div>
        {visible.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th className="numeric">Disponível</th>
                  <th className="numeric">A caminho</th>
                  <th className="numeric">Em produção</th>
                  <th>{inputsOnly ? 'Ciclos cobertos' : 'Qualidade'}</th>
                  <th className="numeric">Custo posto / un.</th>
                  <th>Reposição</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((id) => {
                  const q = e.inventory[id] ?? 0,
                    input = recipe?.input[id] ?? 0;
                  return (
                    <tr key={id}>
                      <td>
                        <strong>{products[id].name}</strong>
                        <small className="block">
                          {products[id].unit} · {num(q * products[id].massT, 2)} t
                        </small>
                      </td>
                      <td className="numeric">{num(q)}</td>
                      <td className="numeric">
                        {num(
                          incoming
                            .filter((s) => s.product === id)
                            .reduce((n, s) => n + s.quantity, 0),
                        )}
                      </td>
                      <td className="numeric">
                        {num(jobs.reduce((n, j) => n + (j.output?.[id] ?? 0), 0))}
                      </td>
                      <td>
                        <Badge tone={inputsOnly && input && q < input ? 'gold' : 'blue'}>
                          {inputsOnly
                            ? input
                              ? `${num(Math.floor(q / input))} ciclos`
                              : '—'
                            : `${num(inventoryQuality(e, id))}/100`}
                        </Badge>
                      </td>
                      <td className="numeric">{cr(e.unitCosts[id] ?? 0)}</td>
                      <td>
                        <button
                          className="secondary"
                          onClick={() =>
                            openMarket({
                              product: id,
                              destinationId: e.id,
                              quantity: input ? input * 4 : 200,
                            })
                          }
                        >
                          <PackagePlus size={15} /> Comprar
                        </button>
                        <button
                          className="text-button"
                          disabled={q <= 0}
                          onClick={() => setTransfer({ originId: e.id, product: id })}
                        >
                          Enviar para minha unidade
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Nenhum material disponível"
            description="Escolha um fornecedor para receber mercadorias ou inicie sua primeira extração."
            action={
              <button className="primary" onClick={() => openMarket({ destinationId: e.id })}>
                Consultar fornecedores
              </button>
            }
          />
        )}
        <p className="panel-footnote">
          Custo posto inclui aquisição, frete e processamento. Qualidade é uma média ponderada do
          estoque; entradas em trânsito só podem ser usadas após a entrega.
        </p>
      </div>
      {transfer && <TransferStock {...transfer} onClose={() => setTransfer(undefined)} />}
    </>
  );
}
