import type { ProductId } from './model';

// Canais executados pelo motor. Adicionar apenas consumo na configuração não cria comprador.
export const householdProducts: readonly ProductId[] = ['oil', 'rice', 'beans', 'sugar', 'milk'];

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
