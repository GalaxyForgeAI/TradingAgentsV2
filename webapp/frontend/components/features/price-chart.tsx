"use client";

import { createChart, type IChartApi } from "lightweight-charts";
import { useEffect, useRef } from "react";

import type { MarketBar } from "@/lib/types";

export function PriceChart({ bars }: { bars: MarketBar[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      height: 360,
      layout: { background: { color: "transparent" }, textColor: "#71717a" },
      grid: { vertLines: { visible: false }, horzLines: { color: "#27272a22" } },
      timeScale: { borderVisible: false },
      rightPriceScale: { borderVisible: false },
    });
    chartRef.current = chart;
    const series = chart.addCandlestickSeries({
      upColor: "#16a34a",
      downColor: "#dc2626",
      borderVisible: false,
      wickUpColor: "#16a34a",
      wickDownColor: "#dc2626",
    });
    series.setData(bars.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c })));
    chart.timeScale().fitContent();
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [bars]);

  return <div ref={ref} className="w-full" />;
}
