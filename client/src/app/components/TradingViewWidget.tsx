'use client';

import { useEffect, useRef } from 'react';

export default function TradingViewWidget({ symbol }: { symbol: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!symbol || !containerRef.current) return;
    containerRef.current.innerHTML = '';

    const widget = document.createElement('div');
    widget.className = 'tradingview-widget-container__widget';
    containerRef.current.appendChild(widget);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol,
      width: '100%',
      height: 220,
      locale: 'en',
      dateRange: '12M',
      colorTheme: 'light',
      isTransparent: false,
      autosize: true,
      largeChartUrl: '',
    });
    containerRef.current.appendChild(script);
  }, [symbol]);

  if (!symbol) return null;

  return (
    <div
      className="tradingview-widget-container rounded-xl overflow-hidden border border-gray-100"
      ref={containerRef}
      style={{ height: 220 }}
    />
  );
}
