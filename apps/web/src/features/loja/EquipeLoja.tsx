import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useGame, cr, num } from '../../lib/game';
import { Carimbo } from '../../components/Livro';
import { BotaoEspera } from '../../components/Espera';
import { Ficha } from '../inicio/pecas';
import { contaDaPrateleira } from '../business/precificacao';
import { Cracha, EvolucaoSalarial } from '../business/EquipePecas';
import type { Establishment } from '../../../../../packages/simulation/src/model';
import { laborMarket, operatingCosts } from '../../../../../packages/simulation/src/metrics';
import { retailCapacity } from '../../../../../packages/simulation/src/operations';
import '../../design/inicio-ajustes.css';
import '../../design/equipe.css';
import '../../design/loja-equipe.css';

/** Rodadas econômicas de 2 h num dia de jogo; mesma conta da aba Equipe e do Início. */
const RODADAS_POR_DIA = 12;
const LUGARES = 24;

/** Um cliente na fila do balcão: atendido, que foi embora, ou lugar vago no balcão. */
function Cliente({ estado }: { estado: 'atendido' | 'perdido' }) {
  return (
    <svg
      className={`eql-cliente ${estado}`}
      viewBox="0 0 9 11"
      width="18"
      height="22"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <rect className="c-cabeca" x="2" y="0" width="5" height="4" />
      <rect className="c-corpo" x="1" y="5" width="7" height="6" />
      <rect className="c-sacola" x="6" y="7" width="3" height="3" />
    </svg>
  );
}

/**
 * Equipe da loja como decisão de negócio: a fila do balcão (quem a cidade manda contra quem a
 * equipe atende), a curva do lucro por tamanho de equipe com o ponto de maior lucro e a ficha de
 * contratação com o saldo do dia. A conta é a mesma do Início e da prateleira.
 */
