import { useState } from 'react';
import { BotaoProduto } from '../../components/BotaoProduto';
import { PackagePlus } from 'lucide-react';
import { useGame, cr, num } from '../../lib/game';
import { Empty } from '../../components/ui';
import { IconePixel } from '../../components/IconePixel';
import { matizDoProduto } from '../../design/arte';
import { ProdutoArte } from '../economy/Vitrine';
import { TransferStock } from './TransferStock';
import { ChipEstado, type Tom } from './producao/pecas';
import {
  products,
  type Establishment,
  type ProductId,
} from '../../../../../packages/simulation/src/model';
import { loadOf } from '../../../../../packages/simulation/src/engine';
import { inventoryQuality } from '../../../../../packages/simulation/src/operations';
import '../../design/producao.css';

/** Quanto do armazém está ocupado, numa barra lisa que muda de cor perto do limite. */
function Ocupacao({
  rotulo,
  usado,
  limite,
  reservado,
  unidade,
}: {
  rotulo: string;
  usado: number;
  limite: number;
  reservado: number;
  unidade: string;
}) {
  const f = limite > 0 ? usado / limite : 0;
  const tom: Tom = f > 0.9 ? 'brasa' : f > 0.7 ? 'ouro' : 'lavoura';
  return (
    <div className="est-ocupacao">
      <IconePixel nome="caixa" tamanho={30} />
      <div>
        <span>{rotulo}</span>
        <b>
          {num(usado, 1)} de {num(limite)} {unidade}
        </b>
        <div
          className="item-medidor"
          role="img"
          aria-label={`${rotulo}: ${Math.round(f * 100)}% cheio`}
        >
          <i className={`tom-${tom}`} style={{ width: `${Math.min(1, f) * 100}%` }} />
        </div>
        {reservado > usado + 0.05 && (
          <small>
            Com o que está chegando: {num(reservado, 1)} {unidade}
          </small>
        )}
      </div>
    </div>
  );
}

/**
 * O armazém da unidade: um cartão por material, com o estado em uma palavra e as duas coisas que
 * se faz com ele (mandar buscar mais ou enviar para outra unidade).
 * `inputsOnly` mostra só insumos; `saidasOnly` esconde os insumos (que já aparecem na Produção).
 */
