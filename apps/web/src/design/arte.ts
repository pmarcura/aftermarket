import type { Category, Establishment, ProductId, World } from '../../../../packages/simulation/src/model';

// Peças em pixel art de apps/web/public/arte. Tamanho natural em pixels; o jogo as amplia em múltiplos inteiros.
export const sprites = {
  loja: { w: 85, h: 62 },
  lavoura: { w: 91, h: 62 },
  'fazenda-leite': { w: 92, h: 69 },
  siderurgica: { w: 84, h: 76 },
  'aco-utensilio': { w: 77, h: 54 },
  'soja-oleo': { w: 78, h: 67 },
  silos: { w: 78, h: 75 },
  caminhao: { w: 83, h: 66 },
  mina: { w: 89, h: 61 },
} as const;
export type Sprite = keyof typeof sprites;

const porCategoria: Record<Category, Sprite> = {
  retail: 'loja',
  farm: 'lavoura',
  industry: 'siderurgica',
  mine: 'mina',
  warehouse: 'silos',
  logistics: 'caminhao',
};
const porProduto: Partial<Record<ProductId, Sprite>> = {
  milk: 'fazenda-leite',
  rice: 'lavoura',
  beans: 'lavoura',
  sugar: 'lavoura',
  riceSeed: 'lavoura',
  beanSeed: 'lavoura',
  soySeed: 'lavoura',
  caneSeedling: 'lavoura',
  soy: 'soja-oleo',
  oil: 'soja-oleo',
  soymeal: 'soja-oleo',
  steel: 'siderurgica',
  utensils: 'aco-utensilio',
  iron: 'mina',
  coal: 'mina',
  feed: 'silos',
  truckHeavy: 'caminhao',
  truckLight: 'caminhao',
};

/** Escolhe a ilustração pelo que o negócio produz; sem receita, pela categoria. */
export function spriteDoNegocio(e: Establishment, world: World): Sprite {
  const recipe = world.season.config.recipes.find((r) => r.id === e.specialization);
  const saida = recipe && (Object.keys(recipe.output) as ProductId[])[0];
  return (saida && porProduto[saida]) || porCategoria[e.category];
}
