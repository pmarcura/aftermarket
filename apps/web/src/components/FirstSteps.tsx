import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Circle, Compass } from 'lucide-react';
import { useGame } from '../lib/game';
import { Modal, Progress } from './ui';

// Primeiros passos: cada etapa é conferida no estado do mundo, nunca marcada à mão.
function useSteps() {
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
      text: 'O caminhão leva algumas horas de jogo. Ao chegar, cada produto entra com um preço de referência, que você pode mudar na aba Preços da loja.',
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

export function FirstSteps() {
  const { world, actor } = useGame();
  const steps = useSteps();
  const key = `aftermarket.welcome.${world.season.id}.${actor}`;
  const [open, setOpen] = useState(false);
  // Primeira visita da empresa nesta temporada: abre o guia sozinho, uma vez.
  useEffect(() => {
    try {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, 'seen');
        setOpen(true);
      }
    } catch {
      /* armazenamento indisponível: o guia continua no menu */
    }
  }, [key]);
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length && !open) return null;
  const next = steps.find((s) => !s.done);
  return (
    <>
      <button
        className="first-steps-button"
        onClick={() => setOpen(true)}
        title={`Primeiros passos · ${done} de ${steps.length}`}
      >
        <Compass size={19} />
        <span>
          <strong>Primeiros passos</strong>
          <small>
            {done} de {steps.length} concluídos
          </small>
          <Progress value={(done / steps.length) * 100} />
        </span>
      </button>
      {/* A janela vai para o corpo da página: o menu lateral fica escondido no celular, e um
          diálogo dentro dele abriria invisível e bloquearia a tela. */}
      {open &&
        createPortal(
          <Modal title="Primeiros passos" onClose={() => setOpen(false)}>
            <p>
              Comece pela sua loja: compre mercadoria, venda para as famílias e use o lucro para
              produzir o que as lojas e as fábricas procuram. Os outros jogadores e os bots disputam
              os mesmos clientes e fornecedores.
            </p>
            <ol className="first-steps">
              {steps.map((s) => (
                <li key={s.title} className={s.done ? 'done' : s === next ? 'current' : ''}>
                  <i aria-hidden="true">{s.done ? <Check size={15} /> : <Circle size={15} />}</i>
                  <div>
                    <strong>
                      {s.title}
                      {s.done && <span className="sr-only"> (concluído)</span>}
                    </strong>
                    {s === next && <p>{s.text}</p>}
                    {s === next && s.action && (
                      <button
                        className="primary"
                        onClick={() => {
                          setOpen(false);
                          s.action!.run();
                        }}
                      >
                        {s.action.label}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            {!next && (
              <p>Tudo pronto. Agora é crescer: mais lojas, mais produção, mais caminhões.</p>
            )}
          </Modal>,
          document.body,
        )}
    </>
  );
}
