/**
 * Leva as cores escritas à mão nas folhas de estilo antigas para a temperatura da identidade
 * (grafite esverdeado da landing). Só mexe em neutros frios: fundos, bordas e textos apagados
 * em tom de azul-marinho. Acentos (ouro, verde, vermelho, azul de logística) ficam como estão.
 * Mantém a luminosidade de cada cor, então os contrastes desenhados em cada tela se preservam.
 *
 *   npx tsx scripts/retemperar-cores.ts            # mostra o que mudaria
 *   npx tsx scripts/retemperar-cores.ts --aplicar  # grava
 *
 * Cores que restarem escritas à mão migram para variáveis tela a tela (ver `npm run ui:cores`).
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ARQUIVOS = [
  'apps/web/src/styles.css',
  'apps/web/src/economy.css',
  'apps/web/src/business.css',
  'apps/web/src/competition.css',
  'apps/web/src/analysis.css',
  'apps/web/src/negocios.css',
  'apps/web/src/design/identidade.css',
];

// Matiz e croma do grafite da landing (#1a1d17 ≈ oklch(0.22 0.012 125)).
const MATIZ = 125;
const CROMA_MAX = 0.016;

type Lab = [number, number, number];

function hexParaRgb(hex: string): [number, number, number] {
  const h = hex.length === 4 ? hex.replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3') : hex;
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}
const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gama = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function rgbParaOklab([r, g, b]: [number, number, number]): Lab {
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabParaHex([L, a, b]: Lab): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return (
    '#' +
    rgb
      .map((c) =>
        Math.round(Math.min(1, Math.max(0, gama(c))) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/** Devolve a cor no grafite, ou null quando ela não é um neutro frio. */
export function retemperar(hex: string): string | null {
  const [L, a, b] = rgbParaOklab(hexParaRgb(hex));
  const C = Math.hypot(a, b);
  const H = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  const neutroFrio = C < 0.07 && H > 195 && H < 300;
  // Textos claros levemente azulados viram creme/apagado; acentos azuis vivos ficam.
  if (!neutroFrio) return null;
  const croma = Math.min(C * 0.5, CROMA_MAX);
  const rad = (MATIZ * Math.PI) / 180;
  return oklabParaHex([L, croma * Math.cos(rad), croma * Math.sin(rad)]);
}

const aplicar = process.argv.includes('--aplicar');
let total = 0;
for (const arquivo of ARQUIVOS) {
  const texto = readFileSync(arquivo, 'utf8');
  const trocas = new Map<string, string>();
  const novo = texto.replace(
    /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?:([0-9a-fA-F]{2}))?\b/g,
    (cor, base, alfa) => {
      const nova = retemperar(`#${base}`);
      if (!nova) return cor;
      trocas.set(`#${base}`, nova);
      return nova + (alfa ?? '');
    },
  );
  const n = texto === novo ? 0 : [...texto.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].length;
  total += trocas.size;
  console.log(`${arquivo}: ${trocas.size} cores retemperadas${n ? '' : ''}`);
  if (!aplicar) for (const [de, para] of trocas) console.log(`  ${de} → ${para}`);
  if (aplicar && texto !== novo) writeFileSync(arquivo, novo);
}
console.log(
  aplicar ? `Gravado: ${total} cores.` : `Prévia: ${total} cores. Use --aplicar para gravar.`,
);
