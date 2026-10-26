import type { Position } from '../../simulation/src/model';

// Coordenadas de referência; demanda e oferta abaixo são parâmetros de jogo, não estatísticas oficiais.
export const regions: {
  id: string;
  name: string;
  state: string;
  coordinates: Position;
  demand: number;
  supply: number;
  competitors: number;
  population: number;
  logistics: string;
}[] = [
  {
    id: '3509502',
    name: 'Campinas',
    state: 'SP',
    coordinates: [-47.061, -22.905],
    demand: 12800,
    supply: 8400,
    competitors: 8,
    population: 1139047,
    logistics: 'Baixo',
  },
  {
    id: '3538709',
    name: 'Piracicaba',
    state: 'SP',
    coordinates: [-47.649, -22.725],
    demand: 9450,
    supply: 7800,
    competitors: 12,
    population: 423323,
    logistics: 'Baixo',
  },
  {
    id: '3501608',
    name: 'Americana',
    state: 'SP',
    coordinates: [-47.331, -22.738],
    demand: 6900,
    supply: 6100,
    competitors: 6,
    population: 237240,
    logistics: 'Baixo',
  },
  {
    id: '3526902',
    name: 'Limeira',
    state: 'SP',
    coordinates: [-47.401, -22.565],
    demand: 7100,
    supply: 6800,
    competitors: 9,
    population: 291869,
    logistics: 'Médio',
  },
  {
    id: '3552205',
    name: 'Sorocaba',
    state: 'SP',
    coordinates: [-47.458, -23.501],
    demand: 8200,
    supply: 6700,
    competitors: 10,
    population: 723574,
    logistics: 'Médio',
  },
  {
    id: '3549904',
    name: 'São José dos Campos',
    state: 'SP',
    coordinates: [-45.887, -23.189],
    demand: 7900,
    supply: 6500,
    competitors: 7,
    population: 697054,
    logistics: 'Médio',
  },
  {
    id: '3131703',
    name: 'Itabira',
    state: 'MG',
    coordinates: [-43.226, -19.619],
    demand: 4100,
    supply: 6800,
    competitors: 5,
    population: 113343,
    logistics: 'Alto',
  },
  {
    id: '3106200',
    name: 'Belo Horizonte',
    state: 'MG',
    coordinates: [-43.938, -19.92],
    demand: 19200,
    supply: 18100,
    competitors: 23,
    population: 2315560,
    logistics: 'Alto',
  },
  {
    id: '3550308',
    name: 'São Paulo',
    state: 'SP',
    coordinates: [-46.633, -23.55],
    demand: 124000,
    supply: 119000,
    competitors: 94,
    population: 11451245,
    logistics: 'Médio',
  },
  {
    id: '4106902',
    name: 'Curitiba',
    state: 'PR',
    coordinates: [-49.273, -25.428],
    demand: 14800,
    supply: 13200,
    competitors: 18,
    population: 1773718,
    logistics: 'Alto',
  },
];
