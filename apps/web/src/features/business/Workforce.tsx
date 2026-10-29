import { useMemo, useState } from 'react';
import { GraduationCap, Minus, Plus } from 'lucide-react';
import { useGame, cr, num } from '../../lib/game';
import { type Establishment, type Recipe } from '../../../../../packages/simulation/src/model';
import { laborMarket, operatingCosts } from '../../../../../packages/simulation/src/metrics';
import {
  productionCapacity,
  retailCapacity,
} from '../../../../../packages/simulation/src/operations';
import { trainingQuote } from '../../../../../packages/simulation/src/competition';
import { useClock } from '../../lib/clock';
import { Installation } from './Installation';
import { contaDaPrateleira } from './precificacao';
import {
  Cracha,
  EvolucaoSalarial,
  Legenda,
  Medidor,
  type EstadoEquipe,
  type MarcaMedidor,
} from './EquipePecas';
import '../../design/equipe.css';

const MAX_CRACHAS = 36;
const CELULAS_VENDA = 24;
const RODADAS_POR_DIA = 12;

type Veredito = 'ok' | 'falta' | 'sobra' | 'neutro';
const tomDoVeredito: Record<Veredito, string> = {
  ok: 'lavoura',
  falta: 'brasa',
  sobra: 'ouro',
  neutro: 'apagado',
};
const rotuloDoVeredito: Record<Veredito, string> = {
  ok: 'Equipe na medida',
  falta: 'Falta gente',
  sobra: 'Sobra gente',
  neutro: 'Sem referência',
};

