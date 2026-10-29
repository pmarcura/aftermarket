import type { Entry, World } from '../../../../../packages/simulation/src/model';
import { GAME_DAY } from '../../../../../packages/simulation/src/operations';
import type { ParteEmpilhada } from '../../components/BarrasPixel';
import { agoraDoMundo, comecoDoDia } from '../inicio/tempo';

/** Porte da empresa pelo patrimônio líquido, em centavos. É um rótulo de jogo, não uma regra. */
export const PORTES = [
  { id: 'micro', nome: 'Micro', ate: 100_000_000 },
  { id: 'pequena', nome: 'Pequena', ate: 500_000_000 },
  { id: 'media', nome: 'Média', ate: 2_000_000_000 },
  { id: 'grande', nome: 'Grande', ate: 10_000_000_000 },
  { id: 'grupo', nome: 'Grupo', ate: Infinity },
] as const;

export function porteDe(patrimonio: number) {
  const i = PORTES.findIndex((p) => patrimonio < p.ate);
  const atual = PORTES[i === -1 ? PORTES.length - 1 : i];
  const proximo = PORTES[PORTES.indexOf(atual) + 1];
  const base = PORTES[PORTES.indexOf(atual) - 1]?.ate ?? 0;
  return {
    atual,
    proximo,
    /** De 0 a 1: quanto falta para o próximo porte. */
    avanco: proximo ? Math.min(1, Math.max(0, (patrimonio - base) / (atual.ate - base))) : 1,
    falta: proximo ? Math.max(0, atual.ate - patrimonio) : 0,
  };
}

export type GrupoSaida = 'mercadoria' | 'frete' | 'equipe' | 'imoveis' | 'outros';

// A cor e a forma seguem o assunto, nunca a posição (mesma regra da aba Finanças da loja).
export const GRUPOS: Record<
  GrupoSaida,
  Pick<ParteEmpilhada, 'rotulo' | 'cor' | 'forma' | 'ajuda'>
> = {
  mercadoria: {
    rotulo: 'Mercadoria',
    cor: 3,
    forma: 'quadrado',
    ajuda: 'Vira estoque; só pesa quando vender.',
  },
  frete: { rotulo: 'Frete', cor: 2, forma: 'losango' },
  equipe: { rotulo: 'Equipe', cor: 4, forma: 'triangulo' },
  imoveis: {
    rotulo: 'Imóveis e caminhões',
    cor: 1,
    forma: 'cruz',
    ajuda: 'Investimento: fica no patrimônio.',
  },
  outros: { rotulo: 'Energia, manutenção e outros', cor: 5, forma: 'octogono' },
};

const grupoDe = (kind: Entry['kind']): GrupoSaida =>
  kind === 'trade'
    ? 'mercadoria'
    : kind === 'freight'
      ? 'frete'
      : kind === 'payroll' || kind === 'education'
        ? 'equipe'
        : kind === 'property' || kind === 'vehicle'
          ? 'imoveis'
          : 'outros';

/** Ícone de cada tipo de movimentação, para a lista de transações. */
export const ICONE_DO_TIPO: Record<
  string,
  'moeda' | 'caixa' | 'caminhao' | 'predio' | 'cartao' | 'pedido'
> = {
  retail: 'moeda',
  trade: 'caixa',
  freight: 'caminhao',
  property: 'predio',
  vehicle: 'caminhao',
  payroll: 'predio',
  maintenance: 'predio',
  operation: 'predio',
  loan: 'cartao',
  repayment: 'cartao',
  finance: 'cartao',
};

/**
 * Uma passada pelo histórico da empresa: entrou, saiu (por assunto) e o caixa acumulado em
 * pontos. O período é contado em dias de jogo, terminando no instante calculado do mundo.
 */
export function resumoDaEmpresa(world: World, empresa: string, dias: number, pontos = 36) {
  const fim = agoraDoMundo(world);
  const n = Math.max(
    1,
    Math.min(
      dias,
      world.view?.ledgerDays ?? dias,
      Math.ceil((comecoDoDia(world) + GAME_DAY - world.economyStartedAt) / GAME_DAY),
    ),
  );
  const inicio = Math.max(world.economyStartedAt, comecoDoDia(world) - (n - 1) * GAME_DAY);
  const largura = Math.max(1, fim - inicio) / pontos;
  const variacao = new Array<number>(pontos).fill(0);
  const porGrupo: Record<GrupoSaida, number> = {
    mercadoria: 0,
    frete: 0,
    equipe: 0,
    imoveis: 0,
    outros: 0,
  };
  let entrou = 0;
  let saiu = 0;
  for (const l of world.ledger) {
    if (l.at < inicio || l.at > fim || l.from === l.to) continue;
    const i = Math.min(pontos - 1, Math.floor((l.at - inicio) / largura));
    if (l.to === empresa) {
      entrou += l.amount;
      variacao[i] += l.amount;
    } else if (l.from === empresa) {
      saiu += l.amount;
      variacao[i] -= l.amount;
      porGrupo[grupoDe(l.kind)] += l.amount;
    }
  }
  let acumulado = 0;
  const caixa = variacao.map((v, i) => {
    acumulado += v;
    return { at: Math.min(fim, inicio + (i + 1) * largura), valor: acumulado };
  });
  return { dias: n, inicio, fim, entrou, saiu, porGrupo, caixa };
}
