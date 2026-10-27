import { useState } from 'react';
import { ArrowRight, Link2 } from 'lucide-react';
import { useGame, num } from '../../lib/game';
import { Panel, Badge, Modal } from '../../components/ui';
import { Pagination, usePagination } from '../../components/Pagination';
import { SupplyConnection } from './SupplyConnection';
import { products } from '../../../../../packages/simulation/src/model';

export function SupplyNetwork() {
  const { world, actor, openBusiness } = useGame();
  const [create, setCreate] = useState(false);
  const links = world.establishments
    .filter((e) => e.companyId === actor)
    .flatMap((destination) =>
      (destination.supplyPolicy?.rules ?? [])
        .filter((r) => r.originId)
        .map((rule) => ({
          destination,
          rule,
          origin: world.establishments.find((e) => e.id === rule.originId),
        })),
    );
  const page = usePagination(
    links,
    ({ origin, destination, rule }) =>
      `${origin?.name ?? ''} ${destination.name} ${products[rule.product].name}`,
    6,
  );
  return (
    <Panel
      title="Minha rede de abastecimento"
      subtitle="Conexões fixas entre suas estruturas; políticas de origem automática continuam na unidade."
      action={
        <button className="secondary" onClick={() => setCreate(true)}>
          <Link2 size={16} /> Conectar estruturas
        </button>
      }
    >
      <div className="panel-content">
        {links.length ? (
          <>
            <Pagination value={page} label="conexões produtivas" />
            <div className="supply-network">
              {page.rows.map(({ origin, destination, rule }) => {
                const incoming = world.shipments
                  .filter(
                    (s) =>
                      s.destinationId === destination.id &&
                      s.product === rule.product &&
                      !s.delivered,
                  )
                  .reduce((n, s) => n + s.quantity, 0);
                const active =
                  destination.supplyPolicy?.enabled &&
                  destination.enabled &&
                  !destination.mothballed;
                return (
                  <article className="fleet-card" key={`${destination.id}:${rule.product}`}>
                    <div className="section-title">
                      <strong>{products[rule.product].name}</strong>
                      <Badge tone={active ? 'green' : 'gold'}>
                        {active ? 'Conexão ativa' : 'Reposição pausada'}
                      </Badge>
                    </div>
                    <div className="connection-path">
                      <strong>{origin?.name ?? 'Origem indisponível'}</strong>
                      <ArrowRight size={18} />
                      <strong>{destination.name}</strong>
                    </div>
                    <p className="small muted">
                      Destino: {num(destination.inventory[rule.product] ?? 0)}{' '}
                      {products[rule.product].unit} · chegando: {num(incoming)} · repor ao atingir{' '}
                      {num(rule.minimum)} → alvo {num(rule.target)}
                    </p>
                    <p className="small muted">
                      {destination.supplyStatus ?? 'Aguardando a próxima avaliação'}
                    </p>
                    <button className="secondary" onClick={() => openBusiness(destination.id)}>
                      Gerenciar destino
                    </button>
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <p className="muted">
            Conecte uma produtora ou estoque a um destino para visualizar aqui os fluxos, mínimos,
            alvos e entregas em andamento.
          </p>
        )}
        {create && (
          <Modal
            title="Conectar estruturas para reposição"
            wide
            formLayout
            onClose={() => setCreate(false)}
          >
            <SupplyConnection onSaved={() => setCreate(false)} />
          </Modal>
        )}
      </div>
    </Panel>
  );
}
