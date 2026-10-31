import { productIds, seasonProducts, type ProductId, type World } from './model';
import { designItems } from './catalog';

// Canais executados pelo motor. Adicionar apenas consumo na configuração não cria comprador.
export const householdProducts: readonly ProductId[] = productIds.filter(
  (id) => designItems[id].monthlyPerPerson,
);
// Caminhões saem do mundo como frota (comando buyVehicle), não por receita.
export const fleetProducts: readonly ProductId[] = ['truckHeavy', 'truckLight'];
// Sucata nasce do desmonte de caminhões (scrapVehicle) e do retorno urbano dos utensílios
// vendidos (recycling.urbanScrapShare), não de receita.
export const recycledProducts: readonly ProductId[] = ['scrap'];
// Itens que as famílias compram nesta temporada.
export const householdItems = (w: Pick<World, 'season'>) =>
  seasonProducts(w).filter((id) => (w.season.config.consumption[id] ?? 0) > 0);

export const infrastructurePrograms: readonly {
  name: string;
  product: ProductId;
  quantity: number;
  quality: number;
}[] = [
  { name: 'Reforço de pontes e acessos', product: 'steel', quantity: 72, quality: 65 },
  { name: 'Estruturas para escola municipal', product: 'steel', quantity: 24, quality: 75 },
  { name: 'Ampliação de unidade de saúde', product: 'steel', quantity: 48, quality: 80 },
  { name: 'Passarelas e drenagem urbana', product: 'steel', quantity: 96, quality: 70 },
  { name: 'Cobertura de equipamentos públicos', product: 'steel', quantity: 36, quality: 60 },
  { name: 'Abastecimento de cozinhas comunitárias', product: 'rice', quantity: 500, quality: 60 },
  { name: 'Programa de alimentação escolar', product: 'milk', quantity: 1200, quality: 70 },
];