export function EquipeLoja({ loja }: { loja: Establishment }) {
  const { world, run, pending } = useGame();
  const [texto, setTexto] = useState(String(loja.employees));
  useEffect(() => setTexto(String(loja.employees)), [loja.employees]);
  const alvo =
    Number.isInteger(Number(texto)) && Number(texto) >= 0
      ? Math.min(1000, Number(texto))
      : loja.employees;
  const definir = (n: number) => setTexto(String(Math.max(0, Math.min(1000, Math.round(n)))));

  const p = world.properties.find((x) => x.id === loja.propertyId)!;
  const ops = world.season.config.operations;
  const labor = laborMarket(world, p);
  const custos = operatingCosts(world, loja);
  // Custo de mais uma pessoa por dia: folha com encargos, mais o que ela gasta de energia e água.
  const porPessoaDia = useMemo(() => {
    const mais =
      operatingCosts(world, { ...loja, employees: loja.employees + 1 }).total - custos.total;
    return mais > 0
      ? mais
      : Math.round((labor.monthlySalary * world.season.config.parameters.payrollBurden) / 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world.revision, loja.id, loja.employees]);

  const { procura, lucroLoja } = useMemo(() => {
    const conta = contaDaPrateleira(world, loja);
    return {
      procura: conta.itens.reduce((n, x) => n + x.vende, 0) / RODADAS_POR_DIA,
      lucroLoja: conta.agora,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world.revision, loja.id]);
  const espaco = Math.floor(p.area * ops.retailUnitsPerM2);
  const capacidade = (n: number) => Math.min(n * ops.retailUnitsPerWorker, espaco);
  const parte = (n: number) => (procura > 0 ? Math.min(1, capacidade(n) / procura) : 1);
  // Lucro da loja por dia com n pessoas: vendas atendidas menos a folha delas.
  const resultado = (n: number) => lucroLoja * parte(n) - n * porPessoaDia;
  const ideal =
    procura > 0
      ? Math.max(1, Math.ceil(Math.min(procura, espaco) / ops.retailUnitsPerWorker))
      : loja.employees;
  const atende = retailCapacity(world, loja);

  // A curva: de 0 até um pouco além do ideal e da equipe de hoje.
  const nMax = Math.min(40, Math.max(8, ideal * 2, loja.employees + 4, alvo + 2));
  const curva = Array.from({ length: nMax + 1 }, (_, n) => ({ n, v: resultado(n) }));
  const melhor = curva.reduce((a, b) => (b.v > a.v + 1 ? b : a), curva[0]);
  const topo = Math.max(1, ...curva.map((c) => c.v));
  const fundo = Math.min(0, ...curva.map((c) => c.v));
  const alturaDe = (v: number) => (Math.abs(v) / (topo - fundo)) * 100;
  const zero = (topo / (topo - fundo)) * 100;

  // Fila do balcão nesta rodada: cada boneco vale "escala" unidades.
  const maior = Math.max(procura, capacidade(alvo), atende, 1);
  const escala = Math.max(1, Math.ceil(maior / LUGARES));
  const clientes = Math.round(procura / escala);
  const atendidos = Math.min(clientes, Math.round(capacidade(alvo) / escala));
  const balcao = Math.round(capacidade(alvo) / escala);

  const delta = alvo - loja.employees;
  const folhaDelta = delta * porPessoaDia;
  const vendasDelta = lucroLoja * (parte(alvo) - parte(loja.employees));
  const saldo = vendasDelta - folhaDelta;
  const perdaHoje = lucroLoja * (1 - parte(loja.employees));
  const ociosos = Math.max(0, loja.employees - ideal);
  const estado = loja.employees < ideal ? 'falta' : ociosos > 0 ? 'sobra' : 'ok';

  return (
    <div className="eql">
      <header className="eql-cab">
        <div>
          <span className="lv-rotulo">Equipe da loja</span>
          <h3 className="lv-grande">
            {estado === 'falta'
              ? `Faltam ${num(ideal - loja.employees)} pessoas no balcão`
              : estado === 'sobra'
                ? `Sobram ${num(ociosos)} pessoas no balcão`
                : 'Equipe na medida'}
          </h3>
        </div>
        <Carimbo
          tom={estado === 'falta' ? 'brasa' : estado === 'sobra' ? 'ouro' : 'lavoura'}
          giro={-4}
        >
          {estado === 'falta' ? 'falta gente' : estado === 'sobra' ? 'sobra gente' : 'na medida'}
        </Carimbo>
      </header>
      <div className="eql-fichas">
        <Ficha
          rotulo="Equipe"
          tom={estado === 'falta' ? 'brasa' : 'lavoura'}
          valor={`${num(loja.employees)} pessoas`}
        />
        <Ficha rotulo="Clientes por rodada" tom="ouro" valor={`~${num(procura)}`} />
        <Ficha rotulo="A equipe atende" tom="ceu" valor={`${num(atende)} por rodada`} />
        {perdaHoje > 1 ? (
          <Ficha rotulo="Deixa de ganhar" tom="brasa" valor={`−${cr(perdaHoje, 0)} / dia`} />
        ) : (
          ociosos > 0 && (
            <Ficha
              rotulo="Folha ociosa"
              tom="ouro"
              valor={`−${cr(ociosos * porPessoaDia, 0)} / dia`}
            />
          )
        )}
      </div>

      <div className="eql-grade">
        <div className="eql-coluna">
          <section className="eql-bloco" aria-labelledby="eql-fila">
            <h4 id="eql-fila">O balcão numa rodada de 2 horas</h4>
            <div
              className="eql-balcao"
              role="img"
              aria-label={`Cerca de ${num(procura)} clientes por rodada; com ${num(alvo)} pessoas a loja atende ${num(capacidade(alvo))}.`}
            >
              <div className="eql-fila">
                {Array.from({ length: Math.max(clientes, 1) }, (_, i) =>
                  i < clientes ? (
                    <Cliente key={i} estado={i < atendidos ? 'atendido' : 'perdido'} />
                  ) : null,
                )}
              </div>
              <div className="eql-tampo" aria-hidden="true" />
              <div className="eql-atendentes">
                {Array.from({ length: Math.min(LUGARES, Math.max(balcao, 1)) }, (_, i) => (
                  <span key={i} className={`eql-lugar ${i < clientes ? 'ocupado' : 'livre'}`}>
                    <Cracha estado={i < clientes ? 'ok' : 'sobra'} />
                  </span>
                ))}
              </div>
            </div>
            <ul className="eql-legenda">
              <li>
                <Cliente estado="atendido" /> cliente atendido
              </li>
              {clientes > atendidos && (
                <li>
                  <Cliente estado="perdido" /> foi embora sem comprar
                </li>
              )}
              <li>
                <span className="eql-lugar livre mini" /> atendente sem cliente
              </li>
              <li className="eql-escala">cada figura ≈ {num(escala)} unidades</li>
            </ul>
          </section>

          <section className="eql-bloco" aria-labelledby="eql-curva">
            <h4 id="eql-curva">Lucro da loja por tamanho de equipe</h4>
            <p className="eql-nota">
              Vendas que a equipe consegue atender menos a folha. Toque numa barra para testar esse
              tamanho.
            </p>
            <div className="eql-curva" style={{ ['--zero' as string]: `${zero}%` }}>
              <span
                className="eql-zero"
                style={{ top: `calc(18px + (100% - 18px) * ${zero / 100})` }}
                aria-hidden="true"
              />
              {curva.map((c) => (
                <button
                  key={c.n}
                  type="button"
                  className={`eql-barra ${c.v >= 0 ? 'pos' : 'neg'} ${c.n === melhor.n ? 'melhor' : ''} ${c.n === loja.employees ? 'hoje' : ''} ${c.n === alvo ? 'alvo' : ''}`}
                  style={{ ['--a' as string]: `${alturaDe(c.v)}%` }}
                  onClick={() => definir(c.n)}
                  aria-label={`${c.n} ${c.n === 1 ? 'pessoa' : 'pessoas'}: ${c.v >= 0 ? '' : 'prejuízo de '}${cr(Math.abs(c.v), 0)} por dia${c.n === melhor.n ? ', o maior lucro' : ''}${c.n === loja.employees ? ', a equipe de hoje' : ''}`}
                  aria-pressed={c.n === alvo}
                >
                  <i />
                  {(c.n === melhor.n || c.n === loja.employees) && (
                    <em>{c.n === melhor.n ? 'melhor' : 'hoje'}</em>
                  )}
                </button>
              ))}
            </div>
            <div className="eql-eixo" aria-hidden="true">
              <span>0</span>
              <span>{num(Math.round(nMax / 2))}</span>
              <span>{num(nMax)} pessoas</span>
            </div>
            <p className="eql-melhor">
              O maior lucro é com{' '}
              <b>
                {num(melhor.n)} {melhor.n === 1 ? 'pessoa' : 'pessoas'}
              </b>
              : <b className={melhor.v >= 0 ? 'pos' : 'neg'}>{cr(melhor.v, 0)} por dia</b>.
              {melhor.n !== loja.employees && (
                <button className="text-button" onClick={() => definir(melhor.n)}>
                  Testar {num(melhor.n)}
                </button>
              )}
            </p>
          </section>
        </div>

        <aside className="eql-ficha" aria-labelledby="eql-ficha-titulo">
          <header>
            <span className="lv-rotulo">Ficha de contratação</span>
            <h4 id="eql-ficha-titulo" className="lv-grande">
              Quantas pessoas?
            </h4>
          </header>
          <div className="eql-passo">
            <button
              className="secondary"
              aria-label="Uma pessoa a menos"
              disabled={alvo <= 0}
              onClick={() => definir(alvo - 1)}
            >
              <Minus size={18} />
            </button>
            <input
              aria-label="Funcionários desejados"
              type="text"
              inputMode="numeric"
              value={texto}
              onChange={(ev) => /^\d{0,4}$/.test(ev.target.value) && setTexto(ev.target.value)}
              onBlur={() => definir(alvo)}
            />
            <button
              className="secondary"
              aria-label="Uma pessoa a mais"
              onClick={() => definir(alvo + 1)}
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="eql-atalhos">
            {[
              { rotulo: 'Melhor lucro', n: melhor.n },
              { rotulo: 'Atende a procura', n: ideal },
              { rotulo: 'Hoje', n: loja.employees },
            ]
              .filter((x, i, l) => l.findIndex((y) => y.n === x.n) === i)
              .map((x) => (
                <button
                  key={x.rotulo}
                  className={`eql-atalho ${alvo === x.n ? 'on' : ''}`}
                  onClick={() => definir(x.n)}
                >
                  <small>{x.rotulo}</small>
                  <b>{num(x.n)}</b>
                </button>
              ))}
          </div>

          <div className={`eql-bilhete ${delta === 0 ? 'quieto' : ''}`}>
            {delta === 0 ? (
              <p className="lv-mao">Escolha outro tamanho para ver o que muda.</p>
            ) : (
              <>
                <strong>
                  {delta > 0 ? 'Contratar' : 'Dispensar'} {num(Math.abs(delta))}{' '}
                  {Math.abs(delta) === 1 ? 'pessoa' : 'pessoas'}
                </strong>
                <dl>
                  <div>
                    <dt>Folha</dt>
                    <dd className={folhaDelta > 0 ? 'neg' : 'pos'}>
                      {folhaDelta > 0 ? '−' : '+'}
                      {cr(Math.abs(folhaDelta), 0)} / dia
                    </dd>
                  </div>
                  <div>
                    <dt>Vendas atendidas</dt>
                    <dd className={vendasDelta >= 0 ? 'pos' : 'neg'}>
                      {vendasDelta >= 0 ? '+' : '−'}
                      {cr(Math.abs(vendasDelta), 0)} / dia
                    </dd>
                  </div>
                  <div className="saldo">
                    <dt>Saldo do dia</dt>
                    <dd className={saldo >= 0 ? 'pos' : 'neg'}>
                      {saldo >= 0 ? '+' : '−'}
                      {cr(Math.abs(saldo), 0)}
                    </dd>
                  </div>
                </dl>
                <small>Estimativa com os preços e a procura de agora.</small>
              </>
            )}
          </div>
          <BotaoEspera
            className="primary eql-aplicar"
            esperando="Enviando…"
            disabled={pending || delta === 0}
            onClick={() =>
              run(
                { type: 'setWorkforce', establishmentId: loja.id, employees: alvo },
                delta > 0
                  ? `${num(delta)} ${delta === 1 ? 'pessoa contratada' : 'pessoas contratadas'}.`
                  : `${num(-delta)} ${delta === -1 ? 'pessoa dispensada' : 'pessoas dispensadas'}.`,
              )
            }
          >
            {delta > 0
              ? `Contratar ${num(delta)}`
              : delta < 0
                ? `Dispensar ${num(-delta)}`
                : 'Equipe atual'}
          </BotaoEspera>

          <details className="eql-salario">
            <summary>Quanto custa cada pessoa</summary>
            <div className="eql-fichas">
              <Ficha rotulo="Salário" valor={`${cr(labor.monthlySalary, 0)} / mês`} />
              <Ficha rotulo="Com encargos" valor={`${cr(porPessoaDia, 0)} / dia`} />
              <Ficha rotulo="Folha de hoje" valor={`${cr(custos.payroll, 0)} / dia`} />
            </div>
            <p className="eql-nota">
              O salário depende do estado ({p.state}) e de um índice revisto a cada sete dias com a
              folha das empresas.
            </p>
            <EvolucaoSalarial historico={world.stateWages?.[p.state]?.history ?? []} />
          </details>
        </aside>
      </div>
    </div>
  );
}
