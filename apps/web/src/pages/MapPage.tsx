import { useMemo, useState } from 'react';
import {
  X,
  Zap,
  Droplets,
  Users,
  Truck,
  ShoppingCart,
  BarChart3,
  Route,
  Building2,
  Check,
  ArrowLeft,
  ArrowUpRight,
} from 'lucide-react';
import { useGame, CategoryIcon, cr, num } from '../lib/game';
import { equipmentCostFor, freeCash } from '../../../../packages/simulation/src/design';
import { WorldMap, defaultLayers, type Layers } from '../components/WorldMap';
import { Badge, PageHeading, Modal } from '../components/ui';
import { PixelArt } from '../components/PixelArt';
import { IconePixel } from '../components/IconePixel';
import { ProdutoArte } from '../features/economy/Vitrine';
import { spriteDoNegocio, type Sprite } from '../design/arte';
import { matizDaCategoria } from '../features/business/producao/pecas';
import {
  categoryInfo,
  products,
  seasonProducts,
  type Category,
  type Property,
} from '../../../../packages/simulation/src/model';
import { hasRoadAccess } from '../../../../packages/simulation/src/road-access';
import { inventoryQuality, openingWorkers } from '../../../../packages/simulation/src/operations';
import {
  laborMarket,
  logisticsQuality,
  utilityTariff,
} from '../../../../packages/simulation/src/metrics';
import { InfrastructureDetails } from '../components/InfrastructureDetails';
import '../design/mapa.css';
import { usePendencias } from '../features/inicio/pendencias';
import { estadoDoNegocio } from '../features/business/BusinessCards';
import { CidadePainel } from '../features/mapa/CidadePainel';
import {
  BarraDeModos,
  LegendaDoModo,
  PainelDeFluxos,
  PainelDeProduto,
  type Modo,
} from '../features/mapa/ModosDoMapa';
import type { OpcoesDeFluxo } from '../features/mapa/fluxos';
import type { ProductId } from '../../../../packages/simulation/src/model';

const spritePorCategoria: Record<Category, Sprite> = {
  retail: 'loja',
  farm: 'lavoura',
  industry: 'siderurgica',
  mine: 'mina',
  warehouse: 'silos',
  logistics: 'caminhao',
};

function accessLabel(property: Property, strict?: boolean) {
  if (hasRoadAccess(property)) return 'Conectado à rodovia';
  if (!strict) return 'Acesso local estimado';
  return property.roadAccess?.status === 'unreachable'
    ? 'Acesso indisponível'
    : 'Verificando acesso';
}

function AccessNotice({ property, strict }: { property: Property; strict?: boolean }) {
  if (!strict || hasRoadAccess(property)) return null;
  return (
    <p className="warning-text small" role="status">
      {property.roadAccess?.status === 'unreachable'
        ? (property.roadAccess.reason ??
          'Não foi encontrado acesso conectado à malha rodoviária. Escolha outro imóvel.')
        : 'A localização está sendo verificada. A compra e os novos transportes ficam disponíveis após confirmar o acesso.'}
    </p>
  );
}

