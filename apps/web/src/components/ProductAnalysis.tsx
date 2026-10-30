import { useEffect, useMemo, useState } from 'react';
import { Download, Info, SlidersHorizontal, ArrowUpRight } from 'lucide-react';
import type { EChartsCoreOption } from 'echarts/core';
import { useGame, cr, num } from '../lib/game';
import { Badge, Empty, Modal, Rows, Select, Tabs } from './ui';
import { EconomicChart } from './EconomicChart';
import {
  products,
  TIME_SCALE,
  type Entry,
  type MarketSample,
  type ProductId,
} from '../../../../packages/simulation/src/model';
import { marketView, seasonPrice } from '../../../../packages/simulation/src/metrics';

/** Cor do tema em hex, lida das variáveis de design.css; o canvas do gráfico não aceita var(). */
const tema = (nome: string) =>
  getComputedStyle(document.documentElement)
    .getPropertyValue('--' + nome)
    .trim() || 'black';
const comAlfa = (hex: string, alfa: string) => (hex.length === 7 ? hex + alfa : hex);

interface History {
  samples: MarketSample[];
  trades: Entry[];
  startedAt: number;
}
export function ProductAnalysis({
  product,
  regionId = '',
  radiusKm = 120,
  advanced = false,
}: {
  product: ProductId;
  regionId?: string;
  radiusKm?: number;
  advanced?: boolean;
}) {
  const { world, notice, openMarket } = useGame(),
    item = products[product],
    market = marketView(world, product, regionId, radiusKm);
  const [expanded, setExpanded] = useState(advanced),
    [tab, setTab] = useState('Preço e volume'),
    [history, setHistory] = useState<History>(),
    [loading, setLoading] = useState(true),
    [failed, setFailed] = useState(false);
  const [period, setPeriod] = useState(''),
    [kind, setKind] = useState('line'),
    [average, setAverage] = useState(false),
    [log, setLog] = useState(false),
    [table, setTable] = useState(false);
  const reference = world.season.config.priceBands[product];
  useEffect(() => {
    let active = true;
    const update = () =>
      fetch(`/api/market-history?product=${product}&region=${regionId}`)
        .then((r) => {
          if (!r.ok) throw new Error('Falha no histórico');
          return r.json() as Promise<History>;
        })
        .then((value) => {
          if (active) {
            setHistory(value);
            setFailed(false);
          }
        })
        .catch(() => {
          if (active) setFailed(true);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    setLoading(true);
    void update();
    const timer = setInterval(() => void update(), 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [product, regionId]);
  const data = useMemo(() => {
    const since = period ? Date.now() - (Number(period) * 3600000) / TIME_SCALE : 0;
    return (history?.samples ?? []).filter((s) => s.at >= since);
  }, [history, period]);
  const gameTime = (at: number) =>
    new Date(world.createdAt + (at - world.createdAt) * TIME_SCALE).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  const candles = useMemo(() => {
    const buckets = new Map<number, { at: number; prices: number[]; volume: number }>();
    for (const trade of history?.trades ?? []) {
      if (period && trade.at < Date.now() - (Number(period) * 3600000) / TIME_SCALE) continue;
      const at = Math.floor(trade.at / 60000) * 60000,
        bucket = buckets.get(at) ?? { at, prices: [], volume: 0 };
      bucket.prices.push((trade.unitPrice ?? 0) / 100);
      bucket.volume += trade.quantity ?? 0;
      buckets.set(at, bucket);
    }
    return [...buckets.values()].sort((a, b) => a.at - b.at);
  }, [history, period]);
  const chartOption = useMemo<EChartsCoreOption>(() => {
    const bars = data.map((s, i) =>
      Math.max(0, s.tradedQuantity - (data[i - 1]?.tradedQuantity ?? s.tradedQuantity)),
    );
    const moving = data.map((_, i) =>
      i < 6 || data.slice(i - 6, i + 1).some((x) => x.price === null)
        ? null
        : data
            .slice(i - 6, i + 1)
            .filter((x) => x.price !== null)
            .reduce((n, x) => n + x.price!, 0) /
          Math.max(1, data.slice(i - 6, i + 1).filter((x) => x.price !== null).length) /
          100,
    );
    const candle = kind === 'candlestick',
      labels = candle ? candles.map((c) => gameTime(c.at)) : data.map((s) => gameTime(s.at));
    return {
      color: [tema('lavoura'), tema('ouro'), tema('ceu')],
      grid: [
        { left: 74, right: 30, top: 55, height: '58%' },
        { left: 74, right: 30, top: '78%', height: '11%' },
      ],
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', crossStyle: { color: tema('apagado') } },
        backgroundColor: tema('chapa'),
        borderColor: tema('borda-forte'),
        textStyle: { color: tema('creme') },
      },
      legend: { top: 8, left: 10, textStyle: { color: tema('apagado') } },
      toolbox: {
        show: expanded,
        right: 16,
        top: 8,
        iconStyle: { borderColor: tema('apagado') },
        feature: {
          dataZoom: {
            yAxisIndex: false,
            title: { zoom: 'Selecionar intervalo', back: 'Voltar zoom' },
          },
          restore: { title: 'Restaurar' },
          saveAsImage: {
            title: 'Exportar PNG',
            name: `aftermarket-${product}`,
            pixelRatio: 2,
            backgroundColor: tema('noite'),
          },
        },
      },
      xAxis: [0, 1].map((gridIndex) => ({
        type: 'category',
        gridIndex,
        data: labels,
        boundaryGap: candle,
        axisLine: { lineStyle: { color: tema('borda-forte') } },
        axisLabel: {
          show: gridIndex === 1,
          color: tema('apagado'),
          fontSize: 12,
          hideOverlap: true,
        },
        axisPointer: { label: { backgroundColor: tema('chapa-3') } },
      })),
      yAxis: [
        {
          type: log ? 'log' : 'value',
          scale: true,
          name: `R$ / ${item.unit}`,
          nameTextStyle: { color: tema('apagado'), align: 'left' },
          gridIndex: 0,
          splitLine: { lineStyle: { color: tema('borda'), type: 'dashed' } },
          axisLabel: {
            color: tema('apagado'),
            formatter: (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }),
          },
        },
        {
          type: 'value',
          name: `Negócios / ${item.unit}`,
          gridIndex: 1,
          splitLine: { show: false },
          axisLabel: { color: tema('apagado'), fontSize: 12 },
        },
      ],
      dataZoom: expanded
        ? [
            { type: 'inside', xAxisIndex: [0, 1] },
            {
              type: 'slider',
              xAxisIndex: [0, 1],
              bottom: 0,
              height: 17,
              borderColor: tema('borda'),
              textStyle: { color: tema('apagado') },
              fillerColor: comAlfa(tema('lavoura'), '2b'),
            },
          ]
        : [],
      series: [
        {
          name: candle
            ? 'Negócios fechados (abre, fecha, mínima, máxima)'
            : 'Preço médio das ofertas',
          type: candle ? 'candlestick' : 'line',
          data: candle
            ? candles.map((c) => [
                c.prices[0],
                c.prices.at(-1),
                Math.min(...c.prices),
                Math.max(...c.prices),
              ])
            : data.map((s) => (s.price === null ? null : s.price / 100)),
          showSymbol: data.length < 25,
          symbolSize: 5,
          connectNulls: false,
          itemStyle: candle
            ? {
                color: tema('lavoura'),
                color0: tema('brasa'),
                borderColor: tema('lavoura'),
                borderColor0: tema('brasa'),
              }
            : { color: tema('lavoura') },
          lineStyle: { width: 2 },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: tema('ouro'), type: 'dashed' },
            label: {
              formatter: 'Abertura da temporada',
              position: 'insideEndTop',
              color: tema('ouro'),
              fontSize: 12,
            },
            data: [{ yAxis: seasonPrice(world, product) / 100 }],
          },
        },
        ...(average && !candle
          ? [
              {
                name: 'Média das últimas 7 leituras',
                type: 'line',
                data: moving,
                showSymbol: false,
                lineStyle: { color: tema('ouro'), width: 1.5, type: 'dashed' },
              },
            ]
          : []),
        {
          name: 'Volume negociado',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: candle ? candles.map((c) => c.volume) : bars,
          itemStyle: { color: tema('ceu') },
        },
      ],
    };
  }, [data, candles, kind, average, log, expanded, world.season.id]);
  const exportData = () => {
    const csv =
      '\uFEFFData real;Data do jogo;Preço de oferta (R$);Estoque ofertado;Negociado acumulado\r\n' +
      data
        .map((s) =>
          [
            new Date(s.at).toISOString(),
            gameTime(s.at),
            s.price === null ? '' : (s.price / 100).toFixed(2),
            s.stock,
            s.tradedQuantity,
          ].join(';'),
        )
        .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `aftermarket-${product}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notice('Dados observados exportados.');
  };
  return (
    <div className="product-analysis">
      <div className="analysis-heading">
        <div>
          <Badge tone="blue">{item.category}</Badge>
          <h2>{item.name}</h2>
          <p>
            Valores da economia interna ·{' '}
            {item.unit === 'un' ? 'por embalagem indicada' : `por ${item.unit}`}
          </p>
        </div>
        <button className="secondary" onClick={() => setExpanded(!expanded)}>
          <SlidersHorizontal size={15} />
          {expanded ? 'Versão simplificada' : 'Ver mais detalhes'}
        </button>
      </div>
      <div className="analysis-stats">
        <div>
          <span>Preço médio das ofertas</span>
          <strong>{market.price === null ? 'Sem oferta' : cr(market.price)}</strong>
          <small>ponderado pelo estoque</small>
        </div>
        <div>
          <span>Preço médio no varejo</span>
          <strong>{market.retailPrice === null ? 'Não disponível' : cr(market.retailPrice)}</strong>
          <small>canal distinto do atacado</small>
        </div>
        <div>
          <span>Estoque anunciado</span>
          <strong>
            {num(market.stock, 1)} {item.unit}
          </strong>
          <small>{market.suppliers} fornecedores</small>
        </div>
        <div>
          <span>Valor de abertura</span>
          <strong>{cr(seasonPrice(world, product))}</strong>
          <small>congelado no início da temporada</small>
        </div>
      </div>
      {expanded && (
        <>
          <Tabs
            values={['Preço e volume', 'Ofertas à venda', 'Como calculamos']}
            value={tab}
            onChange={setTab}
          />
          <div className="analysis-tools">
            <Select
              label="Período do histórico"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="">Período (opcional)</option>
              <option value="6">Últimas 6 horas do jogo</option>
              <option value="24">Últimas 24 horas do jogo</option>
              <option value="168">Últimos 7 dias do jogo</option>
            </Select>
            {tab === 'Preço e volume' && (
              <>
                <Select
                  label="Tipo de gráfico"
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  <option value="line">Linha de ofertas</option>
                  <option value="candlestick">Candles · 2 horas do jogo</option>
                </Select>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={average}
                    disabled={kind === 'candlestick'}
                    onChange={(e) => setAverage(e.target.checked)}
                  />
                  Média de 7 leituras
                </label>
                <label className="inline-check">
                  <input type="checkbox" checked={log} onChange={(e) => setLog(e.target.checked)} />
                  Escala em proporção (log)
                </label>
              </>
            )}
            <button className="secondary" onClick={exportData} disabled={!data.length}>
              <Download size={14} /> CSV
            </button>
            <button className="text-button" onClick={() => setTable(!table)}>
              {table ? 'Ocultar tabela' : 'Ver tabela'}
            </button>
          </div>
        </>
      )}
      {tab === 'Preço e volume' || !expanded ? (
        loading ? (
          <div className="chart-loading" role="status">
            Carregando observações do mundo…
          </div>
        ) : failed ? (
          <Empty
            title="Não foi possível consultar o histórico"
            description="A conexão será tentada novamente. Os valores atuais continuam acima."
          />
        ) : kind === 'candlestick' && !candles.length ? (
          <Empty
            title="Ainda não houve negócios para formar candles"
            description="Candles usam apenas preços de transações executadas. As ofertas atuais não serão convertidas em negócios fictícios."
          />
        ) : (
          <>
            <EconomicChart
              label={`Histórico observado de ${item.name}, preços em reais por ${item.unit}`}
              option={chartOption}
              height={expanded ? 420 : 285}
            />
            <p className="chart-caption">
              <Info size={13} /> {data.length} observações internas. Linha = preço das ofertas;
              barras = volume efetivamente negociado. Sem dados externos ao vivo.
              {regionId &&
                !regionId.startsWith('state:') &&
                ` Histórico municipal: raio fixo de 120 km; resumo atual: ${radiusKm} km. Praças próximas podem compartilhar ofertas e não devem ser somadas.`}
            </p>
          </>
        )
      ) : tab === 'Ofertas à venda' ? (
        <>
          <EconomicChart
            label={`Ofertas de venda de ${item.name}`}
            height={330}
            option={{
              grid: { left: 70, right: 25, top: 30, bottom: 45 },
              tooltip: { trigger: 'axis' },
              xAxis: {
                type: 'value',
                name: `Quantidade acumulada (${item.unit})`,
                nameLocation: 'middle',
                nameGap: 30,
              },
              yAxis: {
                type: 'value',
                name: `R$ / ${item.unit}`,
                scale: true,
                splitLine: { lineStyle: { color: tema('borda') } },
              },
              series: [
                {
                  name: 'Venda disponível',
                  type: 'line',
                  step: 'end',
                  areaStyle: { color: comAlfa(tema('lavoura'), '26') },
                  data: [...market.offers]
                    .sort((a, b) => a.price - b.price)
                    .map((o, i, all) => [
                      all.slice(0, i + 1).reduce((n, x) => n + x.quantity, 0),
                      o.price / 100,
                    ]),
                },
              ],
            }}
          />
          <p className="chart-caption">
            Apenas ofertas de venda com estoque. Não existe um livro fictício de ordens de compra.
          </p>
        </>
      ) : (
        <div className="method-content">
          <Rows
            rows={[
              {
                label: 'Preço médio das ofertas',
                value: 'média dos preços, com mais peso para quem tem mais estoque',
              },
              { label: 'Demanda por dia do jogo', value: `${num(market.demand, 1)} ${item.unit}` },
              {
                label: 'Consumo da população',
                value: `${num(market.householdDemand, 1)} ${item.unit}/dia`,
              },
              {
                label: 'Insumo da capacidade industrial',
                value: `${num(market.industrialDemand, 1)} ${item.unit}/dia`,
              },
              {
                label: 'Cobertura do estoque',
                value:
                  market.coverageDays === null
                    ? 'Sem demanda modelada'
                    : `${num(market.coverageDays, 1)} dias`,
              },
              { label: 'Negócios acumulados', value: cr(market.tradedValue) },
              { label: 'Massa por unidade', value: `${num(item.massT * 1000, 3)} kg` },
              { label: 'Volume por unidade', value: `${num(item.volumeM3, 4)} m³` },
            ]}
          />
          <h3>Regra da temporada</h3>
          <p>
            {reference.note} A faixa inicial de calibração foi de {cr(reference.low)} a{' '}
            {cr(reference.high)}; ela não limita os preços de negociação.
          </p>
          <p className="formula-note">
            O preço atual não é indexado à faixa inicial. Empresas definem suas ofertas; bots usam
            custo de estoque, margem e escassez observada.
          </p>
        </div>
      )}
      {table && (
        <div className="table-scroll analysis-data-table">
          <table>
            <caption>
              Observações de {item.name} · unidade {item.unit}
            </caption>
            <thead>
              <tr>
                <th>Momento no jogo</th>
                <th className="numeric">Oferta média</th>
                <th className="numeric">Estoque</th>
                <th className="numeric">Negociado acumulado</th>
              </tr>
            </thead>
            <tbody>
              {data
                .slice(-100)
                .reverse()
                .map((s) => (
                  <tr key={s.at}>
                    <td>{gameTime(s.at)}</td>
                    <td className="numeric">{s.price === null ? 'Sem oferta' : cr(s.price)}</td>
                    <td className="numeric">{num(s.stock, 1)}</td>
                    <td className="numeric">{num(s.tradedQuantity, 1)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="analysis-bottom">
        <span>
          <Info size={14} /> Demanda é um modelo do jogo; estoque e negócios são observados.
        </span>
        <button className="primary" onClick={() => openMarket({ product })}>
          Comparar fornecedores <ArrowUpRight size={15} />
        </button>
      </div>
    </div>
  );
}
export function ProductAnalysisModal({
  product,
  regionId,
  radiusKm,
  advanced,
  onClose,
}: {
  product: ProductId;
  regionId?: string;
  radiusKm?: number;
  advanced?: boolean;
  onClose: () => void;
}) {
  return (
    <Modal title="Análise da mercadoria" wide onClose={onClose}>
      <ProductAnalysis
        product={product}
        regionId={regionId}
        radiusKm={radiusKm}
        advanced={advanced}
      />
    </Modal>
  );
}
