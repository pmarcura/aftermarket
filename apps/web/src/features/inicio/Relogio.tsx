import { useGame, num } from '../../lib/game';
import { useClock } from '../../lib/clock';
import { weekdayNames } from '../../../../../packages/simulation/src/operations';
import {
  HOUR_MS,
  MINUTE_MS,
  economicInterval,
  realToGame,
} from '../../../../../packages/simulation/src/clock';
import { agoraDoMundo, dataDoJogo } from './tempo';

const SIGLAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** Parte do dia pela hora do jogo, para o céu e para a frase. */
function turnoDe(hora: number) {
  if (hora < 5) return { nome: 'madrugada', icone: 'lua' };
  if (hora < 12) return { nome: 'manhã', icone: 'sol' };
  if (hora < 18) return { nome: 'tarde', icone: 'sol' };
  return { nome: 'noite', icone: 'lua' };
}

/**
 * O tempo do jogo à vista: a hora corre a cada segundo, o céu mostra a parte do dia, a semana
 * mostra quanto cada dia vende e a barra conta até a próxima rodada da economia, quando vendas,
 * produção e salários são calculados.
 */
export function Relogio() {
  const { world } = useGame();
  const agoraReal = useClock();
  // A hora anda entre as atualizações do servidor, mas nunca passa da próxima rodada.
  const real = Math.min(Math.max(agoraReal, agoraDoMundo(world)), world.nextEconomicAt);
  const data = new Date(dataDoJogo(world, real));
  const hora = data.getUTCHours();
  const minuto = data.getUTCMinutes();
  const diaDaSemana = data.getUTCDay();
  const dia = Math.floor((data.getTime() - world.season.startedAt) / (24 * HOUR_MS)) + 1;
  const pesos = world.season.config.operations.weekday;
  const maior = Math.max(...pesos);
  const peso = pesos[diaDaSemana];
  const intervalo = economicInterval(world);
  const falta = Math.max(0, world.nextEconomicAt - agoraReal);
  const feito = 1 - falta / intervalo;
  const segundos = Math.ceil(falta / 1000);
  const ritmo = realToGame(world, MINUTE_MS) / MINUTE_MS;
  const turno = turnoDe(hora);
  const posicao = ((hora * 60 + minuto) / (24 * 60)) * 100;
  const fraseDoDia =
    peso > 1.001
      ? `${weekdayNames[diaDaSemana]} vende ${num((peso - 1) * 100)}% mais que a média`
      : peso < 0.999
        ? `${weekdayNames[diaDaSemana]} vende ${num((1 - peso) * 100)}% menos que a média`
        : `${weekdayNames[diaDaSemana]} vende na média`;

  return (
    <section className="relogio" aria-labelledby="relogio-titulo">
      <h2 id="relogio-titulo" className="sr-only">
        Relógio do jogo
      </h2>
      <div className="rel-hora">
        <span className="rel-dia lv-rotulo">Dia {dia}</span>
        <b aria-label={`${hora} horas e ${minuto} minutos no jogo`}>
          {String(hora).padStart(2, '0')}
          <i aria-hidden="true">:</i>
          {String(minuto).padStart(2, '0')}
        </b>
        <span className="rel-turno">
          {weekdayNames[diaDaSemana].toLocaleLowerCase('pt-BR')} · {turno.nome}
        </span>
      </div>

      <div className="rel-ceu" aria-hidden="true">
        <span className={`rel-astro ${turno.icone}`} style={{ left: `${posicao}%` }} />
        <span className="rel-marcas">
          <span>0h</span>
          <span>6h</span>
          <span>12h</span>
          <span>18h</span>
          <span>24h</span>
        </span>
      </div>

      <div className="rel-semana">
        <ol aria-label="Quanto cada dia da semana vende">
          {pesos.map((p, i) => (
            <li
              key={SIGLAS[i]}
              className={i === diaDaSemana ? 'hoje' : ''}
              aria-current={i === diaDaSemana ? 'date' : undefined}
              title={`${weekdayNames[i]}: ${num(p * 100)}% da média`}
            >
              <i style={{ height: `${(p / maior) * 100}%` }} />
              <span>{SIGLAS[i]}</span>
            </li>
          ))}
        </ol>
        <p>{fraseDoDia}</p>
      </div>

      <div className="rel-rodada">
        <span className="lv-rotulo">Próxima rodada da economia</span>
        <span className="rel-conta">
          <b>
            {Math.floor(segundos / 60)}:{String(segundos % 60).padStart(2, '0')}
          </b>
          <small>
            vendas, produção e salários a cada{' '}
            {num(world.season.config.clock.economicIntervalGameMs / HOUR_MS)} h de jogo
          </small>
        </span>
        <span className="rel-trilho" aria-hidden="true">
          <i style={{ width: `${feito * 100}%` }} />
        </span>
        <small className="rel-ritmo">1 minuto real = {num(ritmo)} minutos no jogo</small>
      </div>
    </section>
  );
}
