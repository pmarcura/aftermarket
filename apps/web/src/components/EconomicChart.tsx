import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { LineChart, BarChart, CandlestickChart, ScatterChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
  MarkLineComponent,
  AriaComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { Download, Table2, Maximize2, ZoomIn, RotateCcw } from 'lucide-react';
import type { EChartsCoreOption } from 'echarts/core';

echarts.use([
  LineChart,
  BarChart,
  CandlestickChart,
  ScatterChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
  MarkLineComponent,
  AriaComponent,
  CanvasRenderer,
]);
const ink = '#dce8ee',
  muted = '#abc1cd',
  grid = '#334d5b';
const theme = {
  color: ['#72c4eb', '#e7bd70', '#72d6b0', '#e69d88', '#aab7f3', '#c9da82'],
  backgroundColor: 'transparent',
  textStyle: { fontFamily: 'Inter Variable, sans-serif', fontSize: 12, color: ink },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#67818e' } },
    axisTick: { show: false },
    axisLabel: { color: muted, fontSize: 12, hideOverlap: true },
    splitLine: { show: false },
    nameTextStyle: { color: muted },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: muted,
      fontSize: 12,
      formatter: (v: number) =>
        new Intl.NumberFormat('pt-BR', {
          maximumFractionDigits: 2,
          notation: Math.abs(v) >= 1000000 ? 'compact' : 'standard',
        }).format(v),
    },
    splitLine: { lineStyle: { color: grid, type: 'dashed' } },
    nameTextStyle: { color: muted, padding: [0, 0, 8, 0] },
  },
  logAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: muted },
    splitLine: { lineStyle: { color: grid } },
  },
  line: { lineStyle: { width: 2.5 }, symbol: 'circle', symbolSize: 5, showSymbol: false },
  bar: { barMaxWidth: 32, itemStyle: { borderRadius: [3, 3, 0, 0] } },
  legend: {
    top: 0,
    textStyle: { color: ink, fontSize: 12 },
    pageTextStyle: { color: ink },
    inactiveColor: '#627786',
  },
};
echarts.registerTheme('aftermarket', theme);
const format = (n: unknown): string =>
  typeof n === 'number'
    ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(n)
    : Array.isArray(n)
      ? n.map(format).join(' / ')
      : String(n ?? '—');
