// chart-factory integration: one-time setup, theme sync, and thin typed
// wrappers. Tables are DOM-based (no React component by design) — the
// wrappers here follow the library's documented useEffect pattern.
import React, { useEffect, useRef } from 'react';
import { ChartFactory } from 'chart-factory';
import { D3Table } from 'chart-factory/table';

import 'chart-factory/core/tokens.css';
import 'chart-factory/core/base.css';
import 'chart-factory/table/tokens.css';
import 'chart-factory/table/table.css';

ChartFactory.Table.register(D3Table);

// chart-factory gap: series end labels (text.series-label) are drawn without
// the data-series marker, so the interactive legend dims lines/dots but not
// labels. Stamp the markers ourselves — labels are appended in series order.
export function stampSeriesLabelMarkers(root: ParentNode = document) {
  root.querySelectorAll('svg').forEach((svg) => {
    svg
      .querySelectorAll('text.series-label')
      .forEach((node, index) => node.setAttribute('data-series', String(index)));
    svg
      .querySelectorAll('.series-label-leader')
      .forEach((node, index) => node.setAttribute('data-series', String(index)));
  });
}

// Keep chart colors in sync with the app's data-theme attribute.
// (SVG colors are baked at render time, so a flip needs rerenderAll.)
let themeObserverStarted = false;
export function startChartThemeSync() {
  if (themeObserverStarted) return;
  themeObserverStarted = true;
  const observer = new MutationObserver(() => {
    ChartFactory.rerenderAll();
    stampSeriesLabelMarkers(); // rerender redraws labels without markers
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
}

// D3Table selects by element id — React's useId() ids are not valid CSS
// selectors, so we mint our own.
let idSeq = 0;
const nextId = (prefix: string) => `${prefix}-${idSeq++}`;

type TableColumn = { key: string; [option: string]: any };

interface CfTableProps {
  columns: TableColumn[];
  rows: Array<{ [key: string]: any }>;
  sortable?: boolean;
  options?: { [key: string]: any };
}

export function CfTable({ columns, rows, sortable = false, options = {} }: CfTableProps) {
  const id = useRef(nextId('cf-table')).current;
  const tableRef = useRef<any>(null);
  const optionsRef = useRef({ columns, sortable, options });
  optionsRef.current = { columns, sortable, options };

  useEffect(() => {
    const { columns, sortable, options } = optionsRef.current;
    const table = sortable
      ? ChartFactory.Table.createSortable(id, { columns, ...options })
      : ChartFactory.Table.createBasic(id, { columns, ...options });
    tableRef.current = table;
    return () => {
      table.destroy?.();
      tableRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    tableRef.current?.render(rows);
  }, [rows]);

  return <div id={id} />;
}

interface CfChartProps {
  create: (el: Element, config: any) => any;
  config: { [key: string]: any };
  data?: any;
  className?: string;
}

// Generic chart wrapper: create on mount, setData on data change,
// destroy on unmount. Config changes recreate (simple + predictable).
export function CfChart({ create, config, data, className }: CfChartProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const configKey = JSON.stringify(config, (_k, v) =>
    typeof v === 'function' ? v.toString() : v
  );

  useEffect(() => {
    if (!elRef.current) return;
    const chart = create(elRef.current, { ...config, ...(data ? { data } : {}) });
    chartRef.current = chart;
    stampSeriesLabelMarkers(elRef.current);
    return () => {
      chart.destroy?.();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey]);

  useEffect(() => {
    if (data && chartRef.current?.setData) chartRef.current.setData(data);
  }, [data]);

  return <div ref={elRef} className={className} />;
}

export { ChartFactory };
