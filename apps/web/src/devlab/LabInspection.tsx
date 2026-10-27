import { useEffect, useMemo, useState } from 'react';
import type { LabReport } from '../../../../packages/simulation/src/lab';
import { EconomicChart } from '../components/EconomicChart';

const cash = (value: number) =>
  (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const outcomeLabels: Record<string, string> = {
  executed: 'Executada',
  rejected: 'Rejeitada',
  blocked: 'Bloqueada',
  idle: 'Sem comando',
};
const sourceLabels: Record<string, string> = {
  director: 'Diretor',
  production: 'Produção',
  supply: 'Abastecimento',
  command: 'Comando',
};
export function LabInspection({ report }: { report: LabReport }) {
  const [day, setDay] = useState(report.options.days),
    [botId, setBotId] = useState(''),
    [productId, setProductId] = useState('');
  const [outcome, setOutcome] = useState(''),
    [query, setQuery] = useState(''),
    [itemMetric, setItemMetric] = useState<'offered' | 'physical' | 'price'>('offered');
  const [eventLimit, setEventLimit] = useState(40);
  useEffect(() => {
    setEventLimit(40);
  }, [report, day, botId, productId, outcome, query]);
  useEffect(() => {
    setDay(report.options.days);
  }, [report]);
  const snapshot =
    report.observations.find((row) => row.day === day) ?? report.observations.at(-1)!;
  const bot = snapshot.bots.find((row) => row.id === botId),
    item = snapshot.items.find((row) => row.id === productId);
  const events = useMemo(
    () =>
      report.trace
        .filter(
          (event) =>
            event.day === day &&
            (!botId || event.companyId === botId) &&
            (!productId || event.productId === productId) &&
            (!outcome || event.outcome === outcome) &&
            `${event.code} ${event.message} ${event.action}`
              .toLocaleLowerCase('pt-BR')
              .includes(query.toLocaleLowerCase('pt-BR')),
        )
        .sort((a, b) => b.count - a.count),
    [report, day, botId, productId, outcome, query],
  );
  const eventsCount = events.reduce((sum, event) => sum + event.count, 0);
  const botChart = useMemo(
    () => ({
      animation: false,
      aria: {
        enabled: true,
        label: { description: `Evolução do caixa e obrigações de ${bot?.name ?? 'empresa'}` },
      },
      legend: {},
      xAxis: { type: 'category', data: report.observations.map((row) => row.day), name: 'Dia' },
      yAxis: { type: 'value', name: 'R$' },
      series: [
        {
          type: 'line',
          name: 'Caixa',
          showSymbol: false,
          data: report.observations.map(
            (row) => (row.bots.find((entry) => entry.id === botId)?.balance ?? 0) / 100,
          ),
        },
        {
          type: 'line',
          name: 'Obrigações',
          showSymbol: false,
          data: report.observations.map(
            (row) => (row.bots.find((entry) => entry.id === botId)?.obligations ?? 0) / 100,
          ),
        },
      ],
    }),
    [report, botId, bot?.name],
  );
  const itemChart = useMemo(
    () => ({
      animation: false,
      aria: { enabled: true, label: { description: `Evolução de ${item?.name ?? 'produto'}` } },
      xAxis: { type: 'category', data: report.observations.map((row) => row.day), name: 'Dia' },
      yAxis: { type: 'value', name: itemMetric === 'price' ? 'R$' : (item?.unit ?? 'Unidades') },
      series: [
        {
          type: 'line',
          name:
            itemMetric === 'offered'
              ? 'Oferta'
              : itemMetric === 'physical'
                ? 'Estoque físico'
                : 'Preço de oferta',
          showSymbol: false,
          data: report.observations.map((row) => {
            const value = row.items.find((entry) => entry.id === productId)?.[itemMetric];
            return value === null || value === undefined
              ? null
              : itemMetric === 'price'
                ? value / 100
                : value;
          }),
        },
      ],
    }),
    [report, productId, itemMetric, item?.unit, item?.name],
  );
  return (
    <section className="lab-panel lab-inspection" aria-label="Consulta por bot, produto e dia">
      <h2>Consultar o que aconteceu</h2>
      <p className="lab-muted">
        Escolha um dia para examinar o estado e os motivos registrados pelo motor. As séries mostram
        a evolução completa desta execução.
      </p>
      <div className="lab-query-fields">
        <label>
          Dia observado
          <input
            type="number"
            min={0}
            max={report.options.days}
            step={1}
            value={day}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isInteger(value) && value >= 0 && value <= report.options.days)
                setDay(value);
            }}
          />
        </label>
        <label>
          Bot observado
          <select value={botId} onChange={(event) => setBotId(event.target.value)}>
            <option value="">Todos os bots</option>
            {snapshot.bots.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Produto observado
          <select value={productId} onChange={(event) => setProductId(event.target.value)}>
            <option value="">Todos os produtos</option>
            {snapshot.items.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="lab-query-summary">
        Consulta no dia {snapshot.day}
        {bot ? ` / ${bot.name}` : ''}
        {item ? ` / ${item.name}` : ''}
      </p>
      {bot && (
        <div className="lab-drilldown">
          <h3>{bot.name}: caixa e obrigações</h3>
          <div className="lab-facts">
            <div>
              <span>Caixa no dia</span>
              <strong>{cash(bot.balance)}</strong>
            </div>
            <div>
              <span>Obrigações</span>
              <strong>{cash(bot.obligations)}</strong>
            </div>
            <div>
              <span>Ativas / pausadas</span>
              <strong>
                {bot.active} / {bot.paused}
              </strong>
            </div>
            <div>
              <span>Tentativas / rejeições</span>
              <strong>
                {num(bot.attempts)} / {num(bot.rejected)}
              </strong>
              <small>Acumuladas até este dia.</small>
            </div>
          </div>
          <EconomicChart
            label={`Evolução do caixa e obrigações de ${bot.name}`}
            option={botChart}
            height={260}
          />
          {bot.lastReasons.length > 0 && (
            <details>
              <summary>Motivos mais recentes desta empresa</summary>
              <ul>
                {bot.lastReasons.map((reason, index) => (
                  <li key={index}>
                    <strong>{outcomeLabels[reason.outcome] ?? reason.outcome}: </strong>
                    {reason.message}{' '}
                    <small>
                      {reason.code} / {sourceLabels[reason.source] ?? reason.source} /{' '}
                      {reason.count} registros
                    </small>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {item && (
        <div className="lab-drilldown">
          <div className="lab-section-head">
            <h3>{item.name}: evolução</h3>
            <label className="lab-inline-field">
              Série do produto
              <select
                value={itemMetric}
                onChange={(event) => setItemMetric(event.target.value as typeof itemMetric)}
              >
                <option value="offered">Oferta anunciada</option>
                <option value="physical">Estoque físico</option>
                <option value="price">Preço de oferta</option>
              </select>
            </label>
          </div>
          <p>
            Dia {snapshot.day}: {num(item.offered)} {item.unit} em oferta, {num(item.physical)}{' '}
            {item.unit} físicos; preço {item.price === null ? 'indisponível' : cash(item.price)}.
          </p>
          <EconomicChart label={`Evolução de ${item.name}`} option={itemChart} height={260} />
        </div>
      )}
      <div className="lab-section-head">
        <h3>Decisões e impedimentos reais</h3>
        <div className="lab-query-event-fields">
          <label>
            Resultado da decisão
            <select value={outcome} onChange={(event) => setOutcome(event.target.value)}>
              <option value="">Todos os resultados</option>
              {Object.entries(outcomeLabels).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </label>
          <label>
            Buscar motivo
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Código, comando ou mensagem…"
            />
          </label>
        </div>
      </div>
      <p className="lab-muted">
        {events.length} grupos, {num(eventsCount)} ocorrências no recorte. Uma linha reúne
        repetições do mesmo motivo no mesmo dia.
      </p>
      {productId && (
        <p className="lab-footnote">
          O filtro de produto inclui apenas eventos que identificam esse produto. Motivos gerais da
          empresa ficam fora do recorte; limpe o produto para vê-los.
        </p>
      )}
      {events.length ? (
        <div className="lab-table-wrap" tabIndex={0} role="region" aria-label="Eventos da consulta">
          <table>
            <thead>
              <tr>
                <th>Empresa / origem</th>
                <th>Resultado</th>
                <th>Ação e motivo observado</th>
                <th>Ocorrências</th>
              </tr>
            </thead>
            <tbody>
              {events.slice(0, eventLimit).map((event, index) => (
                <tr key={index}>
                  <th>
                    {snapshot.bots.find((row) => row.id === event.companyId)?.name ??
                      event.companyId}
                    <small>{sourceLabels[event.source] ?? event.source}</small>
                  </th>
                  <td>{outcomeLabels[event.outcome] ?? event.outcome}</td>
                  <td className="lab-reason-cell">
                    <code>
                      {event.action} / {event.code}
                    </code>
                    <p>{event.message}</p>
                  </td>
                  <td>{num(event.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="lab-empty-query">
          Nenhum evento registrado neste recorte. Mude o dia ou remova filtros. Ausência de registro
          não demonstra ausência de problema.
        </p>
      )}
      {events.length > eventLimit && (
        <div className="lab-section-head">
          <p className="lab-footnote">
            Mostrando {eventLimit} de {events.length} grupos. A busca considera todos os registros
            do recorte.
          </p>
          <button className="secondary" onClick={() => setEventLimit((limit) => limit + 40)}>
            Mostrar mais motivos
          </button>
        </div>
      )}
      <details>
        <summary>Proveniência e repetição deste experimento</summary>
        <p>
          Mesmas opções e mesmo motor são necessários para reproduzir os resultados. O tempo de
          execução varia com o dispositivo.
        </p>
        <p>
          Hash das fontes:{' '}
          <code>
            {report.metadata.sourceFingerprint ?? 'Não anexado nesta execução do navegador.'}
          </code>
        </p>
        <pre>
          {JSON.stringify(
            {
              experiment: report.metadata.experiment,
              replay: report.metadata.replay,
              engineVersion: report.metadata.engineVersion,
            },
            null,
            2,
          )}
        </pre>
      </details>
    </section>
  );
}
