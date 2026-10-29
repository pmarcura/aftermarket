import type { Establishment, Recipe, Job } from '../../../../../../packages/simulation/src/model';
import { horasDeJogo } from '../../inicio/tempo';
import { num } from '../../../lib/game';

export type Tom = 'lavoura' | 'ouro' | 'brasa' | 'ceu' | 'apagado';

/** Estado de uma coisa numa palavra, com um medidor liso opcional (0 a 1). */
export function ChipEstado({ tom, texto, cheio }: { tom: Tom; texto: string; cheio?: number }) {
  return (
    <>
      <span className={`item-estado tom-${tom}`}>{texto}</span>
      {cheio !== undefined && (
        <div className="item-medidor" role="img" aria-label={texto}>
          <i
            className={`tom-${tom}`}
            style={{ width: `${Math.max(0, Math.min(1, cheio)) * 100}%` }}
          />
        </div>
      )}
    </>
  );
}

/** Interruptor liso: o estado também aparece em texto. */
export function Chave({
  ligado,
  onChange,
  rotulo,
  desabilitado,
}: {
  ligado: boolean;
  onChange: () => void;
  rotulo: string;
  desabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      disabled={desabilitado}
      className={`prod-chave ${ligado ? 'ligado' : ''}`}
      onClick={onChange}
    >
      <i aria-hidden="true" />
      <span>{ligado ? 'Ligada' : 'Desligada'}</span>
    </button>
  );
}

/** Matiz do fundo de cada tipo de unidade (só decoração; o significado vem do texto). */
export const matizDaCategoria: Record<string, number> = {
  farm: 105,
  industry: 210,
  mine: 28,
  warehouse: 285,
  retail: 8,
  logistics: 200,
};

export interface EstadoUnidade {
  tom: Tom;
  texto: string;
  detalhe?: string;
  /** O que falta, quando a unidade está parada por falta de insumo ou rebanho. */
  falta?: string;
}

/** Em que pé a unidade está: produzindo, parada por falta de algo, pausada ou pronta. */
export function estadoDaUnidade(
  e: Establishment,
  recipe: Recipe | undefined,
  jobs: Job[],
  agora: number,
  nomes: (id: string) => string,
): EstadoUnidade {
  if (e.mothballed)
    return { tom: 'ouro', texto: 'Suspensa', detalhe: 'A estrutura está guardada.' };
  if (!e.enabled) return { tom: 'ouro', texto: 'Pausada', detalhe: 'Não começa novos ciclos.' };
  const andando = jobs.filter((j) => agora >= j.startedAt);
  if (andando.length) {
    const horas = Math.max(1, horasDeJogo(Math.min(...andando.map((j) => j.finishesAt)) - agora));
    return {
      tom: 'lavoura',
      texto: 'Produzindo',
      detalhe: `Primeiro lote pronto em ~${num(horas)} h`,
    };
  }
  if (jobs.length) return { tom: 'ceu', texto: 'Na fila', detalhe: 'Os lotes começam já.' };
  if (recipe) {
    const insumo = Object.entries(recipe.input).find(
      ([id, q]) => (e.inventory[id as never] ?? 0) < (q ?? 0),
    );
    if (insumo)
      return {
        tom: 'brasa',
        texto: `Parada: falta ${nomes(insumo[0]).toLocaleLowerCase('pt-BR')}`,
        detalhe: 'Mande buscar para voltar a produzir.',
        falta: insumo[0],
      };
    const rebanho = Object.entries(recipe.requires ?? {}).find(
      ([id, q]) => (e.inventory[id as never] ?? 0) < (q ?? 0),
    );
    if (rebanho)
      return {
        tom: 'brasa',
        texto: `Parada: falta ${nomes(rebanho[0]).toLocaleLowerCase('pt-BR')}`,
        detalhe: 'O rebanho precisa estar na linha.',
        falta: rebanho[0],
      };
  }
  if (e.automation)
    return {
      tom: 'ceu',
      texto: 'Automática',
      detalhe: e.automationStatus ?? 'Aguardando a próxima rodada',
    };
  return { tom: 'ceu', texto: recipe ? 'Pronta para produzir' : 'Operando' };
}
