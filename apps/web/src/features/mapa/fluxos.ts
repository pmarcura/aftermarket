/**
 * Fluxo de recursos no mapa: as cargas que estão na estrada agora, agrupadas por trajeto
 * (origem → destino), com a cor da cadeia e a espessura pelo peso. Só leitura do mundo.
 *
 * Só entram cargas com caminho de estrada confirmado (D-036): a estimativa riscaria retas.
 * Cargas entregues saem do mundo, então o mapa mostra o que está andando agora.
 */
import {
  products,
  type Position,
  type ProductId,
  type Shipment,
  type World,
} from '../../../../../packages/simulation/src/model';
import { shipmentRoadPath, shipmentRoute } from '../../../../../packages/simulation/src/road-path';

export type Cadeia = 'alimentos' | 'metal';
export type Sentido = 'todos' | 'entrando' | 'saindo';

export interface OpcoesDeFluxo {
  /** Mostrar só este produto (vazio: todos). */
  produto?: ProductId | null;
  /** Em relação às empresas do jogador: tudo, o que chega ou o que sai. */
  sentido: Sentido;
  /** Só cargas em que o jogador é comprador, vendedor ou transportador. */
  soMeus?: boolean;
}

/** Cores da identidade: terracota para a cadeia de alimentos, azul aço para a de metal. */
export const COR_DA_CADEIA: Record<Cadeia, string> = {
  alimentos: '#d0682f',
  metal: '#3f7fc0',
};
export const NOME_DA_CADEIA: Record<Cadeia, string> = {
  alimentos: 'Alimentos e agro',
  metal: 'Metal e veículos',
};

const METAL = new Set(['Matérias-primas', 'Materiais', 'Bens de consumo', 'Veículos']);
export const cadeiaDo = (produto: ProductId): Cadeia =>
  METAL.has(products[produto].category) ? 'metal' : 'alimentos';

/** Peso da carga em toneladas (unidades viram toneladas pela massa do item). */
export const toneladas = (s: Shipment) => s.quantity * products[s.product].massT;

/** As cargas que entram no mapa de fluxos, já filtradas. */
export function cargasDoFluxo(w: World, actor: string, o: OpcoesDeFluxo) {
  const minhas = new Set(w.companies.filter((c) => c.id === actor).map((c) => c.id));
  return w.shipments.filter((s) => {
    if (s.delivered || !shipmentRoadPath(w, s)) return false;
    if (o.produto && s.product !== o.produto) return false;
    const envolvido = minhas.has(s.buyerId) || minhas.has(s.sellerId) || minhas.has(s.carrierId);
    if (o.soMeus && !envolvido) return false;
    if (o.sentido === 'entrando') return minhas.has(s.buyerId);
    if (o.sentido === 'saindo') return minhas.has(s.sellerId);
    return true;
  });
}

export interface Trajeto {
  chave: string;
  caminho: Position[];
  cadeia: Cadeia;
  toneladas: number;
  cargas: number;
  produtos: ProductId[];
  origem: string;
  destino: string;
}

/** Agrupa as cargas por trajeto; a cadeia do trajeto é a da carga mais pesada. */
export function trajetosDoFluxo(w: World, cargas: Shipment[]): Trajeto[] {
  const nome = (id: string) => w.establishments.find((e) => e.id === id)?.name ?? id;
  const grupos = new Map<string, Trajeto & { maior: number }>();
  for (const s of cargas) {
    const chave = `${s.originId}>${s.destinationId}`;
    const t = toneladas(s);
    let g = grupos.get(chave);
    if (!g) {
      g = {
        chave,
        caminho: shipmentRoute(w, s),
        cadeia: cadeiaDo(s.product),
        toneladas: 0,
        cargas: 0,
        produtos: [],
        origem: nome(s.originId),
        destino: nome(s.destinationId),
        maior: 0,
      };
      grupos.set(chave, g);
    }
    g.toneladas += t;
    g.cargas++;
    if (!g.produtos.includes(s.product)) g.produtos.push(s.product);
    if (t > g.maior) {
      g.maior = t;
      g.cadeia = cadeiaDo(s.product);
    }
  }
  return [...grupos.values()].map(({ maior: _maior, ...t }) => t);
}

/** Resumo por produto para o painel: cargas, toneladas e cadeia, do maior para o menor. */
export function resumoPorProduto(cargas: Shipment[]) {
  const por = new Map<ProductId, { produto: ProductId; cargas: number; toneladas: number }>();
  for (const s of cargas) {
    const r = por.get(s.product) ?? { produto: s.product, cargas: 0, toneladas: 0 };
    r.cargas++;
    r.toneladas += toneladas(s);
    por.set(s.product, r);
  }
  return [...por.values()]
    .map((r) => ({ ...r, cadeia: cadeiaDo(r.produto) }))
    .sort((a, b) => b.cargas - a.cargas || b.toneladas - a.toneladas);
}

/** Espessura da linha (px) pelo peso: raiz quadrada, para trajetos leves não sumirem. */
export function espessura(t: number, maximo: number) {
  return 2 + 7 * Math.sqrt(t / Math.max(maximo, 1e-9));
}
