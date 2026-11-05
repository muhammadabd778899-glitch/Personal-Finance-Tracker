import { useEffect, useId, useRef, useState } from 'react';
import { DONUT_COLORS } from './chartPalette';

function useMeasuredWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setWidth(next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

interface BarDatum {
  label: string;
  value: number;
  secondary?: number;
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export function BarChart({
  data,
  format,
  height = 190,
  ariaLabel,
  secondaryLabel,
  showTable = true,
}: {
  data: BarDatum[];
  format: (value: number) => string;
  height?: number;
  ariaLabel: string;
  secondaryLabel?: string;
  showTable?: boolean;
}) {
  const width = 640;
  const padding = { top: 14, right: 12, bottom: 26, left: 12 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const max = niceMax(Math.max(...data.map((d) => Math.max(d.value, d.secondary ?? 0)), 0));
  const slot = data.length > 0 ? plotW / data.length : plotW;
  const barW = Math.max(
    6,
    Math.min(30, slot * (data.some((d) => d.secondary != null) ? 0.32 : 0.56)),
  );
  const id = useId().replace(/:/g, '');

  if (data.length === 0) {
    return <p className="muted small">No data for this period.</p>;
  }

  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="none"
        style={{ height }}
      >
        <defs>
          <linearGradient id={`bar-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.65" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((ratio) => {
          const y = padding.top + plotH * ratio;
          return (
            <line
              key={ratio}
              className="grid-line"
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
            />
          );
        })}
        {data.map((datum, index) => {
          const x = padding.left + index * slot + slot / 2;
          const primaryH = max > 0 ? (Math.max(0, datum.value) / max) * plotH : 0;
          const secondaryH =
            datum.secondary != null && max > 0 ? (Math.max(0, datum.secondary) / max) * plotH : 0;
          const shift = datum.secondary != null ? barW * 0.6 : 0;
          return (
            <g key={`${datum.label}-${index}`}>
              <rect
                className="bar"
                x={x - barW / 2 - shift}
                y={padding.top + plotH - primaryH}
                width={barW}
                height={Math.max(primaryH, 1)}
                rx={Math.min(4, barW / 2)}
                fill={`url(#bar-${id})`}
              >
                <title>{`${datum.label}: ${format(datum.value)}`}</title>
              </rect>
              {datum.secondary != null ? (
                <rect
                  className="bar"
                  x={x + barW / 2 + shift - barW}
                  y={padding.top + plotH - secondaryH}
                  width={barW}
                  height={Math.max(secondaryH, 1)}
                  rx={Math.min(4, barW / 2)}
                  fill="var(--chart-muted)"
                >
                  <title>{`${datum.label} ${secondaryLabel ?? 'secondary'}: ${format(datum.secondary)}`}</title>
                </rect>
              ) : null}
              <text className="axis-label" x={x} y={height - 7} textAnchor="middle">
                {data.length > 8 && index % 2 === 1 ? '' : datum.label}
              </text>
            </g>
          );
        })}
      </svg>
      <details className="chart-toggle">
        <summary>View values as a table</summary>
        <div className="table-wrap chart-table">
          <table className="table table-compact">
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col" className="num">
                  Amount
                </th>
                {secondaryLabel ? (
                  <th scope="col" className="num">
                    {secondaryLabel}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {data.map((datum, index) => (
                <tr key={`${datum.label}-row-${index}`}>
                  <td>{datum.label}</td>
                  <td className="num">{format(datum.value)}</td>
                  {secondaryLabel ? (
                    <td className="num">
                      {datum.secondary != null ? format(datum.secondary) : '—'}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      {!showTable ? null : null}
    </div>
  );
}

interface LineDatum {
  date: string;
  value: number;
  label?: string;
}

export function LineChart({
  data,
  format,
  height = 220,
  ariaLabel,
}: {
  data: LineDatum[];
  format: (value: number) => string;
  height?: number;
  ariaLabel: string;
}) {
  const [chartRef, width] = useMeasuredWidth(700);
  const padding = { top: 16, right: 16, bottom: 26, left: 16 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const id = useId().replace(/:/g, '');

  if (data.length === 0) return <p className="muted small">No history yet.</p>;
  if (data.length === 1) {
    return (
      <p className="muted small">
        One data point recorded: <strong>{format(data[0].value)}</strong>. More history will appear
        as you add activity.
      </p>
    );
  }

  const values = data.map((d) => d.value);
  const rawMin = Math.min(...values, 0);
  const rawMax = Math.max(...values, 1);
  const span = rawMax - rawMin || 1;
  const min = rawMin - span * 0.08;
  const max = rawMax + span * 0.08;
  const xFor = (index: number) => padding.left + (index / (data.length - 1)) * plotW;
  const yFor = (value: number) => padding.top + plotH - ((value - min) / (max - min || 1)) * plotH;

  const line = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(d.value).toFixed(1)}`)
    .join(' ');
  const area = `${line} L${xFor(data.length - 1).toFixed(1)},${(padding.top + plotH).toFixed(1)} L${padding.left},${(padding.top + plotH).toFixed(1)} Z`;
  const zeroY = yFor(0);

  return (
    <div className="chart" ref={chartRef}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel}
        style={{ height }}
      >
        <defs>
          <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.34" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((ratio) => {
          const y = padding.top + plotH * ratio;
          return (
            <line
              key={ratio}
              className="grid-line"
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
            />
          );
        })}
        {rawMin < 0 ? (
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={zeroY}
            y2={zeroY}
            stroke="var(--line-strong)"
            strokeDasharray="4 4"
          />
        ) : null}
        <path d={area} fill={`url(#area-${id})`} />
        <path className="line-path" d={line} />
        {data.map((datum, index) =>
          index === data.length - 1 ? (
            <circle
              key={datum.date}
              className="last-point"
              cx={xFor(index)}
              cy={yFor(datum.value)}
              r={5}
              fill="var(--accent)"
              stroke="var(--surface)"
              strokeWidth={2}
            >
              <title>{`${datum.label ?? datum.date}: ${format(datum.value)}`}</title>
            </circle>
          ) : null,
        )}
        <text className="axis-label" x={padding.left} y={height - 6}>
          {data[0].label ?? data[0].date}
        </text>
        <text className="axis-label" x={width - padding.right} y={height - 6} textAnchor="end">
          {data[data.length - 1].label ?? data[data.length - 1].date}
        </text>
      </svg>
      <details className="chart-toggle">
        <summary>View values as a table</summary>
        <div className="table-wrap chart-table">
          <table className="table table-compact">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col" className="num">
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((datum) => (
                <tr key={`${datum.date}-${datum.value}`}>
                  <td>{datum.label ?? datum.date}</td>
                  <td className="num">{format(datum.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export function DonutChart({
  data,
  format,
  centerValue,
  centerLabel,
  ariaLabel,
}: {
  data: { label: string; value: number }[];
  format: (value: number) => string;
  centerValue: string;
  centerLabel: string;
  ariaLabel: string;
}) {
  const total = data.reduce((sum, datum) => sum + Math.max(0, datum.value), 0);
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="donut">
      <svg viewBox="0 0 160 160" role="img" aria-label={ariaLabel}>
        <circle cx={80} cy={80} r={radius} fill="none" stroke="var(--surface-2)" strokeWidth={18} />
        {total > 0
          ? data.map((datum, index) => {
              const share = Math.max(0, datum.value) / total;
              const length = share * circumference;
              const dashOffset = -offset;
              offset += length;
              return (
                <circle
                  key={`${datum.label}-${index}`}
                  className="donut-segment"
                  cx={80}
                  cy={80}
                  r={radius}
                  fill="none"
                  stroke={DONUT_COLORS[index % DONUT_COLORS.length]}
                  strokeWidth={18}
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={dashOffset}
                >
                  <title>{`${datum.label}: ${format(datum.value)} (${Math.round(share * 100)}%)`}</title>
                </circle>
              );
            })
          : null}
      </svg>
      <div className="donut-center">
        <strong>{centerValue}</strong>
        <span>{centerLabel}</span>
      </div>
    </div>
  );
}

export function Sparkline({
  data,
  ariaLabel,
  height = 64,
}: {
  data: number[];
  ariaLabel: string;
  height?: number;
}) {
  const width = 320;
  const pad = 6;
  const values = data.length > 0 ? data : [0, 0];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const lastIndex = Math.max(1, values.length - 1);
  const xFor = (index: number) => 3 + (index / lastIndex) * (width - 6);
  const yFor = (value: number) => pad + (1 - (value - min) / span) * (height - pad * 2);
  const line = values
    .map(
      (value, index) =>
        `${index === 0 ? 'M' : 'L'}${xFor(index).toFixed(1)},${yFor(value).toFixed(1)}`,
    )
    .join(' ');
  const area = `${line} L${xFor(values.length - 1).toFixed(1)},${height} L${xFor(0).toFixed(1)},${height} Z`;

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
    >
      <path className="spark-area" d={area} opacity={0.55} />
      <path className="spark-line" d={line} />
      <circle
        className="spark-dot"
        cx={xFor(values.length - 1)}
        cy={yFor(values[values.length - 1])}
        r={3.5}
      />
    </svg>
  );
}
