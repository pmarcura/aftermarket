import { Settings2 } from 'lucide-react';
import { BotaoProduto } from '../../../components/BotaoProduto';
import { cr, num } from '../../../lib/game';
import { PixelArt } from '../../../components/PixelArt';
import { ProdutoArte } from '../../economy/Vitrine';
import { matizDoProduto, spriteDoNegocio } from '../../../design/arte';
import { useGame } from '../../../lib/game';
import { horasDeJogo } from '../../inicio/tempo';
import {
  products,
  type Establishment,
  type Job,
  type ProductId,
} from '../../../../../../packages/simulation/src/model';
import { Chave, ChipEstado } from './pecas';

/** Um lote em andamento: a saída em destaque, uma barra lisa e quando fica pronto, em horas de jogo. */
function LoteCard({ j, agora }: { j: Job; agora: number }) {
  const { world } = useGame();
  const receita = world.season.config.recipes.find((r) => r.id === j.recipeId)!;
  const saidas = Object.entries(
    j.output ??
      Object.fromEntries(Object.entries(receita.output).map(([id, q]) => [id, q! * j.cycles])),
  ) as [ProductId, number][];
  const [principal] = saidas[0];
  const naFila = agora < j.startedAt;
  const progresso = naFila
    ? 0
    : Math.min(1, (agora - j.startedAt) / Math.max(1, j.finishesAt - j.startedAt));
  const horas = horasDeJogo(j.finishesAt - agora);
  return (
    <li>
      <article className="lote" style={{ ['--h' as string]: matizDoProduto(principal) }}>
        <div className="lote-arte">
          <BotaoProduto product={principal}>
            <ProdutoArte product={principal} escala={2} />
          </BotaoProduto>
        </div>
        <div className="lote-corpo">
          <h4>
            {saidas
              .map(([id, q]) => `${num(q)} ${products[id].unit} de ${products[id].name}`)
              .join(' + ')}
          </h4>
          <p>
            {j.cycles} {j.cycles === 1 ? 'ciclo' : 'ciclos'} de{' '}
            {receita.name.toLocaleLowerCase('pt-BR')}
          </p>
          <div
            className="lote-barra"
            role="progressbar"
            aria-label={`Progresso do lote de ${receita.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progresso * 100)}
          >
            <i style={{ width: `${Math.max(progresso, naFila ? 0 : 0.03) * 100}%` }} />
          </div>
        </div>
        <ChipEstado
          tom={naFila ? 'ceu' : 'lavoura'}
          texto={naFila ? 'Na fila' : horas < 1 ? 'Quase pronto' : `Pronto em ~${num(horas)} h`}
        />
      </article>
    </li>
  );
}

/**
 * O que a unidade está fazendo agora: os lotes andando e a produção automática. A ação de começar
 * um lote novo fica na cabeça da página; aqui só se acompanha.
 */
export function Fila({
  e,
  jobs,
  agora,
  onProduzir,
  podeProduzir,
  onConfigurarAuto,
  onLigarAuto,
}: {
  e: Establishment;
  jobs: Job[];
  agora: number;
  onProduzir: () => void;
  podeProduzir: boolean;
  onConfigurarAuto: () => void;
  onLigarAuto: (ligar: boolean) => void;
}) {
  const { world, pending } = useGame();
  const mina = e.category === 'mine';
  const configurada = e.automationCycles !== undefined;
  return (
    <div className="fila-grade">
      <section className="fila" aria-labelledby="fila-titulo">
        <h2 id="fila-titulo">
          Produzindo agora <span className="prod-conta">{jobs.length}</span>
        </h2>
        {jobs.length ? (
          <ul className="fila-lista">
            {jobs.map((j) => (
              <LoteCard key={j.id} j={j} agora={agora} />
            ))}
          </ul>
        ) : (
          <div className="fila-vazia">
            <div className="fila-vazia-cena">
              <PixelArt name={spriteDoNegocio(e, world)} scale={1} />
            </div>
            <div>
              <strong>A linha está parada.</strong>
              <p>Escolha quantos ciclos fazer: o custo e os insumos são separados na hora.</p>
              <button
                className="secondary"
                disabled={!e.enabled || !podeProduzir}
                onClick={onProduzir}
              >
                Escolher quantos ciclos
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="auto" aria-labelledby="auto-titulo">
        <h2 id="auto-titulo">{mina ? 'Extração passiva' : 'Produção automática'}</h2>
        <div className={`auto-cartao ${e.automation ? 'ligada' : ''}`}>
          <div className="auto-topo">
            <Chave
              ligado={!!e.automation}
              rotulo={mina ? 'Extração passiva' : 'Produção automática'}
              desabilitado={pending || (!e.automation && !configurada)}
              onChange={() => onLigarAuto(!e.automation)}
            />
            <button className="secondary" onClick={onConfigurarAuto}>
              <Settings2 size={16} /> {configurada ? 'Ajustar' : 'Configurar'}
            </button>
          </div>
          <p>
            {e.automation
              ? `${e.automationStatus ?? 'Aguardando a próxima rodada'}. Gasta até ${cr(e.automationDailyBudget ?? 10000000, 0)} por dia de jogo e segue mesmo com a página fechada.`
              : configurada
                ? 'Desligada. Ao ligar, a unidade começa lotes sozinha enquanto houver insumo, caixa e equipe.'
                : 'A unidade começa lotes sozinha enquanto houver insumo, caixa e equipe. Configure para ligar.'}
          </p>
        </div>
      </section>
    </div>
  );
}
