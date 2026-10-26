import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart, BarChart, CandlestickChart, ScatterChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
  MarkLineComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';
echarts.use([
  LineChart,
  BarChart,
  CandlestickChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
  MarkLineComponent,
  CanvasRenderer,
]);

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
    chart = useRef<echarts.EChartsType | undefined>(undefined);
  useEffect(() => {
    const instance = echarts.init(ref.current!, undefined, { renderer: 'canvas' });
    chart.current = instance;
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(ref.current!);
    return () => {
      observer.disconnect();
      instance.dispose();
      chart.current = undefined;
    };
  }, []);
  useEffect(() => {
    chart.current?.setOption(
      {
        backgroundColor: 'transparent',
        textStyle: { fontFamily: 'Inter Variable, sans-serif', color: '#a9bfcb' },
        animation: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        animationDuration: 250,
        ...option,
      },
      { notMerge: true },
    );
  }, [option]);
  return (
    <div ref={ref} className="economic-chart" style={{ height }} role="img" aria-label={label} />
  );
}
