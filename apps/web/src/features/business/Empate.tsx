import { ShoppingCart } from 'lucide-react';
import { useGame, cr, num, ProductIcon } from '../../lib/game';
import { Placa } from '../../components/Livro';
import { IconePixel } from '../../components/IconePixel';
import { products, type Establishment } from '../../../../../packages/simulation/src/model';
import { householdItems } from '../../../../../packages/simulation/src/channels';
import { seasonPrice } from '../../../../../packages/simulation/src/metrics';
import { avaliar, procuraDiaria, quantidadeSugerida } from '../economy/compra';
import { contaDaPrateleira } from './precificacao';

/**
 * Cabeçalho da loja: a peça, quem ela é e a conta do dia. Margem estimada da prateleira (com a
 * concorrência da cidade, a mesma conta da Prateleira) contra o custo de manter as portas abertas.
 */
export function LojaCabecalho({ loja }: { loja: Establishment }) {
  const { world, actor, openMarket, openBusiness } = useGame();
  const p = world.properties.find((x) => x.id === loja.propertyId)!;
  const fixo = loja.dailyCost;
  // Mesma conta da prateleira e do Início.
  const ganho = contaDaPrateleira(world, loja).agora;
  const aCaminho = new Set(
    world.shipments
      .filter((s) => s.destinationId === loja.id && !s.delivered)
      .map((s) => s.product),
  );
  const saldo = ganho - fixo;
  // Só quando falta: os produtos que a loja não vende e mais ajudam, com a melhor oferta na porta.
  const ideias =
    saldo >= 0
      ? []
      : householdItems(world)
          .filter((id) => !((loja.inventory[id] ?? 0) > 0) && !aCaminho.has(id))
          .map((id) => {
            const a = world.offers
              .filter((o) => o.product === id)
              .map((o) => {
                const vendedor = world.establishments.find((e) => e.id === o.establishmentId)!;
                const q = quantidadeSugerida(world, loja, id, vendedor.inventory[id] ?? 0);
                return q > 0 ? avaliar(world, actor, o, loja, q) : undefined;
              })
              .filter((x) => x?.frete)
              .sort((x, y) => x!.naPorta - y!.naPorta)[0];
            const porDia = a
              ? procuraDiaria(world, loja, id) * (seasonPrice(world, id) - a.naPorta)
              : 0;
            return { id, porDia };
          })
          .filter((x) => x.porDia > 0)
          .sort((a, b) => b.porDia - a.porDia)
          .slice(0, 3);
  // Barra lisa: preenche com a margem; o traço marca o custo fixo (o ponto de empate).
  const escala = Math.max(fixo * 1.6, ganho * 1.05, 1);
  const cheio = Math.min(100, (Math.max(0, ganho) / escala) * 100);
  const empate = (fixo / escala) * 100;
  const outras = world.establishments.filter(
    (x) => x.companyId === actor && x.category === 'retail',
  );
  return (
    <header className="lojah2">
      <div className="lojah2-topo">
        <Placa
          titulo={loja.name}
          sub={`${p.city}, ${p.state} · ${loja.enabled ? 'portas abertas' : 'pausada'} · ${num(loja.employees)} ${loja.employees === 1 ? 'funcionário' : 'funcionários'}`}
        />
        <div className="lojah2-acoes">
          <button className="primary" onClick={() => openMarket({ destinationId: loja.id })}>
            <ShoppingCart size={18} /> Comprar mercadorias
          </button>
          {outras.length > 1 && (
            <select
              aria-label="Trocar de loja"
              value={loja.id}
              onChange={(ev) => openBusiness(ev.target.value)}
            >
              {outras.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      <div className="lojah2-painel">
        <article className="lv-nota">
          <span className="lv-etiqueta lv-rotulo">Margem do dia</span>
          <div className="lojah2-valor">
            <b className="lv-numero">{cr(ganho, 0)}</b>
            <span className="lv-rotulo">por dia</span>
          </div>
          <div className="lv-mao">{saldo >= 0 ? 'sobra bem!' : 'não cobre o custo...'}</div>
          <div
            className="lojah2-escala"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={Math.round(escala)}
            aria-valuenow={Math.round(Math.max(0, ganho))}
            aria-label="Margem por dia comparada ao custo de manter a loja"
          >
            <i style={{ left: `${Math.min(96, Math.max(2, cheio))}%` }} />
            <span className="lojah2-empate" style={{ left: `${empate}%` }} />
          </div>
          <div className="lojah2-legenda lv-rotulo">
            <span>prejuízo</span>
            <span>empate</span>
            <span>ótimo</span>
          </div>
          <hr />
          <p>
            Estimativa com os preços de agora. Para empatar a loja precisa render{' '}
            <b>{cr(fixo, 0)}</b> por dia.
          </p>
        </article>
        <div className="lojah2-pecas">
          <div className="lv-peca">
            <span className="lv-rotulo">Para manter as portas</span>
            <b className="lv-numero">{cr(fixo, 0)}</b>
            <small>custo fixo por dia</small>
          </div>
          <div className="lv-peca">
            <span className="lv-rotulo">{saldo >= 0 ? 'Sobra por dia' : 'Falta por dia'}</span>
            <b className={`lv-numero ${saldo >= 0 ? 'bom' : 'ruim'}`}>
              {saldo >= 0 ? '+' : '−'}
              {cr(Math.abs(saldo), 0)}
            </b>
            <small>{saldo >= 0 ? 'depois dos custos' : 'para chegar ao empate'}</small>
          </div>
          {aCaminho.size > 0 && (
            <div className="lv-peca lojah2-caminho">
              <IconePixel nome="caminhao" tamanho={34} />
              <span>
                <b>
                  {aCaminho.size} {aCaminho.size === 1 ? 'carga' : 'cargas'}
                </b>{' '}
                a caminho. Ainda não entram na conta.
              </span>
            </div>
          )}
        </div>
      </div>
      {ideias.length > 0 && (
        <div className="lojah2-ideias">
          <span className="lv-mao">Para empatar, venda também:</span>
          {ideias.map(({ id, porDia }) => (
            <button
              key={id}
              className="secondary"
              onClick={() => openMarket({ destinationId: loja.id, product: id })}
            >
              <ProductIcon product={id} /> {products[id].name}
              <b>+{cr(porDia, 0)}/dia</b>
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
