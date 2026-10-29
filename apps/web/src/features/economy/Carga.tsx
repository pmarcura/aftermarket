import { products, type ProductId } from '../../../../../packages/simulation/src/model';

// Como o jogador chama cada unidade. Toneladas e quilos ficam como estão.
const nomes: Partial<Record<ProductId, [string, string]>> = {
  oil: ['garrafa', 'garrafas'],
  rice: ['pacote', 'pacotes'],
  beans: ['pacote', 'pacotes'],
  sugar: ['pacote', 'pacotes'],
  milk: ['caixa', 'caixas'],
  utensils: ['kit', 'kits'],
  truckHeavy: ['caminhão', 'caminhões'],
  truckLight: ['caminhão', 'caminhões'],
  cow: ['vaca', 'vacas'],
};
export function unidade(product: ProductId, n = 2) {
  const nome = nomes[product];
  if (nome) return n === 1 ? nome[0] : nome[1];
  return products[product].unit;
}
