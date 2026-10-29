import { useGame } from '../../lib/game';

// Primeiros passos: cada etapa é conferida no estado do mundo, nunca marcada à mão.
export function usePrimeirosPassos() {
  const { world, actor, openMarket, openBusiness, navigate } = useGame();
  const mine = world.establishments.filter((e) => e.companyId === actor);
  const stores = mine.filter((e) => e.category === 'retail'),
    store = stores[0];
  const producers = mine.filter((e) => ['farm', 'mine', 'industry'].includes(e.category));
  const storeIds = new Set(stores.map((e) => e.id));
  const bought =
    world.orders.some((o) => storeIds.has(o.destinationId)) ||
    world.shipments.some((s) => storeIds.has(s.destinationId));
  const stocked = stores.some((e) => Object.values(e.inventory).some((q) => q > 0));
  const sold =
    (world.view?.totals.retail?.in ?? 0) > 0 ||
    world.ledger.some((l) => l.to === actor && l.kind === 'retail');
  const producing =
    world.jobs.some((j) => producers.some((e) => e.id === j.establishmentId)) ||
    producers.some((e) => e.automation);
  return [
    {
      done: bought || stocked || sold,
      title: 'Compre mercadoria para a loja',
      text: 'No mercado, escolha um produto de um fornecedor, a quantidade e a transportadora. A loja paga a mercadoria e o frete.',
      action: store && {
        label: 'Abrir o mercado',
        run: () => openMarket({ destinationId: store.id }),
      },
    },
    {
      done: stocked || sold,
      title: 'Receba a entrega',
      text: 'O caminhão leva algumas horas de jogo. Ao chegar, cada produto entra com um preço de referência, que você pode mudar na prateleira da loja.',
      action: store && { label: 'Ver minha loja', run: () => openBusiness(store.id) },
    },
    {
      done: sold,
      title: 'Faça a primeira venda',
      text: 'As famílias da cidade compram a cada 2 horas de jogo, escolhendo pelo preço e pela qualidade. Estoque e equipe limitam quanto você vende.',
      action: store && { label: 'Ver vendas da loja', run: () => openBusiness(store.id) },
    },
    {
      done: producers.length > 0,
      title: 'Abra um negócio de produção',
      text: 'Fazenda, mina ou indústria: compre um imóvel no mapa. Oportunidades mostra os produtos com mais procura que oferta.',
      action: { label: 'Ver oportunidades', run: () => navigate('opportunities') },
    },
    {
      done: producing,
      title: 'Coloque a produção para rodar',
      text: 'Instale o equipamento, contrate a equipe e inicie um lote ou a produção automática. Depois venda no mercado ou abasteça a sua loja.',
      action: producers[0] && {
        label: 'Abrir a produção',
        run: () => openBusiness(producers[0].id),
      },
    },
  ];
}
