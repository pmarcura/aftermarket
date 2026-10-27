// Fronteiras da representação atual, não coeficientes industriais/agronômicos verificados.
// Massa do produto transportado exclui água de serviço e embalagens não cadastradas.
export interface MaterialBoundary {
  kind: 'extraction' | 'transformation' | 'biological';
  externalMassT: number;
  residualMassT: number;
  note: string;
}
export const materialBoundaries: Record<string, MaterialBoundary> = {
  'steel-bars': {
    kind: 'transformation',
    externalMassT: 0,
    residualMassT: 7,
    note: '15 t entram e 8 t saem. As 7 t restantes não têm estoque/destino: fronteira agregada a detalhar; não chamar de resíduo industrial medido.',
  },
  'soy-oil': {
    kind: 'transformation',
    externalMassT: 0,
    residualMassT: 0.056,
    note: '1 t gera 184 kg de óleo e 760 kg de farelo. Restam 56 kg não rastreados; embalagem não é insumo físico.',
  },
  'soy-harvest': {
    kind: 'biological',
    externalMassT: 25,
    residualMassT: 0,
    note: '1 t de soja funciona como semente agregada e gera 26 t; 25 t representam crescimento externo implícito. Sem área ocupada por safra, fertilizantes ou calendário agronômico.',
  },
  'iron-extraction': {
    kind: 'extraction',
    externalMassT: 1,
    residualMassT: 0,
    note: 'Uma unidade da reserva virtual vira 1 t. A reserva atual é genérica por mina, sem teor nem identificação do mineral.',
  },
  'coal-extraction': {
    kind: 'extraction',
    externalMassT: 1,
    residualMassT: 0,
    note: 'Uma unidade da reserva virtual vira 1 t. Minério e carvão compartilham o mecanismo de reserva; geologia/beneficiamento não são simulados.',
  },
  'rice-harvest': {
    kind: 'biological',
    externalMassT: 0.795,
    residualMassT: 0,
    note: 'Um pacote de varejo representa a semente de partida. Cultivo, beneficiamento e embalagem são agregados; crescimento líquido de 795 kg.',
  },
  'beans-harvest': {
    kind: 'biological',
    externalMassT: 0.399,
    residualMassT: 0,
    note: 'Um pacote de varejo representa a semente. Cultivo/embalagem agregados; crescimento líquido de 399 kg.',
  },
  'sugar-harvest': {
    kind: 'biological',
    externalMassT: 0.895,
    residualMassT: 0,
    note: 'Açúcar embalado funciona como entrada de partida fictícia da cana integrada. Crescimento líquido de 895 kg; não representa propagação real de cana.',
  },
  'milk-production': {
    kind: 'biological',
    externalMassT: 0.259,
    residualMassT: 0,
    note: '50 kg de farelo geram 309 kg de leite; 259 kg são diferença agregada de fronteira. Rebanho, outra alimentação, água incorporada e embalagens não são bens físicos modelados.',
  },
};
