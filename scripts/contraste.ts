/**
 * Confere o contraste (WCAG 2.2) dos pares de cor que o jogo usa: texto sobre fundo e cor de
 * função sobre fundo. Texto normal precisa de 4,5:1; texto grande (18 px ou 14 px em negrito) e
 * elementos de interface precisam de 3:1. Lê as variáveis de apps/web/src/design/identidade.css.
 *
 *   npm run ui:contraste
 */
import { readFileSync } from 'node:fs';

const css = readFileSync('apps/web/src/design/identidade.css', 'utf8');
const token = (nome: string) => {
  const m = css.match(new RegExp(`--${nome}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`Variável --${nome} não achada`);
  return m[1];
};

const luz = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const razao = (a: string, b: string) => {
  const [x, y] = [luz(a), luz(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

type Par = { texto: string; fundo: string; uso: string; minimo?: number };
const pares: Par[] = [
  // texto corrido e rótulos sobre as superfícies
  ...['noite', 'noite-funda', 'chapa', 'chapa-2', 'chapa-3'].flatMap((f) => [
    { texto: 'creme', fundo: f, uso: 'texto principal' },
    { texto: 'apagado', fundo: f, uso: 'texto secundário' },
    { texto: 'lavoura', fundo: f, uso: 'ação, bom resultado' },
    { texto: 'ouro', fundo: f, uso: 'dinheiro e preço' },
    { texto: 'brasa', fundo: f, uso: 'alerta e prejuízo' },
    { texto: 'ceu', fundo: f, uso: 'logística e informação' },
  ]),
  // texto escuro sobre cores de função (selos, botões, etiquetas)
  ...['lavoura', 'ouro', 'brasa', 'ceu', 'apagado', 'creme'].map((f) => ({
    texto: 'noite',
    fundo: f,
    uso: 'selo/botão com a cor de função',
  })),
  // elementos gráficos sobre o fundo do gráfico (mínimo 3:1)
  ...['serie-1', 'serie-2', 'serie-3', 'serie-4', 'serie-5'].map((t) => ({
    texto: t,
    fundo: 'chapa',
    uso: 'série de gráfico',
    minimo: 3,
  })),
  { texto: 'borda-forte', fundo: 'chapa', uso: 'borda de controle', minimo: 3 },
];

let falhas = 0;
const linhas = pares.map((p) => {
  const t = token(p.texto);
  const f = token(p.fundo);
  const r = razao(t, f);
  const min = p.minimo ?? 4.5;
  const ok = r >= min;
  if (!ok) falhas++;
  return `${ok ? 'ok   ' : 'FALHA'}  ${r.toFixed(2).padStart(5)}:1  (mín ${min})  ${p.texto} sobre ${p.fundo}  · ${p.uso}`;
});
console.log(linhas.join('\n'));
console.log(falhas ? `\n${falhas} par(es) abaixo do mínimo.` : '\nTodos os pares passam.');
process.exit(falhas ? 1 : 0);
