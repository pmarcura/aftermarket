import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useGame, num } from '../../lib/game';
import { Modal } from '../../components/ui';
import { IconePixel } from '../../components/IconePixel';
import { ProdutoArte } from '../economy/Vitrine';
import { BotaoProduto } from '../../components/BotaoProduto';
import { SupplyConnection } from './SupplyConnection';
import { products } from '../../../../../packages/simulation/src/model';

/**
 * Rotas entre os meus negócios: quem abastece quem. O detalhe de cada rota (mínimo, alvo, origem)
 * fica na aba Abastecimento do destino; aqui só se vê o mapa das ligações e se cria uma nova.
 */
export function SupplyNetwork() {
  const { world, actor, openBusiness } = useGame();
  const [create, setCreate] = useState(false);
  const [tudo, setTudo] = useState(false);
  const meus = world.establishments.filter((e) => e.companyId === actor);
  const links = meus.flatMap((destination) =>
    (destination.supplyPolicy?.rules ?? [])
      .filter((r) => r.originId)
      .map((rule) => ({
        destination,
        rule,
        origin: world.establishments.find((e) => e.id === rule.originId),
      })),
  );
  if (meus.length < 2 && !links.length) return null;
  const visiveis = tudo ? links : links.slice(0, 4);
  return (
    <section className="neg-bloco" aria-labelledby="neg-rotas">
      <header className="neg-bloco-cab">
        <h2 id="neg-rotas">Rotas entre meus negócios</h2>
        <button type="button" className="secondary" onClick={() => setCreate(true)}>
          Ligar dois negócios
        </button>
      </header>
      {links.length ? (
        <ul className="neg-rotas">
          {visiveis.map(({ origin, destination, rule }) => {
            const ativa =
              destination.supplyPolicy?.enabled && destination.enabled && !destination.mothballed;
            const incoming = world.shipments
              .filter(
                (s) =>
                  s.originId === rule.originId &&
                  s.destinationId === destination.id &&
                  s.product === rule.product &&
                  !s.delivered,
              )
              .reduce((n, s) => n + s.quantity, 0);
            return (
              <li key={`${destination.id}:${rule.product}`} className={ativa ? '' : 'pausada'}>
                <BotaoProduto product={rule.product}>
                  <ProdutoArte product={rule.product} escala={1} />
                </BotaoProduto>
                <div className="neg-rota-caminho">
                  <strong>{origin?.name ?? 'Origem indisponível'}</strong>
                  <ArrowRight size={18} aria-hidden="true" />
                  <strong>{destination.name}</strong>
                </div>
                <small>
                  <BotaoProduto product={rule.product} className="neg-rota-produto">
                    {products[rule.product].name}
                  </BotaoProduto>{' '}
                  ·{' '}
                  {!origin
                    ? 'origem indisponível'
                    : destination.mothballed
                      ? 'destino suspenso'
                      : !destination.enabled
                        ? 'destino pausado'
                        : ativa
                          ? 'ligada'
                          : 'pausada: ligue o abastecimento automático'}
                  {incoming > 0 && (
                    <>
                      {' '}
                      · <IconePixel nome="caminhao" tamanho={16} /> {num(incoming)}{' '}
                      {products[rule.product].unit} a caminho
                    </>
                  )}
                </small>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => openBusiness(destination.id)}
                >
                  Ajustar
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="neg-vazio-mini">
          Ligue uma fazenda, mina ou fábrica a outro negócio seu: a carga sai sozinha quando o
          estoque do destino baixa.
        </p>
      )}
      {links.length > 4 && (
        <button type="button" className="text-button" onClick={() => setTudo(!tudo)}>
          {tudo ? 'Mostrar menos' : `Ver as ${links.length} rotas`}
        </button>
      )}
      {create && (
        <Modal title="Ligar dois negócios" wide formLayout onClose={() => setCreate(false)}>
          <SupplyConnection onSaved={() => setCreate(false)} />
        </Modal>
      )}
    </section>
  );
}
