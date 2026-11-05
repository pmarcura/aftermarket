import { useMemo } from 'react';
import { useGame, num } from '../../lib/game';
import { useClock } from '../../lib/clock';
import { Carimbo } from '../../components/Livro';
import { weekdayNames } from '../../../../../packages/simulation/src/operations';
import { HOUR_MS, MINUTE_MS, realToGame } from '../../../../../packages/simulation/src/clock';
import { agoraDoMundo, dataDoJogo } from './tempo';
import '../../design/relogio.css';

const LETRAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

// Cor do céu ao longo do dia: [hora, cor de cima, cor do horizonte].
const CEU: [number, string, string][] = [
  [0, '#0d1420', '#1a2333'],
  [4.5, '#111a2a', '#2a2a3c'],
  [6, '#3a3660', '#d9824a'],
  [7.5, '#4f86b3', '#e8c27a'],
  [12, '#4a8cc4', '#a9d2e6'],
  [16.5, '#4f86b3', '#e3c48a'],
  [18, '#4b3a66', '#e0703f'],
  [19.5, '#1c2238', '#4a3048'],
  [24, '#0d1420', '#1a2333'],
];

const mistura = (a: string, b: string, t: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(' ')})`;
};

function ceuDe(hora: number) {
  const i = CEU.findIndex(([h]) => h > hora);
  const [h0, a0, b0] = CEU[i - 1];
  const [h1, a1, b1] = CEU[i];
  const t = (hora - h0) / (h1 - h0);
  return { alto: mistura(a0, a1, t), horizonte: mistura(b0, b1, t) };
}

// Prédios da janela em pixel: [x, largura, altura], numa grade de 4 px por bloco.
const PREDIOS: [number, number, number][] = [
  [0, 9, 9],
  [9, 6, 14],
  [15, 8, 7],
  [23, 5, 18],
  [28, 10, 11],
  [38, 4, 6],
  [42, 7, 16],
  [49, 9, 10],
  [58, 5, 21],
  [63, 8, 12],
  [71, 6, 8],
  [77, 9, 15],
  [86, 6, 10],
  [92, 8, 13],
];
// Estrelas fixas: [x %, y %].
const ESTRELAS: [number, number][] = [
  [6, 14],
  [14, 32],
  [22, 9],
  [31, 24],
  [40, 12],
  [48, 30],
  [57, 8],
  [66, 22],
  [74, 13],
  [83, 28],
  [91, 10],
];

function Janela({ hora }: { hora: number }) {
  const ceu = ceuDe(hora);
  const dia = hora >= 6 && hora < 18;
  // O astro do momento faz um arco: o sol das 6 às 18 h, a lua das 18 às 6 h.
  const t = dia ? (hora - 6) / 12 : ((hora - 18 + 24) % 24) / 12;
  const x = 6 + t * 88;
  const y = 78 - Math.sin(Math.PI * t) * 62;
  const noite = hora < 5.5 || hora >= 19;
  const janelas = useMemo(
    () =>
      PREDIOS.flatMap(([px, w, h], k) =>
        Array.from({ length: Math.floor(h / 3) * Math.floor(w / 3) }, (_, j) => {
          const col = j % Math.floor(w / 3);
          const lin = Math.floor(j / Math.floor(w / 3));
          return { x: px + 1 + col * 3, y: 24 - h + 1 + lin * 3, aceso: (k * 7 + j * 13) % 5 < 2 };
        }),
      ),
    [],
  );
  return (
    <div
      className={`rel-janela ${noite ? 'noite' : ''}`}
      style={{ ['--alto' as string]: ceu.alto, ['--horizonte' as string]: ceu.horizonte }}
      aria-hidden="true"
    >
      {noite &&
        ESTRELAS.map(([ex, ey]) => (
          <i
            key={`${ex}-${ey}`}
            className="rel-estrela"
            style={{ left: `${ex}%`, top: `${ey}%` }}
          />
        ))}
      <span
        className={`rel-astro ${dia ? 'sol' : 'lua'}`}
        style={{ left: `${x}%`, top: `${y}%` }}
      />
      <svg className="rel-cidade" viewBox="0 0 100 24" preserveAspectRatio="none">
        {PREDIOS.map(([px, w, h]) => (
          <rect key={px} x={px} y={24 - h} width={w} height={h} />
        ))}
        {noite &&
          janelas
            .filter((j) => j.aceso)
            .map((j) => (
              <rect key={`${j.x}-${j.y}`} className="luz" x={j.x} y={j.y} width={1} height={1} />
            ))}
      </svg>
    </div>
  );
}

/**
 * O tempo do jogo como objetos: a folhinha do dia (e quanto ele vende), a janela com o céu da hora
 * e o bilhete picotado que conta até a próxima rodada da economia.
 */
export function Relogio() {
  const { world } = useGame();
  const agoraReal = useClock();
  // A hora anda entre as atualizações do servidor, mas nunca passa da próxima rodada.
  const real = Math.min(Math.max(agoraReal, agoraDoMundo(world)), world.nextEconomicAt);
  const data = new Date(dataDoJogo(world, real));
  const hora = data.getUTCHours();
  const minuto = data.getUTCMinutes();
  const semana = data.getUTCDay();
  const dia = Math.floor((data.getTime() - world.season.startedAt) / (24 * HOUR_MS)) + 1;
  const pesos = world.season.config.operations.weekday;
  const peso = pesos[semana];
  const rodadaJogo = world.season.config.clock.economicIntervalGameMs;
  const faltaJogo = Math.max(0, realToGame(world, world.nextEconomicAt - agoraReal));
  const faltaReal = Math.max(0, world.nextEconomicAt - agoraReal);
  const segundos = Math.ceil(faltaReal / 1000);
  // O bilhete tem um picote a cada 10 minutos de jogo; os destacados já passaram.
  const picotes = Math.max(1, Math.round(rodadaJogo / (10 * MINUTE_MS)));
  const destacados = Math.min(picotes, Math.floor((1 - faltaJogo / rodadaJogo) * picotes));
  const ritmo = realToGame(world, MINUTE_MS) / MINUTE_MS;
  const efeito = Math.round((peso - 1) * 100);

  return (
    <section className="relogio" aria-labelledby="relogio-titulo">
      <h2 id="relogio-titulo" className="sr-only">
        Relógio do jogo
      </h2>

      <div className="rel-folhinha">
        <span className="rel-argolas" aria-hidden="true">
          <i />
          <i />
        </span>
        <span className="rel-dia-rotulo">Dia</span>
        <b className="rel-dia-numero">{dia}</b>
        <span className="rel-semana-nome">{weekdayNames[semana]}</span>
        <span className={`rel-efeito ${efeito > 0 ? 'ganha' : efeito < 0 ? 'perde' : ''}`}>
          <Carimbo tom={efeito > 0 ? 'lavoura' : efeito < 0 ? 'brasa' : 'ouro'} giro={-6}>
            {efeito === 0
              ? 'vendas na média'
              : `${efeito > 0 ? '+' : '−'}${Math.abs(efeito)}% vendas`}
          </Carimbo>
        </span>
        <ol className="rel-letras" aria-label="Quanto cada dia da semana vende">
          {pesos.map((p, i) => (
            <li
              key={i}
              className={i === semana ? 'hoje' : ''}
              title={`${weekdayNames[i]}: ${num(p * 100)}% da média`}
              style={{ ['--p' as string]: p }}
            >
              <i aria-hidden="true" />
              <span>{LETRAS[i]}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="rel-painel">
        <Janela hora={hora + minuto / 60} />
        <p className="rel-hora" aria-label={`${hora} horas e ${minuto} minutos no jogo`}>
          {String(hora).padStart(2, '0')}
          <i aria-hidden="true">:</i>
          {String(minuto).padStart(2, '0')}
        </p>
        <div className="rel-bilhete">
          <span className="rel-bilhete-texto">
            <small>Próxima rodada da economia</small>
            <b className={segundos === 0 ? 'calculando' : ''}>
              {segundos === 0
                ? 'calculando…'
                : `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`}
            </b>
          </span>
          <span className="rel-picotes" aria-hidden="true">
            {Array.from({ length: picotes }, (_, i) => (
              <i key={i} className={i < destacados ? 'ido' : i === destacados ? 'agora' : ''} />
            ))}
          </span>
          <small className="rel-ritmo">
            1 min real = {ritmo >= 60 ? `${num(ritmo / 60)} h` : `${num(ritmo)} min`} de jogo
          </small>
        </div>
      </div>
    </section>
  );
}
