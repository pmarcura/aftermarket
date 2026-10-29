import { ArrowRight, ShoppingCart } from 'lucide-react';
import { BotaoProduto } from '../../../components/BotaoProduto';
import { useGame, num } from '../../../lib/game';
import { IconePixel } from '../../../components/IconePixel';
import { PixelArt } from '../../../components/PixelArt';
import { ProdutoArte } from '../../economy/Vitrine';
import { matizDoProduto, spriteDoNegocio } from '../../../design/arte';
import {
  products,
  TIME_SCALE,
  type Establishment,
  type ProductId,
  type Recipe,
} from '../../../../../../packages/simulation/src/model';
import {
  productionQuality,
  type productionCapacity,
} from '../../../../../../packages/simulation/src/operations';
import { ChipEstado, matizDaCategoria, type Tom } from './pecas';

type Capacidade = ReturnType<typeof productionCapacity>;

const dosIds = (o: Partial<Record<ProductId, number>>) =>
  Object.entries(o) as [ProductId, number][];

/**
 * Como a unidade produz, de relance: o que entra (cada insumo com a sua situação e o botão de
 * mandar buscar), a máquina no meio e o que sai.
 */
export function Fluxo({
  e,
  receita,
  receitas,
  onReceita,
  linha,
  onEquipe,
}: {
  e: Establishment;
  receita: Recipe;
  receitas: Recipe[];
  onReceita: (id: string) => void;
  linha: Capacidade | null;
  onEquipe: () => void;
}) {
  const { world, openRepor } = useGame();
  const linhas = e.equipmentLines ?? 1;
  const horas = (receita.duration * TIME_SCALE) / 3600000;
  const entradas = dosIds(receita.input);
  const rebanho = dosIds(receita.requires ?? {});
  const saidas = dosIds(receita.output);
  const mina = e.category === 'mine';
  return (
    <section className="fluxo" aria-labelledby="fluxo-titulo">
      <div className="fluxo-cab">
        <h2 id="fluxo-titulo">Como esta unidade produz</h2>
        {receitas.length > 1 && (
          <div className="fluxo-receitas" role="radiogroup" aria-label="O que produzir">
            {receitas.map((r) => (
              <button
                key={r.id}
                role="radio"
                aria-checked={r.id === receita.id}
                className={r.id === receita.id ? 'on' : ''}
                onClick={() => onReceita(r.id)}
              >
                {r.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="fluxo-grade">
        <div className="fluxo-col">
          <h3>Entra</h3>
          {mina && entradas.length === 0 && (
            <article className="pcard" style={{ ['--h' as string]: matizDaCategoria.mine }}>
              <div className="pcard-arte">
                <IconePixel nome="caixa" tamanho={56} />
              </div>
              <div className="pcard-corpo">
                <h4>Reserva da mina</h4>
                <p>Tudo o que ainda pode ser extraído.</p>
                <ChipEstado
                  tom={(e.reserve ?? 0) > 0 ? 'lavoura' : 'brasa'}
                  texto={`${num(e.reserve ?? 0)} t sob a terra`}
                />
              </div>
            </article>
          )}
          {entradas.map(([id, q]) => {
            const tem = e.inventory[id] ?? 0;
            const ciclos = Math.floor(tem / q);
            const tom: Tom = ciclos < 1 ? 'brasa' : ciclos < 3 ? 'ouro' : 'lavoura';
            return (
              <article key={id} className="pcard" style={{ ['--h' as string]: matizDoProduto(id) }}>
                <div className="pcard-arte">
                  <BotaoProduto product={id}>
                    <ProdutoArte product={id} escala={2} />
                  </BotaoProduto>
                </div>
                <div className="pcard-corpo">
                  <h4>
                    <BotaoProduto product={id}>{products[id].name}</BotaoProduto>
                  </h4>
                  <p>
                    Gasta {num(q, 2)} {products[id].unit} por ciclo
                  </p>
                  <ChipEstado
                    tom={tom}
                    texto={
                      ciclos < 1
                        ? 'Não cobre um ciclo'
                        : `Cobre ${num(ciclos)} ${ciclos === 1 ? 'ciclo' : 'ciclos'}`
                    }
                    cheio={Math.min(1, ciclos / 6)}
                  />
                  <small>
                    No armazém: {num(tem, 1)} {products[id].unit}
                  </small>
                </div>
                <button
                  className={`pcard-acao ${tom === 'brasa' ? 'primary' : 'secondary'}`}
                  onClick={() => openRepor({ destinationId: e.id, product: id })}
                >
                  <ShoppingCart size={16} /> Mandar buscar
                </button>
              </article>
            );
          })}
          {rebanho.map(([id, q]) => {
            const precisa = q * linhas;
            const tem = e.inventory[id] ?? 0;
            const ok = tem >= precisa;
            return (
              <article key={id} className="pcard" style={{ ['--h' as string]: matizDoProduto(id) }}>
                <div className="pcard-arte">
                  <BotaoProduto product={id}>
                    <ProdutoArte product={id} escala={2} />
                  </BotaoProduto>
                </div>
                <div className="pcard-corpo">
                  <h4>
                    <BotaoProduto product={id}>{products[id].name}</BotaoProduto>
                  </h4>
                  <p>Precisa de {num(precisa)} na linha. Fica lá e não é consumido.</p>
                  <ChipEstado
                    tom={ok ? 'lavoura' : 'brasa'}
                    texto={ok ? 'Rebanho completo' : `Faltam ${num(precisa - tem)}`}
                    cheio={precisa ? tem / precisa : 1}
                  />
                  <small>Você tem {num(tem)}</small>
                </div>
                <button
                  className={`pcard-acao ${ok ? 'secondary' : 'primary'}`}
                  onClick={() => openRepor({ destinationId: e.id, product: id })}
                >
                  <ShoppingCart size={16} /> Mandar buscar
                </button>
              </article>
            );
          })}
        </div>

        <div className="fluxo-seta" aria-hidden="true">
          <ArrowRight size={34} />
        </div>

        <article
          className="fluxo-maquina"
          style={{ ['--h' as string]: matizDaCategoria[e.category] ?? 120 }}
        >
          <div className="fluxo-maquina-cena">
            <PixelArt name={spriteDoNegocio(e, world)} scale={1} />
          </div>
          <h4>
            {linhas} {linhas === 1 ? 'linha' : 'linhas'} de produção
          </h4>
          <ul>
            <li>
              <IconePixel nome="prazo" tamanho={24} />
              <span>
                Cada ciclo leva <b>{num(horas, 1)} h</b> de jogo
              </span>
            </li>
            <li>
              <IconePixel nome="energia" tamanho={24} />
              <span>
                Gasta <b>{num(receita.energyKwh)} kWh</b> por ciclo
              </span>
            </li>
            <li>
              <IconePixel nome="agua" tamanho={24} />
              <span>
                Gasta <b>{num(receita.waterM3, 1)} m³</b> de água por ciclo
              </span>
            </li>
            {linha && (
              <li>
                <IconePixel nome="engrenagem" tamanho={24} />
                <span>
                  Cada linha usa <b>{num(linha.workers)} pessoas</b> e {num(linha.areaM2)} m²
                </span>
              </li>
            )}
          </ul>
          {linha && linha.lines === 0 ? (
            <p className="fluxo-alerta">
              {linha.bottleneck}.
              {linha.bottleneck === 'Equipe insuficiente' && (
                <button className="secondary" onClick={onEquipe}>
                  Ajustar a equipe
                </button>
              )}
            </p>
          ) : (
            <button className="text-button" onClick={onEquipe}>
              Ver a equipe
            </button>
          )}
        </article>

        <div className="fluxo-seta" aria-hidden="true">
          <ArrowRight size={34} />
        </div>

        <div className="fluxo-col">
          <h3>Sai</h3>
          {saidas.map(([id, q]) => (
            <article
              key={id}
              className="pcard saida"
              style={{ ['--h' as string]: matizDoProduto(id) }}
            >
              <div className="pcard-arte">
                <BotaoProduto product={id}>
                  <ProdutoArte product={id} escala={2} />
                </BotaoProduto>
              </div>
              <div className="pcard-corpo">
                <h4>
                  <BotaoProduto product={id}>{products[id].name}</BotaoProduto>
                </h4>
                <p>
                  Sai{' '}
                  <b>
                    {num(q, 2)} {products[id].unit}
                  </b>{' '}
                  por ciclo
                </p>
                <ChipEstado
                  tom="ceu"
                  texto={`Qualidade ${num(productionQuality(world, e, receita))}`}
                />
                <small>
                  No armazém: {num(e.inventory[id] ?? 0, 1)} {products[id].unit}
                </small>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
