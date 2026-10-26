import type { Position } from '../../simulation/src/model';

// Praças piloto. População é copiada para a configuração da temporada; economia é calculada pelo simulador.
export const regions: {
  id: string;
  name: string;
  state: string;
  coordinates: Position;
  population: number;
}[] = [
  {
    id: '3509502',
    name: 'Campinas',
    state: 'SP',
    coordinates: [-47.061, -22.905],
    population: 1139047,
  },
  {
    id: '3538709',
    name: 'Piracicaba',
    state: 'SP',
    coordinates: [-47.649, -22.725],
    population: 423323,
  },
  {
    id: '3501608',
    name: 'Americana',
    state: 'SP',
    coordinates: [-47.331, -22.738],
    population: 237240,
  },
  {
    id: '3526902',
    name: 'Limeira',
    state: 'SP',
    coordinates: [-47.401, -22.565],
    population: 291869,
  },
  {
    id: '3552205',
    name: 'Sorocaba',
    state: 'SP',
    coordinates: [-47.458, -23.501],
    population: 723574,
  },
  {
    id: '3549904',
    name: 'São José dos Campos',
    state: 'SP',
    coordinates: [-45.887, -23.189],
    population: 697054,
  },
  {
    id: '3131703',
    name: 'Itabira',
    state: 'MG',
    coordinates: [-43.226, -19.619],
    population: 113343,
  },
  {
    id: '3106200',
    name: 'Belo Horizonte',
    state: 'MG',
    coordinates: [-43.938, -19.92],
    population: 2315560,
  },
  {
    id: '3550308',
    name: 'São Paulo',
    state: 'SP',
    coordinates: [-46.633, -23.55],
    population: 11451245,
  },
  {
    id: '4106902',
    name: 'Curitiba',
    state: 'PR',
    coordinates: [-49.273, -25.428],
    population: 1773718,
  },
];
