import { useMemo, useState } from 'react';
import { useGame, cr } from '../../lib/game';
import { PageHeading, Empty } from '../../components/ui';
import { SecaoAbas } from '../../components/SecaoAbas';
import { IconePixel } from '../../components/IconePixel';
import { PixelArt } from '../../components/PixelArt';
import { spriteDoNegocio } from '../../design/arte';
import { ListaOfertas } from '../mercado/ListaOfertas';
import { contaDaPrateleira } from '../business/precificacao';
import { Vitrine } from './Vitrine';
import { avaliar, quantidadeParaDestino, type Avaliacao } from './compra';
import { householdItems } from '../../../../../packages/simulation/src/channels';
import { freeCash } from '../../../../../packages/simulation/src/design';
import '../../economy.css';
import '../../design/comprar.css';

/**
 * Comprar mercadorias, como uma loja de jogo: escolhe-se para onde vai a carga e o cartão de cada
 * produto traz a melhor oferta já com frete. A compra acontece na gaveta Mandar buscar; quem quer
 * escolher a empresa na mão abre a lista de todas as ofertas.
 */
export function MarketPage() {
  const { world, actor, intent, navigate, openRepor } = useGame();
  const meus = world.establishments.filter((e) => e.companyId === actor);
  const [destinationId, setDestination] = useState(
    intent.destinationId ?? meus.find((e) => e.category === 'retail')?.id ?? meus[0]?.id ?? '',
  );
  const [supplierId, setSupplier] = useState(intent.supplierId ?? '');
  const [todos, setTodos] = useState(false);
  const destination = meus.find((e) => e.id === destinationId);
  const caixa = freeCash(world, actor);

  // Com destino escolhido, o mercado mostra primeiro o que ele usa: a loja, o que as famílias
  // compram; a produção, os insumos e o rebanho da receita.
  const recipe = world.season.config.recipes.find((r) => r.id === destination?.specialization);
  const relevantes: Set<string> | undefined =
    destination?.category === 'retail'
      ? new Set(householdItems(world))
      : recipe
        ? new Set([...Object.keys(recipe.input), ...Object.keys(recipe.requires ?? {})])
        : undefined;

  const ofertas = world.offers.filter((o) => {
    const e = world.establishments.find((x) => x.id === o.establishmentId);
    return !!e && e.enabled && e.id !== destinationId && (!supplierId || e.id === supplierId);
  });
  const doDestino =
    todos || !relevantes ? ofertas : ofertas.filter((o) => relevantes.has(o.product));

  const avaliacoes = useMemo(() => {
    const m = new Map<string, Avaliacao>();
    if (!destination) return m;
    for (const o of doDestino) {
      const e = world.establishments.find((x) => x.id === o.establishmentId)!;
      const estoque = e.inventory[o.product] ?? 0;
      if (estoque <= 0) continue;
      const q = quantidadeParaDestino(world, destination, o.product, estoque);
      const a = q > 0 ? avaliar(world, actor, o, destination, q) : undefined;
      if (a) m.set(o.id, a);
    }
    return m;
    // O mundo muda por revisão; o resto são as escolhas do jogador.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world.revision, destinationId, todos, supplierId]);

  // O destino mostra quantos produtos estão acabando, para o jogador escolher onde mais falta.
  const acabando = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of meus)
      if (e.category === 'retail')
        m.set(e.id, contaDaPrateleira(world, e).itens.filter((x) => x.dias < 3).length);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world.revision, actor]);

  return (
    <>
      <SecaoAbas secao="comercio" />
      <PageHeading
        title="Comprar mercadorias"
        description="Escolha para onde vai a carga e o que buscar. O preço de cada cartão já vem com o frete."
      />
      <div className="page-body comprar">
        {!meus.length ? (
          <Empty
            title="Escolha um imóvel para receber mercadorias"
            description="Sua empresa precisa de um destino com estoque para concluir uma compra."
            action={
              <button className="primary" onClick={() => navigate('map')}>
                Explorar propriedades
              </button>
            }
          />
        ) : (
          <>
            <section className="comprar-bloco" aria-labelledby="comprar-destino">
              <h2 id="comprar-destino">Para onde vai a carga?</h2>
              <div className="destinos" role="radiogroup" aria-label="Destino da carga">
                {meus.map((e) => {
                  const p = world.properties.find((x) => x.id === e.propertyId)!;
                  const faltam = acabando.get(e.id);
                  const sel = e.id === destinationId;
                  return (
                    <button
                      key={e.id}
                      role="radio"
                      aria-checked={sel}
                      className={`destino ${sel ? 'on' : ''}`}
                      onClick={() => setDestination(e.id)}
                    >
                      <span className="destino-arte">
                        <PixelArt name={spriteDoNegocio(e, world)} scale={1} />
                      </span>
                      <span className="destino-nome">
                        <b>{e.name}</b>
                        <small>
                          <IconePixel nome="mapa" tamanho={18} /> {p.city}, {p.state}
                        </small>
                      </span>
                      {faltam !== undefined && (
                        <span className={`destino-estado ${faltam ? 'tom-brasa' : 'tom-lavoura'}`}>
                          {faltam
                            ? `${faltam} ${faltam === 1 ? 'produto acabando' : 'produtos acabando'}`
                            : 'Estoque em dia'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="comprar-caixa">
                <IconePixel nome="moeda" tamanho={22} /> Caixa livre: <b>{cr(caixa, 0)}</b>
              </p>
            </section>

            {supplierId && (
              <p className="comprar-fornecedor">
                Mostrando só as ofertas de{' '}
                <b>{world.establishments.find((e) => e.id === supplierId)?.name}</b>.{' '}
                <button className="text-button" onClick={() => setSupplier('')}>
                  Ver todos os fornecedores
                </button>
              </p>
            )}

            {destination && (
              <section className="comprar-bloco" aria-labelledby="comprar-loja">
                <div className="comprar-titulo">
                  <h2 id="comprar-loja">O que buscar</h2>
                  {relevantes && (
                    <button className="text-button" onClick={() => setTodos(!todos)}>
                      {todos ? 'Só o que este destino usa' : 'Mostrar todos os produtos'}
                    </button>
                  )}
                </div>
                <Vitrine
                  destino={destination}
                  ofertas={doDestino}
                  avaliacoes={avaliacoes}
                  relevantes={todos ? undefined : relevantes}
                  foco={intent.product}
                  onMandar={(product) => openRepor({ destinationId: destination.id, product })}
                  onProduzir={() => navigate('opportunities')}
                />
                <ListaOfertas destino={destination} ofertas={ofertas} relevantes={relevantes} />
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
