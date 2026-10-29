import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Chave, FORMAS } from './BarrasPixel';
import '../design/grafico.css';

/**
 * Gráfico próprio do Aftermarket. Tudo cai numa grade de 4 px, como pixel art:
 * linha em degraus, área pontilhada em xadrez (verde acima do zero, brasa abaixo),
 * zero desenhado como faixa de estrada e a mira de GPS da landing marcando o ponto lido.
 * Para análises com zoom e velas, continua existindo o EconomicChart.
 */
export type SeriePixel = {
  nome: string;
  valores: number[];
  /** Posição fixa na paleta de séries (1–5). A cor segue a série, nunca a ordem na tela. */
  cor?: 1 | 2 | 3 | 4 | 5;
};

type Props = {
  /** Nome do gráfico para leitores de tela e para a tabela de valores. */
  titulo: string;
  rotulos: string[];
  series: SeriePixel[];
  tipo?: 'linha' | 'barras';
  formato: (valor: number) => string;
  /** Formato curto para o eixo; usa `formato` quando ausente. */
  formatoEixo?: (valor: number) => string;
  altura?: number;
  /** Barra em destaque (por exemplo, hoje). Em série única, a última; -1 não destaca nenhuma. */
  destaque?: number;
  /** Linha de referência horizontal com nome, como a meta do dia. */
  referencia?: { valor: number; rotulo: string };
};

const P = 4; // tamanho do pixel da grade
const snap = (v: number) => v;
const MARGEM = { topo: 16, baixo: 32, esquerda: 72, direita: 16 };

function passoBonito(bruto: number) {
  const base = 10 ** Math.floor(Math.log10(bruto || 1));
  const f = bruto / base;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * base;
}

function escala(series: SeriePixel[], empilhar: boolean, extra?: number) {
  const todos = [
    ...series.flatMap((s) => s.valores),
    ...(extra === undefined ? [] : [extra]),
  ].filter(Number.isFinite);
  let min = Math.min(0, ...todos);
  let max = Math.max(0, ...todos);
  if (empilhar) max = Math.max(max, 0);
  if (min === max) max = min + 1;
  const passo = passoBonito((max - min) / 3);
  min = Math.floor(min / passo) * passo;
  max = Math.ceil(max / passo) * passo;
  const marcas: number[] = [];
  for (let v = min; v <= max + passo / 2; v += passo) marcas.push(Number(v.toFixed(6)));
  return { min, max, marcas };
}