export function Stock({
  establishment: e,
  inputsOnly = false,
  saidasOnly = false,
}: {
  establishment: Establishment;
  inputsOnly?: boolean;
  saidasOnly?: boolean;
}) {
  const { world, openRepor, openMarket } = useGame();
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
      ...Object.keys(recipe?.requires ?? {}),
    ]),
  ] as ProductId[];
  const ehInsumo = (id: ProductId) => id in (recipe?.input ?? {}) || id in (recipe?.requires ?? {});
  const visivel = inputsOnly
    ? ids.filter(ehInsumo)
    : saidasOnly
      ? ids.filter((id) => !ehInsumo(id) || (recipe?.output[id] ?? 0) > 0)
      : ids;
  const atual = loadOf(e.inventory);
  const reservado = loadOf(
    Object.fromEntries(
      ids.map((id) => [
        id,
        (e.inventory[id] ?? 0) +
          incoming.filter((s) => s.product === id).reduce((n, s) => n + s.quantity, 0) +
          jobs.reduce((n, j) => n + (j.output?.[id] ?? 0), 0),
      ]),
    ),
  );
  const outras = world.establishments.filter((x) => x.companyId === e.companyId && x.id !== e.id);
  return (
    <section className="est" aria-label="Armazém">
      <div className="est-ocupacoes">
        <Ocupacao
          rotulo="Peso no armazém"
          usado={atual.mass}
          limite={e.capacityT}
          reservado={reservado.mass}
          unidade="t"
        />
        <Ocupacao
          rotulo="Espaço no armazém"
          usado={atual.volume}
          limite={e.capacityM3}
          reservado={reservado.volume}
          unidade="m³"
        />
      </div>
      {visivel.length ? (
        <ul className="est-lista">
          {visivel.map((id) => {
            const q = e.inventory[id] ?? 0;
            const entrada = recipe?.input[id] ?? 0;
            const rebanho = (recipe?.requires?.[id] ?? 0) * (e.equipmentLines ?? 1);
            const semente = entrada > 0 && (recipe?.output[id] ?? 0) > 0;
            const aCaminho = incoming
              .filter((s) => s.product === id)
              .reduce((n, s) => n + s.quantity, 0);
            const emProducao = jobs.reduce((n, j) => n + (j.output?.[id] ?? 0), 0);
            const ciclos = entrada ? Math.floor(q / entrada) : 0;
            const estado: { tom: Tom; texto: string; cheio?: number } = rebanho
              ? q >= rebanho
                ? { tom: 'lavoura', texto: 'Rebanho completo', cheio: 1 }
                : { tom: 'brasa', texto: `Faltam ${num(rebanho - q)} cabeças`, cheio: q / rebanho }
              : entrada
                ? {
                    tom: ciclos < 1 ? 'brasa' : ciclos < 3 ? 'ouro' : 'lavoura',
                    texto:
                      ciclos < 1
                        ? 'Não cobre um ciclo'
                        : `Cobre ${num(ciclos)} ${ciclos === 1 ? 'ciclo' : 'ciclos'}`,
                    cheio: Math.min(1, ciclos / 6),
                  }
                : q > 0
                  ? { tom: 'lavoura', texto: 'Em estoque' }
                  : { tom: 'apagado', texto: 'Vazio' };
            return (
              <li key={id}>
                <article
                  className="item item-compacto"
                  style={{ ['--h' as string]: matizDoProduto(id) }}
                >
                  <header className="item-hero">
                    <div className="item-arte">
                      <BotaoProduto product={id}>
                        <ProdutoArte product={id} escala={2} />
                      </BotaoProduto>
                    </div>
                    <div className="item-ident">
                      <h3>
                        <BotaoProduto product={id}>{products[id].name}</BotaoProduto>
                      </h3>
                      <ChipEstado {...estado} />
                      <dl className="item-fatos">
                        <div>
                          <IconePixel nome="caixa" tamanho={22} />
                          <dt>No armazém</dt>
                          <dd>
                            {num(q, 1)} {products[id].unit}
                          </dd>
                        </div>
                        {aCaminho > 0 && (
                          <div>
                            <IconePixel nome="caminhao" tamanho={22} />
                            <dt>A caminho</dt>
                            <dd>{num(aCaminho)}</dd>
                          </div>
                        )}
                        {emProducao > 0 && (
                          <div>
                            <IconePixel nome="engrenagem" tamanho={22} />
                            <dt>Em produção</dt>
                            <dd>{num(emProducao)}</dd>
                          </div>
                        )}
                        {!ehInsumo(id) && q > 0 && (
                          <div>
                            <dt>Qualidade</dt>
                            <dd>{num(inventoryQuality(e, id))}</dd>
                          </div>
                        )}
                        {(e.unitCosts[id] ?? 0) > 0 && (
                          <div>
                            <IconePixel nome="custo" tamanho={22} />
                            <dt>Custo posto</dt>
                            <dd>{cr(e.unitCosts[id] ?? 0)}</dd>
                          </div>
                        )}
                      </dl>
                      {(rebanho > 0 || semente) && (
                        <p className="est-nota">
                          {rebanho > 0
                            ? 'O rebanho fica na linha e não é consumido.'
                            : 'A colheita devolve a semente.'}
                        </p>
                      )}
                    </div>
                    <div className="est-acoes">
                      <button
                        className={estado.tom === 'brasa' ? 'primary' : 'secondary'}
                        onClick={() => openRepor({ destinationId: e.id, product: id })}
                      >
                        <PackagePlus size={16} /> Mandar buscar
                      </button>
                      {outras.length > 0 && (
                        <button
                          className="text-button"
                          disabled={q <= 0}
                          onClick={() => setTransfer({ originId: e.id, product: id })}
                        >
                          Enviar para outra unidade
                        </button>
                      )}
                    </div>
                  </header>
                </article>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty
          title={saidasOnly ? 'Nada produzido ainda' : 'Nenhum material no armazém'}
          description={
            saidasOnly
              ? 'O que a unidade produzir aparece aqui, pronto para vender.'
              : 'Mande buscar o primeiro material ou comece uma produção.'
          }
          action={
            saidasOnly ? undefined : (
              <button className="primary" onClick={() => openMarket({ destinationId: e.id })}>
                Ver o mercado
              </button>
            )
          }
        />
      )}
      {outras.length > 0 && !saidasOnly && (
        <button className="text-button" onClick={() => setTransfer({ destinationId: e.id })}>
          Trazer de outra unidade
        </button>
      )}
      {transfer && <TransferStock {...transfer} onClose={() => setTransfer(undefined)} />}
    </section>
  );
}