export function MapPage() {
  const { world, actor, selectedId, select, navigate, openBusiness, openMarket, focusMap } =
    useGame();
  // Um modo por vez decide o que o mapa destaca; "Meus negócios" filtra por cima de qualquer modo.
  const [modo, setModo] = useState<Modo>('negocios'),
    [soMeus, setSoMeus] = useState(false),
    [fluxo, setFluxo] = useState<OpcoesDeFluxo>({ sentido: 'todos', produto: null }),
    [produtoDaCidade, setProdutoDaCidade] = useState<ProductId | null>(null);
  const [details, setDetails] = useState(false),
    [cidade, setCidade] = useState<string | null>(null);
  const ownership: '' | 'mine' | 'available' =
    modo === 'terrenos' ? 'available' : soMeus ? 'mine' : '';
  const layers: Layers = {
    ...defaultLayers,
    available: modo !== 'fluxos',
    zoning: modo === 'zonas',
  };
  // Demanda e Preços mostram placas por cidade (o preço precisa de um produto)
  const produtoDoPreco =
    produtoDaCidade ?? (seasonProducts(world).includes('rice') ? 'rice' : seasonProducts(world)[0]);
  const economico =
    modo === 'precos'
      ? { metric: 'price' as const, product: produtoDoPreco }
      : modo === 'demanda'
        ? { metric: 'demand' as const, product: produtoDaCidade ?? undefined }
        : undefined;
  const mudarModo = (m: Modo) => {
    setModo(m);
    if (m === 'terrenos' && p?.ownerId) select(null);
    if ((m === 'demanda' || m === 'precos') && p) select(null);
  };
  const p = world.properties.find((x) => x.id === selectedId),
    e = world.establishments.find((x) => x.propertyId === selectedId);
  const owner = world.companies.find((c) => c.id === p?.ownerId);
  const offers = world.offers.filter((o) => o.establishmentId === e?.id);
  const labor = p ? laborMarket(world, p) : null,
    logistics = p ? logisticsQuality(world, p) : null,
    tariff = p ? utilityTariff(world, p) : null;
  // Spec 008 R1: a mesma lista de pendências do Início e do sino, projetada nos pinos do mapa.
  const pendencias = usePendencias();
  const { alerts, motivos } = useMemo(() => {
    const alerts: Record<string, 'brasa' | 'ouro'> = {},
      motivos: Record<string, string[]> = {};
    for (const x of pendencias) {
      if (!x.negocioId) continue;
      const unidade = world.establishments.find((u) => u.id === x.negocioId);
      if (!unidade) continue;
      const id = unidade.propertyId;
      if (x.tom === 'brasa' || !alerts[id]) alerts[id] = x.tom;
      (motivos[id] ??= []).push(x.titulo);
    }
    return { alerts, motivos };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendencias, world.revision]);
  const hoverCard = (id: string) => {
    const lote = world.properties.find((x) => x.id === id);
    if (!lote) return null;
    const unidade = world.establishments.find((x) => x.propertyId === id);
    const dono = world.companies.find((c) => c.id === lote.ownerId);
    if (!unidade || !dono)
      return { titulo: lote.name, linhas: [`${lote.city} · à venda · ${cr(lote.price)}`] };
    const receita = world.season.config.recipes.find((r) => r.id === unidade.specialization);
    const linhas = [
      `${dono.id === actor ? 'Seu negócio' : dono.name} · ${receita?.name ?? categoryInfo[unidade.category].label}`,
    ];
    if (dono.id === actor) {
      linhas.push(estadoDoNegocio(world, unidade).texto);
      for (const m of motivos[id] ?? []) linhas.push(m);
    } else {
      const vende = world.offers
        .filter((o) => o.establishmentId === unidade.id && (unidade.inventory[o.product] ?? 0) > 0)
        .map((o) => products[o.product].name);
      if (vende.length)
        linhas.push(`Vende ${vende.slice(0, 3).join(', ')}${vende.length > 3 ? '…' : ''}`);
    }
    return { titulo: unidade.name, linhas };
  };
  const sprite: Sprite | undefined = p
    ? e
      ? spriteDoNegocio(e, world)
      : spritePorCategoria[p.category]
    : undefined;

  return (
    <div className="map-page">
      <div className="main-map">
        <WorldMap
          layers={layers}
          onSelect={select}
          ownership={ownership}
          economic={economico}
          fluxos={modo === 'fluxos' ? { ...fluxo, soMeus } : null}
          alerts={alerts}
          hoverCard={hoverCard}
          onCitySelect={(id) => {
            select(null);
            setCidade(id);
          }}
        />
        <div className="map-hud-top">
          <BarraDeModos
            modo={modo}
            aoMudar={mudarModo}
            soMeus={soMeus}
            aoSoMeus={(v) => {
              setSoMeus(v);
              if (v && p && p.ownerId !== actor) select(null);
            }}
          />
        </div>
        {!p && !cidade && modo === 'fluxos' && <PainelDeFluxos opcoes={fluxo} aoMudar={setFluxo} />}
        {!p && !cidade && (modo === 'demanda' || modo === 'precos') && (
          <PainelDeProduto
            modo={modo}
            produto={modo === 'precos' ? produtoDoPreco : produtoDaCidade}
            aoMudar={setProdutoDaCidade}
          />
        )}
        <LegendaDoModo modo={modo} />
      </div>

      {cidade && !p && <CidadePainel regionId={cidade} onClose={() => setCidade(null)} />}
      {p && sprite && (
        <aside
          className="lote-gaveta"
          aria-label="Detalhes do imóvel"
          style={{ ['--h' as string]: matizDaCategoria[p.category] ?? 110 }}
        >
          <header className="lote-hero">
            <div className="lote-hero-arte">
              <PixelArt name={sprite} scale={1} />
            </div>
            <div className="lote-hero-texto">
              <Badge tone={p.ownerId === actor ? 'green' : !p.ownerId ? 'gold' : 'blue'}>
                {categoryInfo[p.category].label}
              </Badge>
              <h2>{p.ownerId ? (e?.name ?? p.name) : `Terreno em ${p.city}`}</h2>
              <p>
                {p.city}, {p.state} · {p.road}
              </p>
            </div>
            <button
              type="button"
              className="lote-fechar"
              aria-label="Fechar detalhes da propriedade"
              onClick={() => select(null)}
            >
              <X size={18} />
            </button>
          </header>

          <section className="lote-dono" aria-label="Titularidade">
            <div>
              <span>Quem manda aqui</span>
              <strong>{owner?.name ?? 'Terreno livre para comprar'}</strong>
            </div>
            <Badge
              tone={
                !owner
                  ? 'gold'
                  : owner.id === actor
                    ? 'green'
                    : owner.id.startsWith('treasury')
                      ? 'gold'
                      : 'blue'
              }
            >
              {!owner
                ? 'À venda'
                : owner.id === actor
                  ? 'Seu negócio'
                  : owner.id === 'treasury'
                    ? 'Obra pública'
                    : 'Concorrente'}
            </Badge>
          </section>

          <div className="lote-numeros">
            <div className="lote-num">
              <span>
                <IconePixel nome="moeda" tamanho={18} />
                {p.ownerId ? 'Valor do imóvel' : 'Preço do terreno'}
              </span>
              <b>{cr(p.price, 0)}</b>
              <small>{cr(p.price / p.area, 2)} por m²</small>
            </div>
            <div className="lote-num area">
              <span>
                <IconePixel nome="predio" tamanho={18} />
                Tamanho do lote
              </span>
              <b>{num(p.area)} m²</b>
              <small>{num(p.area / 10000, 2)} hectares</small>
            </div>
          </div>

          {e && (
            <section className="lote-bloco">
              <h3>
                <span>O que vende aqui</span>
                {e && (
                  <Badge tone={e.enabled ? 'green' : 'muted'}>
                    {e.enabled ? 'Funcionando' : 'Parado'}
                  </Badge>
                )}
              </h3>
              {offers.length ? (
                <div className="lote-ofertas">
                  {offers.map((o) => (
                    <div className="lote-oferta" key={o.id}>
                      <ProdutoArte product={o.product} escala={1} />
                      <div>
                        <strong>{products[o.product].name}</strong>
                        <small>
                          {num(e.inventory[o.product] ?? 0)} {products[o.product].unit} · qualidade{' '}
                          {num(inventoryQuality(e, o.product))}
                        </small>
                      </div>
                      <button
                        className="secondary"
                        disabled={!e.enabled || (e.inventory[o.product] ?? 0) <= 0}
                        onClick={() =>
                          owner?.id === actor
                            ? openBusiness(e.id)
                            : openMarket({ product: o.product, offerId: o.id, supplierId: e.id })
                        }
                      >
                        {cr(o.price)} / {products[o.product].unit}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="small muted">
                  {owner?.id.startsWith('treasury')
                    ? 'Canteiro de obra pública: consome aço entregue pelos editais.'
                    : owner?.id === actor
                      ? 'Nenhum produto anunciado ainda. Abra o negócio para configurar.'
                      : 'Sem mercadoria anunciada para venda neste momento.'}
                </p>
              )}
            </section>
          )}

          <section className="lote-bloco">
            <h3>
              <span>Condições em {p.city}</span>
              <button
                type="button"
                className="text-button"
                title="Centralizar no mapa"
                onClick={() => focusMap(p.coordinates, p.id)}
              >
                Ver de perto <ArrowUpRight size={13} />
              </button>
            </h3>
            <dl className="lote-fatos">
              <div>
                <dt>
                  <Route size={13} /> Estrada
                </dt>
                <dd>{accessLabel(p, world.requireRoadRoutes)}</dd>
              </div>
              <div>
                <dt>
                  <Truck size={13} /> Saída de carga
                </dt>
                <dd>{logistics!.label}</dd>
              </div>
              <div>
                <dt>
                  <Zap size={13} className="gold-text" /> Energia
                </dt>
                <dd>
                  {p.energyConnected === false ? 'Sem rede' : `${cr(tariff!.electricity)} / kWh`}
                </dd>
              </div>
              <div>
                <dt>
                  <Droplets size={13} className="blue-text" /> Água
                </dt>
                <dd>{p.water ? `${cr(tariff!.water)} / m³` : 'Sem rede'}</dd>
              </div>
              <div>
                <dt>
                  <Users size={13} /> Salário na região
                </dt>
                <dd>{cr(labor!.monthlySalary, 0)} / mês</dd>
              </div>
              <div>
                <dt>
                  <CategoryIcon category={p.category} size={13} /> Vocação
                </dt>
                <dd>{categoryInfo[p.category].label}</dd>
              </div>
            </dl>
            <AccessNotice property={p} strict={world.requireRoadRoutes} />
            <button type="button" className="text-button" onClick={() => setDetails(true)}>
              Ver tarifas e detalhes da cidade <ArrowUpRight size={13} />
            </button>
          </section>

          <div className="lote-acoes">
            {!p.ownerId ? (
              <button
                className="primary full"
                disabled={world.requireRoadRoutes && !hasRoadAccess(p)}
                onClick={() => navigate('purchase')}
              >
                <ShoppingCart size={17} /> Comprar terreno · {cr(p.price, 0)}
              </button>
            ) : p.ownerId === actor && e ? (
              <button className="primary full" onClick={() => openBusiness(e.id)}>
                <Building2 size={17} /> Abrir meu negócio
              </button>
            ) : (
              e && (
                <button className="primary full" onClick={() => openMarket({ supplierId: e.id })}>
                  <ShoppingCart size={17} /> Ver mercadorias desta empresa
                </button>
              )
            )}
            <button className="secondary full" onClick={() => navigate('opportunities')}>
              <BarChart3 size={17} /> Ver negócios que dão lucro
            </button>
          </div>
        </aside>
      )}
      {details && p && <InfrastructureDetails property={p} onClose={() => setDetails(false)} />}
    </div>
  );
}

export function PurchasePage() {
  const { world, actor, selectedId, navigate, run, pending, openBusiness } = useGame();
  const p = world.properties.find((x) => x.id === selectedId);
  const [confirm, setConfirm] = useState(false),
    [name, setName] = useState('Nova operação');
  if (!p)
    return (
      <div className="page-body">
        <button className="primary" onClick={() => navigate('map')}>
          Escolher um terreno no mapa
        </button>
      </div>
    );
  const balance = freeCash(world, actor),
    accessBlocked = Boolean(world.requireRoadRoutes && !hasRoadAccess(p));
  const labor = laborMarket(world, p),
    tariff = utilityTariff(world, p);
  const costs = world.season.config.recipes
    .filter((r) => r.category === p.category && !r.alternativeOf)
    .map((r) => equipmentCostFor(world, p.category, r.id));
  const eqLow = costs.length
    ? Math.min(...costs)
    : world.season.config.design.equipmentCost[p.category];
  const eqHigh = costs.length ? Math.max(...costs) : eqLow;
  const faixaEquipamento = eqLow === eqHigh ? cr(eqLow, 0) : `${cr(eqLow, 0)} a ${cr(eqHigh, 0)}`;
  const sobra = balance - p.price;

  return (
    <>
      <PageHeading
        eyebrow={`Mapa › ${p.city}, ${p.state}`}
        title="Comprar terreno"
        description="Confira o valor do lote, quanto vai sobrar no caixa e o que vem depois da compra."
        action={
          <button className="secondary" onClick={() => navigate('map')}>
            <ArrowLeft size={16} /> Voltar ao mapa
          </button>
        }
      />
      <div className="page-body compra-lote">
        <section
          className="compra-lote-hero"
          style={{ ['--h' as string]: matizDaCategoria[p.category] ?? 110 }}
        >
          <div className="compra-lote-arte">
            <PixelArt name={spritePorCategoria[p.category]} scale={1} />
          </div>
          <div className="compra-lote-titulo">
            <Badge tone={p.ownerId ? 'muted' : accessBlocked ? 'gold' : 'green'}>
              {p.ownerId ? 'Já tem dono' : accessBlocked ? 'Acesso em verificação' : 'Disponível'}
            </Badge>
            <h2>
              Terreno para {categoryInfo[p.category].label.toLowerCase()} em {p.city}
            </h2>
            <p>
              {num(p.area)} m² ({num(p.area / 10000, 2)} ha) · Acesso por {p.road}
            </p>
          </div>
          <button
            className="primary"
            disabled={Boolean(p.ownerId) || balance < p.price || accessBlocked}
            onClick={() => {
              setName(`${categoryInfo[p.category].label} ${p.city}`);
              setConfirm(true);
            }}
          >
            <ShoppingCart size={16} /> Comprar por {cr(p.price, 0)}
          </button>
        </section>

        <section className="compra-lote-tres" aria-label="Resumo financeiro da compra">
          <div className="compra-lote-card">
            <span>
              <IconePixel nome="moeda" tamanho={24} /> Pagar agora pelo terreno
            </span>
            <b>{cr(p.price, 0)}</b>
            <small>Transfere o imóvel para a sua empresa na hora.</small>
          </div>
          <div className="compra-lote-card">
            <span>
              <IconePixel nome="engrenagem" tamanho={24} /> Próximo passo: equipamento
            </span>
            <b>{faixaEquipamento}</b>
            <small>Pago por linha quando você instalar o negócio.</small>
          </div>
          <div className={`compra-lote-card ${sobra >= 0 ? 'ok' : 'ruim'}`}>
            <span>
              <IconePixel nome={sobra >= 0 ? 'caixa' : 'alerta'} tamanho={24} /> Seu caixa após a
              compra
            </span>
            <b>{sobra >= 0 ? cr(sobra, 0) : `Faltam ${cr(Math.abs(sobra), 0)}`}</b>
            <small>
              {sobra >= eqLow
                ? 'Sobra caixa para instalar a primeira linha.'
                : sobra >= 0
                  ? 'Atenção: guarde caixa para instalar os equipamentos.'
                  : 'Você precisa de mais caixa livre para comprar este lote.'}
            </small>
          </div>
        </section>

        <div className="compra-lote-corpo">
          <div className="compra-lote-mapa">
            <WorldMap propertyId={p.id} />
          </div>
          <section className="lote-bloco">
            <h3>O que você encontra neste terreno</h3>
            <dl className="lote-fatos">
              <div>
                <dt>Vocação do terreno</dt>
                <dd>{categoryInfo[p.category].label}</dd>
              </div>
              <div>
                <dt>Estrada de acesso</dt>
                <dd>{accessLabel(p, world.requireRoadRoutes)}</dd>
              </div>
              <div>
                <dt>Energia elétrica</dt>
                <dd>
                  {p.energyConnected === false ? 'Sem rede' : `${cr(tariff.electricity)} / kWh`}
                </dd>
              </div>
              <div>
                <dt>Água e esgoto</dt>
                <dd>{p.water ? `${cr(tariff.water)} / m³` : 'Sem abastecimento'}</dd>
              </div>
              <div>
                <dt>Equipe inicial sugerida</dt>
                <dd>{openingWorkers(p.category)} funcionários</dd>
              </div>
              <div>
                <dt>Folha mensal estimada</dt>
                <dd>
                  {cr(
                    labor.monthlySalary *
                      openingWorkers(p.category) *
                      world.season.config.parameters.payrollBurden,
                    0,
                  )}
                </dd>
              </div>
            </dl>
            <AccessNotice property={p} strict={world.requireRoadRoutes} />
            <p className="check-line">
              <Check size={16} /> O terreno abre uma unidade vazia; equipamentos, funcionários e
              estoque são contratados logo em seguida.
            </p>
            <div className="purchase-bottom">
              <button className="secondary" onClick={() => navigate('opportunities')}>
                <BarChart3 size={16} /> Comparar outros negócios
              </button>
              <button
                className="primary"
                disabled={Boolean(p.ownerId) || balance < p.price || accessBlocked}
                onClick={() => {
                  setName(`${categoryInfo[p.category].label} ${p.city}`);
                  setConfirm(true);
                }}
              >
                <ShoppingCart size={16} /> Confirmar compra · {cr(p.price, 0)}
              </button>
            </div>
          </section>
        </div>
      </div>

      {confirm && (
        <Modal title="Dar nome ao novo negócio" onClose={() => setConfirm(false)}>
          <p>
            Você está comprando o terreno em <strong>{p.city}</strong> por{' '}
            <strong>{cr(p.price, 0)}</strong>. Escolha o nome da sua nova unidade:
          </p>
          <label className="field">
            Nome do estabelecimento
            <input
              autoFocus
              value={name}
              maxLength={70}
              onChange={(ev) => setName(ev.target.value)}
            />
          </label>
          <div className="lote-numeros">
            <div className="lote-num">
              <span>Pagamento agora</span>
              <b>{cr(p.price, 0)}</b>
            </div>
            <div className="lote-num area">
              <span>Caixa restante</span>
              <b>{cr(balance - p.price, 0)}</b>
            </div>
          </div>
          <button
            className="primary full"
            disabled={pending || name.trim().length < 3 || accessBlocked || Boolean(p.ownerId)}
            onClick={async () => {
              if (
                await run(
                  { type: 'buyProperty', propertyId: p.id, name },
                  'Propriedade adquirida. Sua nova unidade já está disponível.',
                )
              ) {
                setConfirm(false);
                openBusiness(`e-${p.id}`);
              }
            }}
          >
            {pending ? 'Concluindo…' : `Comprar por ${cr(p.price, 0)}`}
          </button>
        </Modal>
      )}
    </>
  );
}