export function chartRows(option: EChartsCoreOption) {
  const x = Array.isArray(option.xAxis) ? option.xAxis[0] : option.xAxis;
  const y = Array.isArray(option.yAxis) ? option.yAxis[0] : option.yAxis;
  const axis = x?.type === 'category' || x?.data ? x : y;
  const series = (
    Array.isArray(option.series) ? option.series : option.series ? [option.series] : []
  ).filter((s: any) => Array.isArray(s.data));
  const length = Math.max(0, ...(series as any[]).map((s) => s.data.length));
  return {
    columns: [
      'Período / categoria',
      ...series.map((s: any, i) => String(s.name || 'Série ' + (i + 1))),
    ],
    rows: Array.from({ length }, (_, i) => [
      String(axis?.data?.[i] ?? (series[0] as any)?.data?.[i]?.name ?? i + 1),
      ...series.map((s: any) => format(s.data[i]?.value ?? s.data[i])),
    ]),
  };
}
export function EconomicChart({
  option,
  label,
  height = 340,
}: {
  option: EChartsCoreOption;
  label: string;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null),
    frame = useRef<HTMLDivElement>(null),
    chart = useRef<echarts.EChartsType | undefined>(undefined);
  const zoomState = useRef<{ start: number; end: number } | undefined>(undefined);
  const [table, setTable] = useState(false),
    [zoom, setZoom] = useState(false);
  const data = chartRows(option);
  useEffect(() => {
    const instance = echarts.init(ref.current!, 'aftermarket', { renderer: 'canvas' });
    chart.current = instance;
    instance.on('datazoom', (event: any) => {
      const v = event.batch?.[0] ?? event;
      if (Number.isFinite(v.start) && Number.isFinite(v.end))
        zoomState.current = { start: v.start, end: v.end };
    });
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(ref.current!);
    return () => {
      observer.disconnect();
      instance.dispose();
      chart.current = undefined;
    };
  }, []);
  useEffect(() => {
    const legends = option.legend
      ? {
          top: 0,
          type: 'scroll',
          textStyle: { color: ink },
          ...(Array.isArray(option.legend) ? option.legend[0] : option.legend),
        }
      : undefined;
    const opts = {
      backgroundColor: 'transparent',
      aria: { enabled: true },
      animation: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      animationDuration: 200,
      grid: { left: 16, right: 22, top: legends ? 62 : 30, bottom: 42, containLabel: true },
      ...option,
      legend: legends,
      tooltip: {
        trigger: 'axis',
        confine: true,
        valueFormatter: format,
        backgroundColor: '#102732',
        borderColor: '#617d8c',
        padding: [10, 14],
        textStyle: { color: '#eef5f8', fontSize: 13 },
        axisPointer: {
          type: 'cross',
          lineStyle: { color: '#a4c5d6' },
          label: { backgroundColor: '#375d70' },
        },
        ...(option.tooltip ?? {}),
      },
    } as EChartsCoreOption;
    if (zoom && !option.dataZoom)
      opts.dataZoom = [
        { type: 'inside', ...(zoomState.current ?? { start: 0, end: 100 }) },
        {
          type: 'slider',
          bottom: 0,
          height: 18,
          textStyle: { color: muted },
          borderColor: grid,
          ...(zoomState.current ?? {}),
        },
      ];
    if (opts.grid && !Array.isArray(opts.grid)) {
      const g = opts.grid as Record<string, unknown>;
      opts.grid = {
        containLabel: true,
        ...g,
        top: Math.max(Number(g.top) || 0, legends ? 58 : 28),
        bottom: Math.max(Number(g.bottom) || 0, zoom ? 62 : 30),
      };
    }
    chart.current?.setOption(opts, { notMerge: true });
    if (zoomState.current && option.dataZoom)
      chart.current?.dispatchAction({ type: 'dataZoom', ...zoomState.current });
  }, [option, zoom]);
  function download() {
    const a = document.createElement('a');
    a.href = chart.current!.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#142732' });
    a.download = 'aftermarket-grafico.png';
    a.click();
  }
  function csv() {
    const a = document.createElement('a'),
      content = [data.columns, ...data.rows]
        .map((row) => row.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(';'))
        .join('\r\n');
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' }),
    );
    a.href = url;
    a.download = 'aftermarket-dados-grafico.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div ref={frame} className="chart-frame">
      <div ref={ref} className="economic-chart" style={{ height }} role="img" aria-label={label} />
      <details className="chart-tools">
        <summary>Ferramentas e dados do gráfico</summary>
        <div className="chart-actions">
          <button className="secondary" onClick={() => setTable((v) => !v)} aria-pressed={table}>
            <Table2 size={14} /> {table ? 'Ocultar valores' : 'Ver valores'}
          </button>
          <button className="secondary" onClick={() => setZoom((v) => !v)} aria-pressed={zoom}>
            <ZoomIn size={14} /> {zoom ? 'Desativar zoom' : 'Zoom e arraste'}
          </button>
          <button
            className="secondary"
            onClick={() => {
              zoomState.current = undefined;
              chart.current?.dispatchAction({ type: 'dataZoom', start: 0, end: 100 });
            }}
          >
            <RotateCcw size={14} /> Restaurar escala
          </button>
          <button className="secondary" onClick={download}>
            <Download size={14} /> PNG
          </button>
          <button className="secondary" onClick={csv}>
            <Table2 size={14} /> CSV
          </button>
          <button
            className="secondary"
            onClick={() => void frame.current?.requestFullscreen().catch(() => setTable(true))}
          >
            <Maximize2 size={14} /> Ampliar
          </button>
        </div>
      </details>
      {table && (
        <div className="table-scroll chart-data">
          <table>
            <caption>{label}</caption>
            <thead>
              <tr>
                {data.columns.map((c, i) => (
                  <th key={i}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.length ? (
                data.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((v, j) => (
                      <td key={j}>{v}</td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={data.columns.length}>Ainda não há observações neste recorte.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