export function Workforce({ establishment: e }: { establishment: Establishment }) {
  const { world, run, pending } = useGame(),
    now = useClock();
  // Unidade recém-instalada: sugere a equipe do perfil da especialidade para todas as linhas.
  const suggested = world.season.config.operations.profiles[e.specialization ?? '']?.workers;
  const [employees, setEmployees] = useState(
      String(e.employees === 0 && suggested ? suggested * (e.equipmentLines ?? 1) : e.employees),
    ),
    [confirm, setConfirm] = useState(false);
  const p = world.properties.find((p) => p.id === e.propertyId)!,
    cfg = world.season.config,
    labor = laborMarket(world, p),
    costs = operatingCosts(world, e),
    count = Number(employees),
    valid = Number.isInteger(count) && count >= 0 && count <= 1000,
    alvo = valid ? count : e.employees,
    depois = { ...e, employees: alvo };
  const projected = operatingCosts(world, depois),
    training = trainingQuote(world, e),
    active = world.training?.find((t) => t.establishmentId === e.id && !t.completed),
    history = world.stateWages?.[p.state]?.history ?? [];
  const varejo = e.category === 'retail';
  const receitas = cfg.recipes.filter((r) => r.category === e.category);
  const principal =
    receitas.find((r) => r.id === e.specialization) ?? (receitas.length === 1 ? receitas[0] : null);

  // Custo de mais uma pessoa por dia: folha com encargos, mais a energia e a água fixas dela.
  const porPessoaDia = useMemo(() => {
    const mais = operatingCosts(world, { ...e, employees: e.employees + 1 }).total - costs.total;
    return mais > 0 ? mais : Math.round((labor.monthlySalary * cfg.parameters.payrollBurden) / 30);
  }, [world, e, costs.total, labor.monthlySalary, cfg.parameters.payrollBurden]);

  // Procura estimada da loja por rodada de 2 h, pela mesma conta da prateleira (preço atual).
  const procuraRodada = useMemo(
    () =>
      varejo
        ? contaDaPrateleira(world, e).itens.reduce((n, x) => n + x.vende, 0) / RODADAS_POR_DIA
        : 0,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.revision, e.id, varejo],
  );
  const porPessoaRodada = cfg.operations.retailUnitsPerWorker;
  const limiteEspaco = varejo ? Math.floor(p.area * cfg.operations.retailUnitsPerM2) : 0;
  const capAgora = varejo ? retailCapacity(world, e) : 0;
  const capDepois = varejo ? retailCapacity(world, depois) : 0;

  // Equipe ideal: a loja pela procura (limitada pelo espaço); a produção pelas linhas instaladas.
  const capProd = principal ? productionCapacity(world, e, principal) : null;
  const capProdDepois = principal ? productionCapacity(world, depois, principal) : null;
  const linhasInstaladas = principal ? (e.equipmentLines ?? capProd?.areaLines ?? 0) : 0;
  let ideal: number | null = null;
  if (varejo && procuraRodada > 0)
    ideal = Math.max(1, Math.ceil(Math.min(procuraRodada, limiteEspaco) / porPessoaRodada));
  else if (principal && capProd && capProd.workers > 0 && linhasInstaladas > 0)
    ideal = capProd.workers * linhasInstaladas;

  let veredito: Veredito = 'neutro';
  let frase = 'Contrate para ver quanto a equipe consegue atender.';
  if (varejo && ideal !== null) {
    if (capAgora < procuraRodada * 0.98 && capAgora < limiteEspaco) {
      veredito = 'falta';
      frase = `Falta gente: a loja atende cerca de ${num(capAgora)} un por rodada e a procura é de ${num(procuraRodada)}. Você perde vendas.`;
    } else if (limiteEspaco < procuraRodada && capAgora >= limiteEspaco) {
      veredito = 'ok';
      frase = `O espaço da loja limita as vendas em ${num(limiteEspaco)} un por rodada. Mais gente não ajuda.`;
    } else if (e.employees > ideal) {
      veredito = 'sobra';
      frase = `Sobram ${num(e.employees - ideal)} ${e.employees - ideal === 1 ? 'pessoa' : 'pessoas'} para a procura de agora: cerca de ${cr((e.employees - ideal) * porPessoaDia, 0)} por dia.`;
    } else {
      veredito = 'ok';
      frase = 'Equipe na medida para a procura de agora.';
    }
  } else if (principal && capProd && ideal !== null) {
    if (capProd.lines < linhasInstaladas) {
      veredito = capProd.laborLines < linhasInstaladas ? 'falta' : 'neutro';
      frase =
        capProd.laborLines < linhasInstaladas
          ? `Falta gente: ${capProd.lines} de ${linhasInstaladas} ${linhasInstaladas === 1 ? 'linha roda' : 'linhas rodam'}. Faltam ${num(ideal - e.employees)} pessoas para todas.`
          : `${capProd.bottleneck}: ${capProd.lines} de ${linhasInstaladas} linhas rodam, e mais gente não resolve.`;
    } else if (e.employees > ideal) {
      veredito = 'sobra';
      frase = `Todas as linhas rodam e sobram ${num(e.employees - ideal)} pessoas: cerca de ${cr((e.employees - ideal) * porPessoaDia, 0)} por dia.`;
    } else {
      veredito = 'ok';
      frase = 'Todas as linhas instaladas têm equipe.';
    }
  }

  // Crachás: quem fica, quem entra, quem sai e quem falta.
  const nAtual = e.employees;
  const total = Math.max(nAtual, alvo, ideal ?? 0);
  const mostrados = Math.min(total, MAX_CRACHAS);
  const crachas: Exclude<EstadoEquipe, 'vazio'>[] = Array.from({ length: mostrados }, (_, i) => {
    if (i < Math.min(nAtual, alvo)) return ideal !== null && i >= ideal ? 'sobra' : 'ok';
    if (i < alvo) return 'entra';
    if (i < nAtual) return 'sai';
    return 'falta';
  });
  const escondidos = total - mostrados;
  const estadosCrachas = (['ok', 'entra', 'sai', 'falta', 'sobra'] as const).filter((s) =>
    crachas.includes(s),
  );

  // Medidor da loja (unidades por rodada) ou das linhas (produção).
  let celulas: EstadoEquipe[] = [];
  const marcas: MarcaMedidor[] = [];
  let descricaoMedidor = '';
  let tituloMedidor = '';
  let rodapeMedidor = '';
  if (varejo) {
    tituloMedidor = 'Quanto a equipe atende por rodada';
    // O limite do espaço só entra na escala quando está perto da procura; senão achata os blocos.
    const espacoPerto = limiteEspaco < procuraRodada * 1.6;
    const escala =
      Math.max(capAgora, capDepois, procuraRodada, espacoPerto ? limiteEspaco : 0, 1) * 1.1;
    celulas = Array.from({ length: CELULAS_VENDA }, (_, i) => {
      const meio = ((i + 0.5) / CELULAS_VENDA) * escala;
      const a = meio <= capAgora,
        d = meio <= capDepois;
      if (a && d) return meio <= procuraRodada ? 'ok' : 'sobra';
      if (a) return 'sai';
      if (d) return 'entra';
      return meio <= Math.min(procuraRodada, limiteEspaco) ? 'falta' : 'vazio';
    });
    if (procuraRodada > 0)
      marcas.push({ pos: procuraRodada / escala, rotulo: 'procura', tom: 'ouro', lado: 'cima' });
    if (espacoPerto)
      marcas.push({ pos: limiteEspaco / escala, rotulo: 'espaço', tom: 'ceu', lado: 'baixo' });
    descricaoMedidor = `A equipe atende ${num(capAgora)} unidades por rodada; a procura estimada é ${num(procuraRodada)}`;
    rodapeMedidor =
      capDepois !== capAgora
        ? `Com a mudança: ${num(capDepois)} un por rodada (hoje ${num(capAgora)}).`
        : `Cada pessoa atende ${num(porPessoaRodada, 1)} un por rodada de 2 h.`;
  } else if (principal && capProd) {
    tituloMedidor = `Linhas rodando · ${principal.name}`;
    const slots = Math.min(Math.max(linhasInstaladas, 1), 20);
    celulas = Array.from({ length: slots }, (_, i) => {
      const a = i < capProd.lines,
        d = i < (capProdDepois?.lines ?? 0);
      if (a && d) return 'ok';
      if (a) return 'sai';
      if (d) return 'entra';
      return e.equipmentLines !== undefined ? 'falta' : 'vazio';
    });
    descricaoMedidor = `${capProd.lines} de ${linhasInstaladas} linhas rodando`;
    rodapeMedidor =
      (capProdDepois?.lines ?? 0) !== capProd.lines
        ? `Com a mudança: ${capProdDepois?.lines ?? 0} de ${linhasInstaladas} linhas (hoje ${capProd.lines}).`
        : `Cada linha pede ${capProd.workers} pessoas e ${num(capProd.areaM2)} m².`;
  }
  const estadosMedidor = (['ok', 'sobra', 'falta', 'entra', 'sai'] as const).filter((s) =>
    celulas.includes(s),
  );

  // Recibo da mudança, antes de aplicar.
  const delta = alvo - e.employees;
  const deltaDia = projected.total - costs.total;
  const bloqueado = Boolean(active);
  const restante = active ? Math.max(0, Math.ceil((active.finishesAt - now) / 1000)) : 0;
  const efeito = varejo
    ? capDepois !== capAgora
      ? `${capDepois > capAgora ? 'atende +' : 'atende −'}${num(Math.abs(capDepois - capAgora))} un por rodada`
      : null
    : capProdDepois && capProd && capProdDepois.lines !== capProd.lines
      ? `${capProdDepois.lines > capProd.lines ? '+' : '−'}${Math.abs(capProdDepois.lines - capProd.lines)} ${Math.abs(capProdDepois.lines - capProd.lines) === 1 ? 'linha' : 'linhas'}`
      : null;
  const ajustarPara = (n: number) => setEmployees(String(Math.min(1000, Math.max(0, n))));
  const reguaMax = Math.max(40, (ideal ?? 0) * 2, e.employees * 2);

  return (
    <div className="eq">
      <header className="eq-cab">
        <div>
          <h3>Sua equipe</h3>
          <p>{frase}</p>
        </div>
        <span className={`eq-selo tom-${tomDoVeredito[veredito]}`}>
          {rotuloDoVeredito[veredito]}
        </span>
      </header>

      <div className="eq-grade">
        <div className="eq-coluna">
          <section className="eq-bloco eq-palco" aria-labelledby="eq-crachas">
            <h4 id="eq-crachas">
              {num(e.employees)} {e.employees === 1 ? 'pessoa contratada' : 'pessoas contratadas'}
              {ideal !== null && <small>ideal agora: {num(ideal)}</small>}
            </h4>
            {total > 0 ? (
              <div
                className="eq-crachas"
                role="img"
                aria-label={`${num(e.employees)} contratados${ideal !== null ? `, ideal ${num(ideal)}` : ''}`}
              >
                {crachas.map((estado, i) => (
                  <Cracha key={i} estado={estado} />
                ))}
                {escondidos > 0 && <span className="eq-mais">+{num(escondidos)}</span>}
              </div>
            ) : (
              <p className="eq-vazio">Ninguém contratado ainda. Escolha quantas pessoas abaixo.</p>
            )}
            {estadosCrachas.length > 0 && <Legenda estados={estadosCrachas} />}
          </section>

          {celulas.length > 0 && (
            <section className="eq-bloco" aria-labelledby="eq-medidor">
              <h4 id="eq-medidor">{tituloMedidor}</h4>
              <Medidor celulas={celulas} marcas={marcas} descricao={descricaoMedidor} />
              {estadosMedidor.length > 0 && <Legenda estados={estadosMedidor} />}
              <p className="eq-nota">{rodapeMedidor}</p>
            </section>
          )}

          <section className="eq-bloco eq-ajuste" aria-labelledby="eq-ajuste">
            <h4 id="eq-ajuste">Quantas pessoas?</h4>
            <div className="eq-passo">
              <button
                className="secondary"
                aria-label="Uma pessoa a menos"
                disabled={count <= 0}
                onClick={() => ajustarPara(count - 1)}
              >
                <Minus size={18} />
              </button>
              <input
                aria-label="Funcionários desejados"
                type="number"
                inputMode="numeric"
                min="0"
                max="1000"
                value={employees}
                onChange={(ev) => setEmployees(ev.target.value)}
              />
              <button
                className="secondary"
                aria-label="Uma pessoa a mais"
                onClick={() => ajustarPara(count + 1)}
              >
                <Plus size={18} />
              </button>
            </div>
            <input
              className="eq-regua"
              aria-label="Régua de funcionários"
              type="range"
              min="0"
              max={reguaMax}
              value={Math.min(reguaMax, count || 0)}
              onChange={(ev) => setEmployees(ev.target.value)}
            />
            <div className="eq-atalhos">
              {ideal !== null && alvo !== ideal && (
                <button className="text-button" onClick={() => ajustarPara(ideal)}>
                  Usar a equipe ideal ({num(ideal)})
                </button>
              )}
              {delta !== 0 && (
                <button className="text-button" onClick={() => ajustarPara(e.employees)}>
                  Voltar para {num(e.employees)}
                </button>
              )}
            </div>

            <div
              className={`eq-recibo ${delta === 0 ? 'quieto' : delta > 0 ? 'contrata' : 'dispensa'}`}
            >
              {!valid ? (
                <strong>Use um número inteiro de 0 a 1.000.</strong>
              ) : delta === 0 ? (
                <strong>Sem mudança. A equipe fica como está.</strong>
              ) : (
                <>
                  <strong>
                    {delta > 0 ? 'Contratar' : 'Dispensar'} {num(Math.abs(delta))}{' '}
                    {Math.abs(delta) === 1 ? 'pessoa' : 'pessoas'}
                  </strong>
                  <ul>
                    <li className={deltaDia > 0 ? 'custo' : 'economia'}>
                      {deltaDia > 0 ? '+' : '−'}
                      {cr(Math.abs(deltaDia), 0)} por dia
                    </li>
                    {efeito && <li>{efeito}</li>}
                  </ul>
                </>
              )}
            </div>
            <button
              className="primary eq-aplicar"
              disabled={pending || !valid || delta === 0 || bloqueado}
              onClick={() =>
                void run(
                  { type: 'setWorkforce', establishmentId: e.id, employees: count },
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
                  : 'Aplicar equipe'}
            </button>
            {bloqueado && (
              <p className="eq-aviso">
                A equipe fica travada durante o treinamento (faltam {num(restante)} s reais).
              </p>
            )}
          </section>
        </div>

        <div className="eq-coluna">
          <section className="eq-bloco eq-custos" aria-labelledby="eq-custos">
            <h4 id="eq-custos">Quanto custa</h4>
            <dl>
              <div>
                <dt>Cada pessoa</dt>
                <dd>
                  {cr(labor.monthlySalary, 0)}
                  <small>por mês de salário</small>
                </dd>
              </div>
              <div>
                <dt>Com encargos</dt>
                <dd>
                  {cr(porPessoaDia, 0)}
                  <small>por dia, por pessoa</small>
                </dd>
              </div>
              <div>
                <dt>Equipe toda</dt>
                <dd>
                  {cr(costs.payroll, 0)}
                  <small>
                    de folha por dia
                    {delta !== 0 && valid && ` → ${cr(projected.payroll, 0)}`}
                  </small>
                </dd>
              </div>
            </dl>
            <details className="eq-como">
              <summary>Como o salário é calculado</summary>
              <ol className="eq-conta">
                <li>
                  <span>Base da atividade</span>
                  <b>{cr(cfg.salaries[p.category] ?? 0, 0)}</b>
                </li>
                <li>
                  <span>Estado {p.state}</span>
                  <b>{num(labor.factor, 2)}×</b>
                </li>
                <li>
                  <span>Índice da temporada</span>
                  <b>{num(labor.index, 3)}×</b>
                </li>
                <li>
                  <span>Encargos</span>
                  <b>+{num((cfg.parameters.payrollBurden - 1) * 100)}%</b>
                </li>
              </ol>
              <p className="eq-nota">
                Todos os trabalhadores estão disponíveis em qualquer praça. O índice é revisto a
                cada sete dias de jogo com a folha das empresas.
              </p>
              <h5>Índice salarial em {p.state}</h5>
              <EvolucaoSalarial historico={history} />
            </details>
          </section>

          {['industry', 'farm', 'mine'].includes(e.category) && (
            <section className="eq-bloco eq-treino" aria-labelledby="eq-treino">
              <h4 id="eq-treino">
                <GraduationCap size={18} aria-hidden="true" /> Formação da equipe
              </h4>
              <div
                className="eq-niveis"
                role="img"
                aria-label={`Formação média ${num(e.education ?? 0, 1)} de 5`}
              >
                {[0, 1, 2, 3, 4].map((i) => (
                  <i key={i}>
                    <b
                      style={{
                        width: `${Math.min(1, Math.max(0, (e.education ?? 0) - i)) * 100}%`,
                      }}
                    />
                  </i>
                ))}
                <span>{num(e.education ?? 0, 1)} de 5</span>
              </div>
              {active ? (
                <div className="eq-treinando">
                  <strong>Treinando para o nível {active.targetLevel}</strong>
                  <div className="eq-progresso" aria-hidden="true">
                    {Array.from({ length: 16 }, (_, i) => (
                      <i
                        key={i}
                        className={
                          i / 16 < 1 - restante / Math.max(1, training.durationMs / 1000)
                            ? 'on'
                            : ''
                        }
                      />
                    ))}
                  </div>
                  <small>Faltam {num(restante)} s reais. A produção continua.</small>
                </div>
              ) : training.targetLevel > 5 ? (
                <p className="eq-vazio">Formação máxima atingida.</p>
              ) : (
                <>
                  <p className="eq-nota">
                    Próximo passo: <b>nível {training.targetLevel}</b>. Melhora só os lotes novos; o
                    estoque mantém a qualidade que já tem.
                  </p>
                  <dl className="eq-fatos">
                    <div>
                      <dt>Custo</dt>
                      <dd>{cr(training.cost, 0)}</dd>
                    </div>
                    <div>
                      <dt>Duração</dt>
                      <dd>{cfg.competition.educationHours} h de jogo</dd>
                    </div>
                    <div>
                      <dt>Qualidade</dt>
                      <dd>+{num(training.qualityGain, 1)} pts</dd>
                    </div>
                  </dl>
                  <p className="eq-nota">
                    Quem entra depois chega sem formação e baixa a média da equipe.
                  </p>
                  {!confirm ? (
                    <button
                      className="secondary"
                      disabled={pending || e.employees === 0}
                      onClick={() => setConfirm(true)}
                    >
                      Treinar equipe · {cr(training.cost, 0)}
                    </button>
                  ) : (
                    <div className="eq-confirma">
                      <p>
                        Pagar <b>{cr(training.cost, 0)}</b> agora. A equipe fica travada até o fim
                        do treinamento.
                      </p>
                      <div>
                        <button className="secondary" onClick={() => setConfirm(false)}>
                          Cancelar
                        </button>
                        <button
                          className="primary"
                          disabled={pending}
                          onClick={async () => {
                            if (
                              await run(
                                { type: 'trainWorkforce', establishmentId: e.id },
                                'Educação paga. Treinamento iniciado.',
                              )
                            )
                              setConfirm(false);
                          }}
                        >
                          Pagar e iniciar
                        </button>
                      </div>
                    </div>
                  )}
                  {e.employees === 0 && (
                    <p className="eq-aviso">Contrate gente antes de treinar.</p>
                  )}
                </>
              )}
            </section>
          )}

          <OutrasReceitas receitas={receitas} principal={principal} e={e} />

          {e.equipmentLines !== undefined && (
            <details className="eq-bloco eq-equipamento">
              <summary>Equipamentos e capacidade</summary>
              <Installation establishment={e} />
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

/** As demais receitas que a mesma estrutura pode rodar, recolhidas: o ideal acima já usa a principal. */
function OutrasReceitas({
  receitas,
  principal,
  e,
}: {
  receitas: Recipe[];
  principal: Recipe | null;
  e: Establishment;
}) {
  const { world } = useGame();
  const outras = receitas.filter((r) => r.id !== principal?.id);
  if (e.category === 'retail' || outras.length === 0) return null;
  return (
    <details className="eq-bloco eq-outras">
      <summary>
        {principal ? 'Outras receitas' : 'Capacidade por receita'} ({outras.length})
      </summary>
      <ul>
        {outras.map((r) => {
          const c = productionCapacity(world, e, r);
          return (
            <li key={r.id}>
              <strong>{r.name}</strong>
              <span className={c.lines ? 'tom-lavoura' : 'tom-ouro'}>
                {c.lines} {c.lines === 1 ? 'linha' : 'linhas'}
              </span>
              <small>
                {c.workers} pessoas + {num(c.areaM2)} m² por linha · limite {c.laborLines} pela
                equipe, {c.areaLines} pela área
                {c.lines === 0 ? ` · ${c.bottleneck}` : ''}
              </small>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
