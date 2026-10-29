import { useMemo } from 'react';

/**
 * Ilustrações pequenas em pixel art para marcar conceitos (justo, rival, mapa, custo...),
 * feitas como as peças dos produtos: cor cheia, luz e sombra e contorno escuro.
 * Cada ícone é uma lista de retângulos numa grade de 16 x 16; o contorno sai sozinho.
 */
type Cor = 'g' | 'G' | 'w' | 'n' | 'N' | 'l' | 'L' | 'c' | 'C' | 'r' | 'R' | 'b' | 'B' | 'k';
type Op = [x: number, y: number, w: number, h: number, cor: Cor];

const PALETA: Record<Cor, string> = {
  g: 'var(--ouro)',
  G: 'var(--ouro-escuro)',
  w: 'var(--creme)',
  n: 'var(--apagado)',
  N: 'var(--borda-forte)',
  l: 'var(--lavoura)',
  L: 'var(--lavoura-escura)',
  c: 'var(--ceu)',
  C: 'var(--serie-2)',
  r: 'var(--brasa)',
  R: 'var(--serie-5)',
  b: 'var(--terra-mina)',
  B: 'var(--ouro-escuro)',
  k: 'var(--sombra)',
};

const ICONES = {
  /** Balança: o preço justo. */
  justo: [
    [7, 1, 2, 2, 'g'],
    [2, 3, 12, 2, 'g'],
    [7, 5, 2, 7, 'g'],
    [7, 3, 1, 1, 'w'],
    [4, 12, 8, 2, 'n'],
    [4, 12, 8, 1, 'w'],
    [2, 5, 1, 3, 'n'],
    [13, 5, 1, 3, 'n'],
    [1, 8, 4, 2, 'w'],
    [11, 8, 4, 2, 'w'],
    [1, 9, 4, 1, 'n'],
    [11, 9, 4, 1, 'n'],
  ],
  /** Lojinha com toldo: o concorrente da cidade. */
  rival: [
    [1, 2, 14, 1, 'R'],
    [1, 3, 2, 3, 'r'],
    [3, 3, 2, 3, 'w'],
    [5, 3, 2, 3, 'r'],
    [7, 3, 2, 3, 'w'],
    [9, 3, 2, 3, 'r'],
    [11, 3, 2, 3, 'w'],
    [13, 3, 2, 3, 'r'],
    [2, 6, 12, 8, 'w'],
    [2, 13, 12, 1, 'n'],
    [3, 8, 3, 3, 'c'],
    [10, 8, 3, 3, 'c'],
    [7, 9, 2, 5, 'b'],
    [3, 8, 1, 1, 'w'],
    [10, 8, 1, 1, 'w'],
  ],
  /** Marcador de mapa: o menor preço do país. */
  mapa: [
    [5, 1, 6, 1, 'r'],
    [4, 2, 8, 5, 'r'],
    [5, 7, 6, 1, 'r'],
    [6, 8, 4, 1, 'r'],
    [6, 9, 4, 1, 'r'],
    [7, 10, 2, 2, 'r'],
    [5, 2, 1, 2, 'R'],
    [7, 4, 2, 2, 'w'],
    [4, 13, 8, 1, 'N'],
    [5, 14, 6, 1, 'N'],
  ],
  /** Etiqueta de preço: o seu custo. */
  custo: [
    [2, 5, 9, 7, 'g'],
    [11, 6, 2, 5, 'g'],
    [13, 7, 1, 3, 'g'],
    [2, 5, 9, 1, 'w'],
    [2, 11, 9, 1, 'G'],
    [4, 7, 2, 2, 'k'],
    [7, 7, 3, 1, 'G'],
    [7, 9, 3, 1, 'G'],
    [5, 2, 1, 3, 'n'],
    [6, 2, 2, 1, 'n'],
  ],
  /** Moeda: o preço que você cobra. */
  moeda: [
    [5, 1, 6, 1, 'g'],
    [4, 2, 8, 1, 'g'],
    [3, 3, 10, 9, 'g'],
    [4, 12, 8, 1, 'G'],
    [5, 13, 6, 1, 'G'],
    [3, 11, 10, 1, 'G'],
    [4, 3, 1, 4, 'w'],
    [5, 2, 2, 1, 'w'],
    [7, 4, 2, 7, 'G'],
    [6, 5, 4, 1, 'G'],
    [6, 9, 4, 1, 'G'],
  ],
  /** Engradado: o estoque. */
  caixa: [
    [1, 3, 14, 11, 'b'],
    [1, 3, 14, 2, 'g'],
    [1, 3, 14, 1, 'w'],
    [1, 8, 14, 1, 'B'],
    [4, 5, 1, 9, 'B'],
    [11, 5, 1, 9, 'B'],
    [1, 13, 14, 1, 'B'],
  ],
  /** Caminhão: carga a caminho. */
  caminhao: [
    [1, 3, 9, 8, 'w'],
    [1, 3, 9, 1, 'n'],
    [10, 5, 5, 6, 'c'],
    [12, 6, 2, 2, 'w'],
    [10, 10, 5, 1, 'C'],
    [1, 10, 9, 1, 'n'],
    [3, 11, 3, 3, 'N'],
    [11, 11, 3, 3, 'N'],
    [4, 12, 1, 1, 'n'],
    [12, 12, 1, 1, 'n'],
  ],
  /** Prancheta: pedido feito. */
  pedido: [
    [3, 2, 10, 12, 'w'],
    [6, 1, 4, 2, 'n'],
    [5, 5, 6, 1, 'N'],
    [5, 7, 6, 1, 'N'],
    [5, 9, 4, 1, 'N'],
    [5, 11, 2, 1, 'g'],
    [3, 13, 10, 1, 'n'],
  ],
  /** Relógio: prazo de chegada. */
  prazo: [
    [5, 1, 6, 1, 'w'],
    [3, 2, 10, 12, 'w'],
    [2, 4, 12, 8, 'w'],
    [4, 13, 8, 1, 'n'],
    [7, 3, 2, 6, 'k'],
    [7, 8, 4, 2, 'k'],
    [3, 11, 10, 1, 'n'],
  ],
  /** Estrela: destaque (melhor escolha). */
  estrela: [
    [7, 1, 2, 4, 'g'],
    [1, 5, 14, 3, 'g'],
    [3, 8, 10, 2, 'g'],
    [2, 10, 4, 4, 'g'],
    [10, 10, 4, 4, 'g'],
    [7, 8, 2, 3, 'g'],
    [7, 2, 1, 3, 'w'],
    [2, 5, 4, 1, 'w'],
    [3, 10, 3, 1, 'G'],
    [10, 10, 3, 1, 'G'],
  ],
  /** Prédio: imóveis e a empresa. */
  predio: [
    [2, 1, 12, 2, 'N'],
    [3, 3, 10, 11, 'w'],
    [5, 5, 2, 2, 'c'],
    [9, 5, 2, 2, 'c'],
    [5, 8, 2, 2, 'c'],
    [9, 8, 2, 2, 'c'],
    [7, 11, 2, 3, 'b'],
    [3, 13, 10, 1, 'n'],
  ],
  /** Triângulo de alerta: algo precisa de atenção. */
  alerta: [
    [7, 2, 2, 1, 'r'],
    [6, 3, 4, 2, 'r'],
    [5, 5, 6, 2, 'r'],
    [4, 7, 8, 2, 'r'],
    [3, 9, 10, 2, 'r'],
    [2, 11, 12, 2, 'r'],
    [1, 13, 14, 1, 'R'],
    [7, 6, 2, 4, 'w'],
    [7, 11, 2, 1, 'w'],
  ],
  /** Cartão: crédito e compromissos. */
  cartao: [
    [1, 3, 14, 10, 'c'],
    [1, 3, 14, 2, 'C'],
    [1, 6, 14, 2, 'k'],
    [3, 10, 4, 1, 'w'],
    [10, 10, 3, 2, 'g'],
  ],
  /** Fábrica com chaminé: negócio para abrir. */
  fabrica: [
    [10, 2, 3, 6, 'R'],
    [11, 1, 2, 1, 'n'],
    [2, 7, 12, 7, 'w'],
    [2, 6, 7, 1, 'r'],
    [2, 13, 12, 1, 'n'],
    [6, 10, 3, 4, 'b'],
    [3, 9, 2, 2, 'c'],
    [10, 10, 2, 2, 'c'],
  ],
  /** Duas pessoas: a equipe. */
  equipe: [
    [9, 4, 4, 4, 'n'],
    [8, 9, 6, 5, 'c'],
    [4, 3, 4, 4, 'w'],
    [2, 8, 8, 6, 'l'],
    [4, 3, 4, 1, 'g'],
  ],
  /** Barras de gráfico: cotações. */
  grafico: [
    [2, 2, 1, 12, 'n'],
    [2, 13, 12, 1, 'n'],
    [4, 9, 2, 4, 'l'],
    [7, 6, 2, 7, 'g'],
    [10, 3, 2, 10, 'c'],
  ],
  /** Raio: energia gasta por ciclo. */
  energia: [
    [8, 1, 4, 3, 'g'],
    [7, 4, 4, 2, 'g'],
    [4, 6, 8, 2, 'g'],
    [6, 8, 4, 3, 'g'],
    [5, 11, 3, 3, 'g'],
    [8, 1, 1, 3, 'w'],
    [4, 6, 2, 1, 'w'],
  ],
  /** Gota: água gasta por ciclo. */
  agua: [
    [7, 1, 2, 2, 'c'],
    [6, 3, 4, 2, 'c'],
    [5, 5, 6, 3, 'c'],
    [4, 8, 8, 4, 'c'],
    [5, 12, 6, 1, 'C'],
    [6, 13, 4, 1, 'C'],
    [5, 8, 1, 3, 'w'],
  ],
  /** Engrenagem: a máquina da unidade. */
  engrenagem: [
    [5, 5, 6, 6, 'n'],
    [7, 2, 2, 3, 'n'],
    [7, 11, 2, 3, 'n'],
    [2, 7, 3, 2, 'n'],
    [11, 7, 3, 2, 'n'],
    [3, 3, 2, 2, 'n'],
    [11, 3, 2, 2, 'n'],
    [3, 11, 2, 2, 'n'],
    [11, 11, 2, 2, 'n'],
    [7, 7, 2, 2, 'k'],
    [5, 5, 3, 1, 'w'],
  ],
  /** Broto: a lavoura. */
  broto: [
    [7, 6, 2, 8, 'L'],
    [2, 3, 5, 3, 'l'],
    [9, 1, 5, 4, 'l'],
    [2, 3, 5, 1, 'w'],
    [9, 1, 5, 1, 'w'],
    [3, 13, 10, 1, 'b'],
  ],
  /** Prefeitura: o comprador dos contratos públicos. */
  prefeitura: [
    [7, 1, 2, 1, 'w'],
    [5, 2, 6, 1, 'w'],
    [3, 3, 10, 1, 'w'],
    [1, 4, 14, 1, 'n'],
    [2, 5, 2, 7, 'w'],
    [7, 5, 2, 7, 'w'],
    [12, 5, 2, 7, 'w'],
    [1, 12, 14, 1, 'n'],
    [0, 13, 16, 1, 'N'],
  ],
  /** Troféu: quem venceu a disputa. */
  trofeu: [
    [4, 2, 8, 5, 'g'],
    [5, 7, 6, 1, 'g'],
    [7, 8, 2, 3, 'G'],
    [5, 11, 6, 2, 'G'],
    [2, 3, 2, 3, 'g'],
    [12, 3, 2, 3, 'g'],
    [5, 3, 1, 3, 'w'],
    [4, 6, 8, 1, 'G'],
  ],
  /** Carta: uma proposta enviada. */
  carta: [
    [2, 4, 12, 9, 'w'],
    [2, 4, 12, 1, 'n'],
    [3, 5, 2, 1, 'n'],
    [5, 6, 2, 1, 'n'],
    [7, 7, 2, 1, 'n'],
    [9, 6, 2, 1, 'n'],
    [11, 5, 2, 1, 'n'],
    [7, 9, 2, 2, 'r'],
    [2, 12, 12, 1, 'n'],
  ],
} satisfies Record<string, Op[]>;

