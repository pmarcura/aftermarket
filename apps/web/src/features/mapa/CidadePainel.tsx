import { X, Store, Tag, Users, ShoppingBasket } from 'lucide-react';
import { useGame, cr, num } from '../../lib/game';
import { Badge } from '../../components/ui';
import { IconePixel } from '../../components/IconePixel';
import { products, type ProductId } from '../../../../../packages/simulation/src/model';
import { householdDemand, regionsOf } from '../../../../../packages/simulation/src/metrics';
import { householdItems } from '../../../../../packages/simulation/src/channels';
import { gameDay } from '../../../../../packages/simulation/src/clock';

/**
 * Spec 008 R2 · painel da cidade: população, procura por produto, quanto é atendida, preço de
 * prateleira, lojas presentes e lotes à venda. Procura atendida vem do histórico de consumo
 * das lojas da cidade no último dia de jogo (informação real do motor); a procura diária é o
 * parâmetro da temporada (população × consumo).
 */
export function CidadePainel({ regionId, onClose }: { regionId: string; onClose: () => void }) {
  const { world, actor, select, focusMap, openMarket, navigate } = useGame();
  const region = regionsOf(world).find((r) => r.id === regionId);
  if (!region) return null;
  const lotes = world.properties.filter((p) => p.city === region.name);
  const unidades = world.establishments.filter((e) => lotes.some((p) => p.id === e.propertyId));
  const lojas = unidades.filter((e) => e.category === 'retail' && e.enabled);
  const lojaIds = new Set(lojas.map((e) => e.id));
  // "Último dia" medido pelo próprio histórico (a amostra mais recente), sem relógio de parede.
  const ultimo = world.consumptionHistory.reduce((n, h) => Math.max(n, h.at), 0);
  const desde = ultimo - gameDay(world);
  const ultimoDia = world.consumptionHistory.filter(
    (h) => h.at > desde && lojaIds.has(h.establishmentId),
  );
  const populacao = world.season.config.population[region.id] ?? 0;
  const linhas = householdItems(world).map((id: ProductId) => {
    const amostras = ultimoDia.filter((h) => h.product === id);
    const desejado = amostras.reduce((n, h) => n + h.desired, 0),
      vendido = amostras.reduce((n, h) => n + h.sold, 0);
    const precos = lojas.map((e) => e.prices[id] ?? 0).filter((p) => p > 0);
    return {
      id,
      procuraDia: householdDemand(world, region.id, id),
      atendida: desejado > 0 ? vendido / desejado : null,
      preco: precos.length ? precos.reduce((n, p) => n + p, 0) / precos.length : null,
    };
  });
  const semDados = ultimoDia.length === 0;
  const aVenda = lotes.filter((p) => !p.ownerId);
  const empresa = (id: string) => world.companies.find((c) => c.id === id)?.name ?? id;
  const verLote = (id: string) => {
    const p = lotes.find((x) => x.id === id)!;
    onClose();
    select(id);
    focusMap(p.coordinates, id);
  };
  return (
    <aside className="lote-gaveta cidade-painel" aria-label={`Cidade de ${region.name}`}>
      <header className="lote-hero" style={{ ['--h' as string]: 200 }}>
        <div className="lote-hero-arte">
          <IconePixel nome="predio" tamanho={40} />
        </div>
        <div className="lote-hero-texto">
          <h2>{region.name}</h2>
          <p>
            {region.state} · <Users size={13} /> {num(populacao)} habitantes
          </p>
        </div>
        <button type="button" className="lote-fechar" aria-label="Fechar cidade" onClick={onClose}>
          <X size={18} />
        </button>
      </header>

      <section className="lote-bloco" aria-label="Procura das famílias">
        <h3>
          <span>
            <ShoppingBasket size={15} /> Procura das famílias por dia
          </span>
          {semDados ? (
            <Badge tone="muted">sem vendas no último dia</Badge>
          ) : (
            <Badge tone="green">último dia de jogo</Badge>
          )}
        </h3>
        <table className="cidade-tabela">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Procura</th>
              <th>Atendida</th>
              <th>Prateleira</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id} data-produto={l.id}>
                <td>{products[l.id].name}</td>
                <td>{num(Math.round(l.procuraDia))}</td>
                <td>
                  {l.atendida === null ? (
                    <span className="apagado">—</span>
                  ) : (
                    <b className={l.atendida < 0.55 ? 'brasa' : ''}>
                      {Math.round(l.atendida * 100)}%
                    </b>
                  )}
                </td>
                <td>{l.preco === null ? <span className="apagado">—</span> : cr(l.preco)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="cidade-nota">
          Procura: parâmetro da temporada (população × consumo). Atendida e prateleira: lojas desta
          cidade, informação real.
        </p>
      </section>

      <section className="lote-bloco" aria-label="Lojas na cidade">
        <h3>
          <span>
            <Store size={15} /> Lojas na cidade
          </span>
          <Badge tone={lojas.length ? 'green' : 'muted'}>{lojas.length}</Badge>
        </h3>
        {lojas.length === 0 ? (
          <p className="cidade-nota">
            Nenhuma loja funcionando aqui. A procura está sem atendimento.
          </p>
        ) : (
          <ul className="cidade-lista">
            {lojas.map((e) => (
              <li key={e.id}>
                <button type="button" className="link" onClick={() => verLote(e.propertyId)}>
                  {e.name}
                </button>
                <small>{e.companyId === actor ? 'sua' : empresa(e.companyId)}</small>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="lote-bloco" aria-label="Lotes à venda">
        <h3>
          <span>
            <Tag size={15} /> Lotes à venda
          </span>
          <Badge tone={aVenda.length ? 'gold' : 'muted'}>{aVenda.length}</Badge>
        </h3>
        {aVenda.length === 0 ? (
          <p className="cidade-nota">Nenhum lote livre nesta cidade.</p>
        ) : (
          <ul className="cidade-lista">
            {aVenda.map((p) => (
              <li key={p.id}>
                <button type="button" className="link" onClick={() => verLote(p.id)}>
                  {p.name}
                </button>
                <small>
                  {num(p.area)} m² · {cr(p.price, 0)}
                </small>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="lote-acoes">
        <button
          type="button"
          className="primary full"
          onClick={() => {
            onClose();
            openMarket({});
          }}
        >
          Ver ofertas no mercado
        </button>
        <button type="button" className="secondary full" onClick={() => navigate('opportunities')}>
          Ver negócios que dão lucro
        </button>
      </div>
    </aside>
  );
}
