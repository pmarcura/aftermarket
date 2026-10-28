import type { Position } from '../../simulation/src/model';

// Geografia do mundo versão 2: municípios do Centro-Sul com código oficial do IBGE
// (conferido em data/ibge-municipalities.json). Coordenadas são aproximações da sede municipal
// e populações são o Censo 2022 arredondado ao milhar: referência pública, não levantamento
// oficial. A procura de jogo é calculada a partir delas pela temporada.
export interface City {
  id: string;
  name: string;
  state: string;
  coordinates: Position;
  population: number;
}
const c = (
  id: string,
  name: string,
  state: string,
  lon: number,
  lat: number,
  thousands: number,
): City => ({
  id,
  name,
  state,
  coordinates: [lon, lat],
  population: thousands * 1000,
});
export const cities: City[] = [
  c('3550308', 'São Paulo', 'SP', -46.633, -23.55, 11451),
  c('3509502', 'Campinas', 'SP', -47.061, -22.905, 1139),
  c('3518800', 'Guarulhos', 'SP', -46.533, -23.454, 1291),
  c('3548708', 'São Bernardo do Campo', 'SP', -46.565, -23.694, 811),
  c('3552205', 'Sorocaba', 'SP', -47.458, -23.501, 724),
  c('3543402', 'Ribeirão Preto', 'SP', -47.81, -21.177, 698),
  c('3549904', 'São José dos Campos', 'SP', -45.887, -23.189, 697),
  c('3548500', 'Santos', 'SP', -46.333, -23.961, 418),
  c('3538709', 'Piracicaba', 'SP', -47.649, -22.725, 423),
  c('3506003', 'Bauru', 'SP', -49.06, -22.315, 379),
  c('3549805', 'São José do Rio Preto', 'SP', -49.379, -20.812, 480),
  c('3551702', 'Sertãozinho', 'SP', -47.99, -21.137, 126),
  c('3526902', 'Limeira', 'SP', -47.401, -22.565, 291),
  c('3501608', 'Americana', 'SP', -47.331, -22.738, 237),
  c('3304557', 'Rio de Janeiro', 'RJ', -43.173, -22.907, 6211),
  c('3306305', 'Volta Redonda', 'RJ', -44.104, -22.523, 261),
  c('3304201', 'Resende', 'RJ', -44.447, -22.469, 129),
  c('3303302', 'Niterói', 'RJ', -43.104, -22.883, 482),
  c('3106200', 'Belo Horizonte', 'MG', -43.938, -19.92, 2316),
  c('3170206', 'Uberlândia', 'MG', -48.277, -18.918, 713),
  c('3118601', 'Contagem', 'MG', -44.054, -19.932, 621),
  c('3136702', 'Juiz de Fora', 'MG', -43.35, -21.764, 540),
  c('3131307', 'Ipatinga', 'MG', -42.537, -19.468, 227),
  c('3131703', 'Itabira', 'MG', -43.226, -19.619, 113),
  c('3140001', 'Mariana', 'MG', -43.416, -20.378, 61),
  c('3118007', 'Congonhas', 'MG', -43.858, -20.5, 52),
  c('3145901', 'Ouro Branco', 'MG', -43.692, -20.521, 39),
  c('3148004', 'Patos de Minas', 'MG', -46.518, -18.579, 159),
  c('3170404', 'Unaí', 'MG', -46.906, -16.357, 86),
  c('3152501', 'Pouso Alegre', 'MG', -45.936, -22.23, 152),
  c('3205309', 'Vitória', 'ES', -40.338, -20.32, 322),
  c('3205002', 'Serra', 'ES', -40.308, -20.128, 520),
  c('4106902', 'Curitiba', 'PR', -49.273, -25.428, 1774),
  c('4113700', 'Londrina', 'PR', -51.163, -23.31, 556),
  c('4115200', 'Maringá', 'PR', -51.939, -23.42, 410),
  c('4119905', 'Ponta Grossa', 'PR', -50.162, -25.095, 358),
  c('4104808', 'Cascavel', 'PR', -53.455, -24.956, 348),
  c('4104907', 'Castro', 'PR', -50.012, -24.791, 71),
  c('4205407', 'Florianópolis', 'SC', -48.548, -27.595, 537),
  c('4209102', 'Joinville', 'SC', -48.846, -26.304, 616),
  c('4204608', 'Criciúma', 'SC', -49.37, -28.678, 214),
  c('4209607', 'Lauro Müller', 'SC', -49.396, -28.393, 15),
  c('4314902', 'Porto Alegre', 'RS', -51.23, -30.033, 1332),
  c('4305108', 'Caxias do Sul', 'RS', -51.179, -29.168, 463),
  c('4304804', 'Carlos Barbosa', 'RS', -51.503, -29.297, 30),
  c('4322400', 'Uruguaiana', 'RS', -57.088, -29.755, 117),
  c('4310603', 'Itaqui', 'RS', -56.553, -29.125, 36),
  c('4304358', 'Candiota', 'RS', -53.677, -31.558, 9),
  c('4314407', 'Pelotas', 'RS', -52.343, -31.766, 325),
  c('5208707', 'Goiânia', 'GO', -49.264, -16.686, 1437),
  c('5218805', 'Rio Verde', 'GO', -50.928, -17.797, 225),
  c('5201108', 'Anápolis', 'GO', -48.952, -16.328, 398),
  c('5103403', 'Cuiabá', 'MT', -56.097, -15.601, 650),
  c('5107602', 'Rondonópolis', 'MT', -54.636, -16.47, 245),
  c('5107925', 'Sorriso', 'MT', -55.711, -12.545, 110),
  c('5107909', 'Sinop', 'MT', -55.503, -11.864, 196),
  c('5002704', 'Campo Grande', 'MS', -54.62, -20.469, 898),
  c('5003702', 'Dourados', 'MS', -54.806, -22.221, 243),
  c('5300108', 'Brasília', 'DF', -47.882, -15.794, 2817),
];
const byName = new Map(cities.map((city) => [city.name, city]));
const city = (name: string) => {
  const found = byName.get(name);
  if (!found) throw new Error(`Município ausente da geografia: ${name}`);
  return found;
};
// Polos produtivos reais por receita: município e peso na distribuição das unidades.
export const hubs: Record<string, [City, number][]> = {
  'iron-extraction': [
    [city('Itabira'), 3],
    [city('Mariana'), 2],
    [city('Congonhas'), 2],
  ],
  'coal-extraction': [
    [city('Criciúma'), 3],
    [city('Lauro Müller'), 2],
    [city('Candiota'), 2],
  ],
  'steel-bars': [
    [city('Ipatinga'), 2],
    [city('Ouro Branco'), 2],
    [city('Volta Redonda'), 2],
    [city('Serra'), 1],
  ],
  utensils: [
    [city('Caxias do Sul'), 2],
    [city('Carlos Barbosa'), 2],
    [city('São Paulo'), 1],
    [city('Joinville'), 1],
  ],
  'truck-heavy': [
    [city('São Bernardo do Campo'), 2],
    [city('Resende'), 1],
    [city('Caxias do Sul'), 1],
  ],
  'truck-light': [
    [city('São Bernardo do Campo'), 1],
    [city('Resende'), 1],
    [city('Caxias do Sul'), 1],
  ],
  'soy-harvest': [
    [city('Sorriso'), 3],
    [city('Sinop'), 2],
    [city('Rondonópolis'), 2],
    [city('Rio Verde'), 2],
    [city('Cascavel'), 2],
    [city('Dourados'), 1],
  ],
  'soy-oil': [
    [city('Rondonópolis'), 2],
    [city('Ponta Grossa'), 2],
    [city('Uberlândia'), 1],
    [city('Rio Verde'), 1],
  ],
  'feed-mill': [
    [city('Patos de Minas'), 2],
    [city('Uberlândia'), 1],
    [city('Castro'), 1],
  ],
  'milk-production': [
    [city('Patos de Minas'), 2],
    [city('Pouso Alegre'), 2],
    [city('Castro'), 2],
    [city('Uberlândia'), 1],
    [city('Juiz de Fora'), 1],
  ],
  'rice-harvest': [
    [city('Uruguaiana'), 3],
    [city('Itaqui'), 2],
    [city('Pelotas'), 1],
  ],
  'beans-harvest': [
    [city('Unaí'), 2],
    [city('Ponta Grossa'), 1],
    [city('Castro'), 1],
  ],
  'sugar-harvest': [
    [city('Ribeirão Preto'), 2],
    [city('Sertãozinho'), 2],
    [city('Piracicaba'), 2],
    [city('São José do Rio Preto'), 1],
  ],
};
// Cidade do polo para a n-ésima unidade da receita, respeitando os pesos.
export function hubCity(recipeId: string, n: number): City {
  const list = hubs[recipeId];
  if (!list) return cities[0];
  const wheel = list.flatMap(([hub, weight]) => Array.from({ length: weight }, () => hub));
  return wheel[n % wheel.length];
}
// Posição de uma unidade em volta da sede: produção fica fora da área urbana (8 a 25 km),
// comércio dentro da cidade (até 4 km). Determinística pelo índice, sem sorteio.
export function siteNear(base: City, n: number, rural: boolean): Position {
  const angle = (n * 137.508 * Math.PI) / 180;
  const ring = rural ? 8 + ((n * 7) % 18) : 0.6 + ((n * 3) % 35) / 10;
  const km = 111.32;
  return [
    Math.round(
      (base.coordinates[0] +
        (Math.cos(angle) * ring) / (km * Math.cos((base.coordinates[1] * Math.PI) / 180))) *
        1e5,
    ) / 1e5,
    Math.round((base.coordinates[1] + (Math.sin(angle) * ring) / km) * 1e5) / 1e5,
  ];
}