export type NomeIcone = keyof typeof ICONES;

/** Desenha o ícone com contorno escuro de 1 pixel, ampliado em múltiplo inteiro. */
export function IconePixel({
  nome,
  tamanho = 32,
  titulo,
}: {
  nome: NomeIcone;
  tamanho?: number;
  titulo?: string;
}) {
  const pixels = useMemo(() => {
    const grade: (Cor | '')[][] = Array.from({ length: 16 }, () => Array(16).fill(''));
    for (const [x, y, w, h, cor] of ICONES[nome] as Op[])
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) grade[j][i] = cor;
    const contorno: [number, number][] = [];
    for (let j = 0; j < 16; j++)
      for (let i = 0; i < 16; i++) {
        if (grade[j][i]) continue;
        const vizinhos = [
          grade[j - 1]?.[i],
          grade[j + 1]?.[i],
          grade[j]?.[i - 1],
          grade[j]?.[i + 1],
        ];
        if (vizinhos.some(Boolean)) contorno.push([i, j]);
      }
    return { grade, contorno };
  }, [nome]);
  return (
    <svg
      className="icone-pixel"
      viewBox="0 0 16 16"
      width={tamanho}
      height={tamanho}
      shapeRendering="crispEdges"
      role={titulo ? 'img' : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
    >
      {pixels.contorno.map(([i, j]) => (
        <rect key={`k${i}-${j}`} x={i} y={j} width={1} height={1} fill={PALETA.k} />
      ))}
      {pixels.grade.flatMap((linha, j) =>
        linha.map((cor, i) =>
          cor ? (
            <rect key={`${i}-${j}`} x={i} y={j} width={1} height={1} fill={PALETA[cor]} />
          ) : null,
        ),
      )}
    </svg>
  );
}
