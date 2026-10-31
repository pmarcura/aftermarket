// Fronteiras da representação atual, não coeficientes industriais/agronômicos verificados.
// Massa do produto transportado exclui água de serviço e embalagens não cadastradas.
// Receitas do catálogo (catalog.ts); a perda declarada lá (lossKg) é o residual rastreado aqui.
export interface MaterialBoundary {
  // assembly: componentes comprados como processamento agregado entram como massa externa declarada.
  kind: 'extraction' | 'transformation' | 'assembly' | 'biological';
  externalMassT: number;
  residualMassT: number;
  note: string;
}
export const materialBoundaries: Record<string, MaterialBoundary> = {
  'iron-extraction': {
    kind: 'extraction',
    externalMassT: 1.5,
    residualMassT: 0,
    note: 'Uma unidade da reserva virtual (um ciclo) vira 1,5 t. A reserva é genérica por mina, sem teor nem identificação do mineral.',
  },
  'coal-extraction': {
    kind: 'extraction',
    externalMassT: 0.5,
    residualMassT: 0,
    note: 'Uma unidade da reserva virtual (um ciclo) vira 0,5 t. Minério e carvão compartilham o mecanismo de reserva; geologia/beneficiamento não são simulados.',
  },
  'steel-bars': {
    kind: 'transformation',
    externalMassT: 0,
    residualMassT: 1.1,
    note: '1,6 t de minério e 0,5 t de carvão viram 1 t de aço; 1,1 t saem como escória e gases, sem estoque nem custo de tratamento.',
  },
  'steel-recycling': {
    kind: 'transformation',
    externalMassT: 0,
    residualMassT: 0.15,
    note: '1,1 t de sucata e 50 kg de carvão viram 1 t de aço; 150 kg de impurezas saem como escória não rastreada.',
  },
  utensils: {
    kind: 'transformation',
    externalMassT: 0,
    residualMassT: 0.02,
    note: '320 kg de aço viram 60 kits de 5 kg; 20 kg de retalho de estampagem não voltam como sucata.',
  },
  'truck-heavy': {
    kind: 'assembly',
    externalMassT: 1,
    residualMassT: 0,
    note: '8 t de aço mais 1 t de motor, pneus e eletrônica pagos como processamento agregado; esses componentes não são itens do mundo.',
  },
  'truck-light': {
    kind: 'assembly',
    externalMassT: 0.5,
    residualMassT: 0,
    note: '3 t de aço mais 0,5 t de componentes pagos como processamento agregado; não são itens do mundo.',
  },
  'soy-harvest': {
    kind: 'biological',
    externalMassT: 30.06,
    residualMassT: 0,
    note: '600 kg de semente geram 30 t de grão e 660 kg de semente; o crescimento é externo implícito. Sem talhões, fertilizante nem calendário agronômico.',
  },
  'soy-oil': {
    kind: 'transformation',
    externalMassT: 0,
    residualMassT: 0.056,
    note: '1 t gera 184 kg de óleo e 760 kg de farelo. Restam 56 kg não rastreados; embalagem não é insumo físico.',
  },
  'feed-mill': {
    kind: 'transformation',
    externalMassT: 0,
    residualMassT: 0.01,
    note: '1 t de farelo vira 990 kg de ração; 10 kg de pó e umidade saem do processo. Minerais e embalagem são processamento agregado.',
  },
  'milk-production': {
    kind: 'biological',
    externalMassT: 2.9475,
    residualMassT: 0,
    note: '1.687,5 kg de ração sustentam 150 vacas por ciclo e saem 4.500 litros; água, pasto e embalagem são diferença agregada de fronteira. Nascimentos e aposentadorias do rebanho ficam fora da massa.',
  },
  'rice-harvest': {
    kind: 'biological',
    externalMassT: 6.01,
    residualMassT: 0,
    note: '100 kg de semente geram 1.200 pacotes de 5 kg e 110 kg de semente; cultivo, beneficiamento e embalagem são agregados.',
  },
  'beans-harvest': {
    kind: 'biological',
    externalMassT: 2.01,
    residualMassT: 0,
    note: '100 kg de semente geram 2.000 pacotes de 1 kg e 110 kg de semente; cultivo e embalagem agregados.',
  },
  'sugar-harvest': {
    kind: 'biological',
    externalMassT: 9.8,
    residualMassT: 0,
    note: '8 t de muda geram 1.800 pacotes de 5 kg e 8,8 t de muda; cana, moagem e refino integrados numa receita.',
  },
};