export function GraficoPixel({
  titulo,
  rotulos,
  series,
  tipo = 'linha',
  formato,
  formatoEixo = formato,
  altura = 280,
  destaque,
  referencia,
}: Props) {
  const id = useId().replace(/:/g, '');
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(640);
  const [lido, setLido] = useState<number | null>(null);
  const [tabela, setTabela] = useState(false);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const observar = new ResizeObserver(([e]) => setLargura(Math.max(240, e.contentRect.width)));
    observar.observe(el);
    return () => observar.disconnect();
  }, []);

  const n = rotulos.length;
  const unica = series.length === 1;
  const { min, max, marcas } = useMemo(
    () => escala(series, tipo === 'barras', referencia?.valor),
    [series, tipo, referencia?.valor],
  );
  // Margem do eixo cabe o maior rótulo (Geist Pixel ~7 px por caractere em 11 px).
  const esquerda = Math.max(MARGEM.esquerda, ...marcas.map((m) => formatoEixo(m).length * 7 + 18));
  const plotX0 = esquerda;
  const plotX1 = snap(largura - MARGEM.direita);
  const plotY0 = MARGEM.topo;
  const plotY1 = snap(altura - MARGEM.baixo);
  const y = (v: number) => snap(plotY1 - ((v - min) / (max - min)) * (plotY1 - plotY0));
  const passoX = n > 1 ? (plotX1 - plotX0) / (tipo === 'barras' ? n : n - 1) : 0;
  const x = (i: number) =>
    snap(tipo === 'barras' ? plotX0 + passoX * (i + 0.5) : plotX0 + passoX * i);
  const zero = y(0);

  /** Curva suave que passa por todos os pontos sem inventar picos entre eles. */
  const degraus = (valores: number[]) => {
    const px = valores.map((_, i) => x(i));
    const py = valores.map((v) => y(v));
    const k = valores.length;
    if (k < 2) return `M${px[0] ?? 0} ${py[0] ?? 0}`;
    const d = px.slice(1).map((v, i) => v - px[i]);
    const m = py.slice(1).map((v, i) => (v - py[i]) / (d[i] || 1));
    const t = [m[0]];
    for (let i = 1; i < k - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
    t.push(m[k - 2]);
    let path = `M${px[0]} ${py[0]}`;
    for (let i = 0; i < k - 1; i++) {
      const h = d[i] / 3;
      path += ` C${px[i] + h} ${py[i] + t[i] * h} ${px[i + 1] - h} ${py[i + 1] - t[i + 1] * h} ${px[i + 1]} ${py[i + 1]}`;
    }
    return path;
  };

  const rotulosVisiveis = useMemo(() => {
    const cabem = Math.max(2, Math.floor((plotX1 - plotX0) / (tipo === 'barras' ? 40 : 120)));
    const salto = Math.max(1, Math.ceil(n / cabem));
    return rotulos
      .map((_, i) => i % salto === 0 || i === n - 1)
      .map((v, i, a) => {
        // não deixa o penúltimo rótulo colado no último
        if (i !== n - 1 && v && n - 1 - i < salto / 2) return false;
        // nem o rótulo vizinho ao da barra em destaque ("hoje")
        const d = destaque ?? (series.length === 1 && tipo === 'barras' ? n - 1 : -1);
        if (d >= 0 && i !== d && Math.abs(i - d) * passoX < 64) return false;
        return a[i];
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotulos, n, plotX0, plotX1, tipo, destaque]);

  const indiceDoPonteiro = (clientX: number) => {
    const r = caixa.current?.getBoundingClientRect();
    if (!r || n === 0) return null;
    const px = clientX - r.left;
    const i =
      tipo === 'barras'
        ? Math.floor((px - plotX0) / passoX)
        : Math.round((px - plotX0) / (passoX || 1));
    return Math.min(n - 1, Math.max(0, i));
  };

  const teclas = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const d = e.key === 'ArrowRight' ? 1 : -1;
      setLido((atual) => Math.min(n - 1, Math.max(0, (atual ?? n - 1) + d)));
    } else if (e.key === 'Home') setLido(0);
    else if (e.key === 'End') setLido(n - 1);
    else if (e.key === 'Escape') setLido(null);
  };

  const ultimo = n - 1;
  const dest = destaque ?? (unica && tipo === 'barras' ? ultimo : -1);
  const ativo = lido ?? null;
  const cor = (s: SeriePixel, i: number) => `var(--serie-${s.cor ?? i + 1})`;
  const corLinha = (s: SeriePixel, i: number) => (unica ? 'var(--lavoura)' : cor(s, i));
  const largBarra = Math.max(P, snap((passoX * 0.7) / series.length) - 2);

  const valorPrincipal = unica ? series[0].valores[ativo ?? ultimo] : undefined;
  const pontoX = ativo !== null ? x(ativo) : null;

  return (
    <figure className="gpx" style={{ ['--gpx-altura' as string]: `${altura}px` }}>
      {!unica && (
        <ul className="gpx-legenda" aria-label="Séries">
          {series.map((s, i) => (
            <li key={s.nome}>
              <Chave
                forma={FORMAS[i % FORMAS.length]}
                cor={(s.cor ?? i + 1) as 1 | 2 | 3 | 4 | 5}
              />
              {s.nome}
            </li>
          ))}
        </ul>
      )}
      <div
        ref={caixa}
        className="gpx-quadro"
        tabIndex={0}
        role="img"
        aria-label={`${titulo}. Use as setas para ler cada ponto.`}
        onPointerMove={(e) => setLido(indiceDoPonteiro(e.clientX))}
        onPointerLeave={() => setLido(null)}
        onKeyDown={teclas}
        onBlur={() => setLido(null)}
      >
        <svg width={largura} height={altura} aria-hidden="true">
          <defs>
            {[
              ...series.map((s, i) => ({ k: `s${i}`, c: corLinha(s, i), cima: true })),
              { k: 'neg', c: 'var(--brasa)', cima: false },
            ].map(({ k, c, cima }) => (
              <linearGradient key={k} id={`${id}-${k}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={c} stopOpacity={cima ? 0.5 : 0} />
                <stop offset="1" stopColor={c} stopOpacity={cima ? 0 : 0.5} />
              </linearGradient>
            ))}
            {/* Entrada única: um retângulo que cresce em passos revela o desenho. */}
            <clipPath id={`${id}-revelar`}>
              <rect className="gpx-revelar" x={0} y={0} width={largura} height={altura} />
            </clipPath>
            <clipPath id={`${id}-acima`}>
              <rect x={0} y={0} width={largura} height={zero} />
            </clipPath>
            <clipPath id={`${id}-abaixo`}>
              <rect x={0} y={zero} width={largura} height={altura} />
            </clipPath>
          </defs>

          {marcas.map((m) => (
            <g key={m} className="gpx-marca">
              <line x1={plotX0} x2={plotX1} y1={y(m)} y2={y(m)} />
              <text x={plotX0 - 10} y={y(m) + 4} textAnchor="end">
                {formatoEixo(m)}
              </text>
            </g>
          ))}

          <g className="gpx-desenho" clipPath={`url(#${id}-revelar)`}>
            {tipo === 'linha' &&
              series.map((s, i) => {
                const area = `${degraus(s.valores)} V${zero} H${x(0)} Z`;
                return (
                  <g key={s.nome}>
                    {unica && (
                      <>
                        <path
                          d={area}
                          fill={`url(#${id}-s${i})`}
                          opacity={1}
                          clipPath={`url(#${id}-acima)`}
                        />
                        <path
                          d={area}
                          fill={`url(#${id}-neg)`}
                          opacity={1}
                          clipPath={`url(#${id}-abaixo)`}
                        />
                      </>
                    )}
                    <path
                      d={degraus(s.valores)}
                      className={`gpx-linha${unica ? '' : ` gpx-multi-${Math.min(i, 2)}`}`}
                      stroke={corLinha(s, i)}
                    />
                    {unica && (
                      <path
                        d={degraus(s.valores)}
                        className="gpx-linha"
                        stroke="var(--brasa)"
                        clipPath={`url(#${id}-abaixo)`}
                      />
                    )}
                  </g>
                );
              })}

            {tipo === 'barras' &&
              rotulos.map((_, i) =>
                series.map((s, j) => {
                  const v = s.valores[i] ?? 0;
                  const topo = Math.min(y(v), zero);
                  const alto = Math.abs(y(v) - zero);
                  const bx = snap(
                    x(i) - (largBarra + 2) * (series.length / 2) + j * (largBarra + 2),
                  );
                  const corBarra =
                    v < 0 && unica
                      ? 'var(--brasa)'
                      : unica && i === dest
                        ? 'var(--lavoura)'
                        : cor(s, j);
                  return (
                    <g key={`${i}-${j}`} opacity={ativo === null || ativo === i ? 1 : 0.45}>
                      <rect
                        x={bx}
                        y={topo}
                        width={largBarra}
                        height={Math.max(alto, 2)}
                        rx={Math.min(5, largBarra / 2)}
                        fill={corBarra}
                      />
                      <rect
                        x={bx + 2}
                        y={topo + 2}
                        width={Math.max(2, largBarra / 4)}
                        height={Math.max(0, alto - 4)}
                        rx={1.5}
                        fill="#fff"
                        opacity={0.28}
                      />
                    </g>
                  );
                }),
              )}
          </g>

          <line className="gpx-estrada" x1={plotX0} x2={plotX1} y1={zero} y2={zero} />

          {referencia && (
            <g className="gpx-referencia">
              <line x1={plotX0} x2={plotX1} y1={y(referencia.valor)} y2={y(referencia.valor)} />
              <text x={plotX1 - 4} y={y(referencia.valor) - 6} textAnchor="end">
                {referencia.rotulo}
              </text>
            </g>
          )}

          {/* Série múltipla: o último ponto de cada linha leva a forma da sua chave. */}
          {tipo === 'linha' &&
            !unica &&
            n > 0 &&
            series.map((s, i) => {
              const cx = x(ultimo);
              const cy = y(s.valores[ultimo] ?? 0);
              const f = FORMAS[i % FORMAS.length];
              const c = cor(s, i);
              const r = 6;
              return (
                <g key={s.nome} fill={c} className="gpx-fim">
                  {f === 'quadrado' && (
                    <rect x={cx - r + 1} y={cy - r + 1} width={r * 2 - 2} height={r * 2 - 2} />
                  )}
                  {f === 'losango' && (
                    <polygon
                      points={`${cx},${cy - r - 1} ${cx + r + 1},${cy} ${cx},${cy + r + 1} ${cx - r - 1},${cy}`}
                    />
                  )}
                  {f === 'triangulo' && (
                    <polygon
                      points={`${cx},${cy - r} ${cx + r + 1},${cy + r} ${cx - r - 1},${cy + r}`}
                    />
                  )}
                  {f === 'cruz' && (
                    <path
                      d={`M${cx - 2} ${cy - r}h4v${r - 2}h${r - 2}v4h-${r - 2}v${r - 2}h-4v-${r - 2}h-${r - 2}v-4h${r - 2}z`}
                    />
                  )}
                  {f === 'octogono' && (
                    <rect x={cx - r + 2} y={cy - r + 2} width={r * 2 - 4} height={r * 2 - 4} />
                  )}
                </g>
              );
            })}

          {rotulos.map((r, i) =>
            rotulosVisiveis[i] || i === dest ? (
              <text
                key={i}
                className={i === dest ? 'gpx-rotulo dest' : 'gpx-rotulo'}
                x={x(i)}
                y={altura - 10}
                textAnchor={
                  tipo === 'linha' && i === 0
                    ? 'start'
                    : tipo === 'linha' && i === ultimo
                      ? 'end'
                      : 'middle'
                }
              >
                {r}
              </text>
            ) : null,
          )}

          {tipo === 'linha' && ativo === null && unica && n > 0 && (
            <circle
              className="gpx-ponto"
              cx={x(ultimo)}
              cy={y(series[0].valores[ultimo])}
              r={7}
              fill={series[0].valores[ultimo] < 0 ? 'var(--brasa)' : 'var(--lavoura)'}
              stroke="var(--noite-funda)"
              strokeWidth={3}
            />
          )}

          {pontoX !== null && (
            <g className="gpx-mira" key={ativo}>
              <line className="gpx-guia" x1={pontoX} x2={pontoX} y1={plotY0} y2={plotY1} />
              {series.map((s, i) => {
                const py = y(s.valores[ativo!] ?? 0);
                return (
                  <circle
                    key={s.nome}
                    className="gpx-cantos"
                    cx={pontoX}
                    cy={py}
                    r={8}
                    fill="var(--noite-funda)"
                    stroke={corLinha(s, i)}
                    strokeWidth={4}
                  />
                );
              })}
            </g>
          )}
        </svg>

        {ativo !== null && (
          <div
            className="gpx-leitura"
            style={{
              left: Math.min(Math.max(pontoX! + 18, 8), largura - 200),
              top: MARGEM.topo,
            }}
          >
            <span>{rotulos[ativo]}</span>
            {series.map((s, i) => (
              <b key={s.nome} className={s.valores[ativo] < 0 ? 'neg' : ''}>
                {!unica && (
                  <Chave
                    forma={FORMAS[i % FORMAS.length]}
                    cor={(s.cor ?? i + 1) as 1 | 2 | 3 | 4 | 5}
                  />
                )}
                {!unica && <small>{s.nome}</small>}
                {formato(s.valores[ativo] ?? 0)}
              </b>
            ))}
          </div>
        )}
        {tipo === 'linha' && ativo === null && valorPrincipal !== undefined && (
          <div className={`gpx-agora${valorPrincipal < 0 ? ' neg' : ''}`}>
            <span>agora</span>
            <b>{formato(valorPrincipal)}</b>
          </div>
        )}
      </div>
      <figcaption className="gpx-rodape">
        <button
          type="button"
          className="gpx-tabela-botao"
          aria-pressed={tabela}
          onClick={() => setTabela((v) => !v)}
        >
          {tabela ? 'Ocultar valores' : 'Ver valores'}
        </button>
      </figcaption>
      {tabela && (
        <div className="table-scroll gpx-tabela">
          <table>
            <caption>{titulo}</caption>
            <thead>
              <tr>
                <th scope="col">Momento</th>
                {series.map((s) => (
                  <th key={s.nome} scope="col">
                    {s.nome}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rotulos.map((r, i) => (
                <tr key={i}>
                  <th scope="row">{r}</th>
                  {series.map((s) => (
                    <td key={s.nome}>{formato(s.valores[i] ?? 0)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}
