/**
 * A catalog for composable dashboards.
 *
 * The agent assembles a dashboard from these trusted pieces: a responsive
 * `Grid`, `Kpi` tiles and two charts. It never writes the numbers. It binds
 * each tile to a data function (`total`, `change`, `breakdown`) that the
 * renderer evaluates against `src/data/sales.ts`. Filter arguments can be bound
 * to the data model, so a filter control recomputes every tile in the browser
 * without a round trip to the agent.
 */
import {css, html, nothing, svg} from 'lit';
import {z} from 'zod';
import {
  Catalog,
  ChildListSchema,
  DynamicStringSchema,
  DynamicValueSchema,
  createFunctionImplementation,
} from '@a2ui/web_core/v1_0';
import {A2uiLitElement, registerUniversalElement} from '@a2ui/web_core/universal';
import type {LitComponentApi} from '@a2ui/lit';
import {
  DIMENSIONS,
  MEASURES,
  breakdown,
  change,
  isMeasure,
  total,
  type Dimension,
  type Point,
} from '../data/sales.js';

export const DASHBOARD_CATALOG_ID = 'https://example.com/catalogs/dashboard/v1/catalog.json';

const FORMATS = ['number', 'currency', 'percent'] as const;
type Format = (typeof FORMATS)[number];

const FormatSchema = z
  .enum(FORMATS)
  .describe('How to show values: "number", "currency" (euros) or "percent".')
  .optional();

/** Formats a value compactly: €48.2k, 1,204, 6.1%. */
export function formatValue(value: number, format: Format = 'number'): string {
  if (!Number.isFinite(value)) return '–';
  if (format === 'percent') return `${value.toLocaleString('en', {maximumFractionDigits: 1})}%`;
  const compact = Math.abs(value) >= 10_000;
  const number = value.toLocaleString('en', {
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
  });
  return format === 'currency' ? `€${number}` : number;
}

const points = (value: unknown): Point[] =>
  (Array.isArray(value) ? value : []).filter(
    (point): point is Point =>
      typeof point?.label === 'string' && typeof point?.value === 'number' && Number.isFinite(point.value),
  );

// ---------------------------------------------------------------- components

const GridApi = {
  name: 'Grid',
  schema: z
    .object({
      children: ChildListSchema.describe('The tiles, in reading order. They wrap onto new rows on narrow screens.'),
      minWidth: z.number().describe('The narrowest a tile may get, in pixels. Defaults to 200.').optional(),
    })
    .describe('A dashboard layout: tiles side by side in equal columns, wrapping to fit the width.')
    .strict(),
};

const KpiApi = {
  name: 'Kpi',
  schema: z
    .object({
      label: DynamicStringSchema.describe('What the number is, such as "Revenue".'),
      value: DynamicValueSchema.describe('The number, usually total(...).'),
      change: DynamicValueSchema.describe('Percent change against the period before, usually change(...).').optional(),
      format: FormatSchema,
      goodWhen: z
        .enum(['up', 'down'])
        .describe('Which direction of change is good. Defaults to "up"; use "down" for returns.')
        .optional(),
      caption: DynamicStringSchema.describe('A short note under the number, such as the period.').optional(),
    })
    .describe('A key figure tile: one big number with its change against the period before.')
    .strict(),
};

const LineChartApi = {
  name: 'LineChart',
  schema: z
    .object({
      data: DynamicValueSchema.describe('A list of {label, value} points, oldest first, usually breakdown(..., "month").'),
      label: DynamicStringSchema.describe('The chart title.').optional(),
      format: FormatSchema,
    })
    .describe('A line chart for a measure over time.')
    .strict(),
};

const BarChartApi = {
  name: 'BarChart',
  schema: z
    .object({
      data: DynamicValueSchema.describe('A list of {label, value} points, usually breakdown(...) by region, product or channel.'),
      label: DynamicStringSchema.describe('The chart title.').optional(),
      format: FormatSchema,
    })
    .describe('Horizontal bars comparing a measure across categories, largest first.')
    .strict(),
};

const tileStyles = css`
  :host {
    display: block;
    min-width: 0;
  }
  .tile {
    height: 100%;
    box-sizing: border-box;
    padding: 14px 16px;
    border: 1px solid var(--a2ui-color-border, #dedbd2);
    border-radius: var(--a2ui-border-radius, 10px);
    background: var(--a2ui-color-surface, #fff);
    color: var(--a2ui-color-on-surface, #1b1f23);
  }
  .label {
    margin: 0 0 6px;
    color: var(--a2ui-text-caption-color, #5d666f);
    font-size: 13px;
  }
`;

/** Tiles side by side in equal columns that wrap to fit. */
class GridElement extends A2uiLitElement<typeof GridApi> {
  protected override readonly api = GridApi;

  // Light DOM, like the basic Row and Column, so child tiles size against the grid.
  protected override createRenderRoot() {
    return this;
  }

  override render() {
    const props = this.controller?.props;
    if (!props) return nothing;
    this.style.display = 'grid';
    this.style.gap = 'var(--a2ui-spacing-m, 12px)';
    this.style.gridTemplateColumns = `repeat(auto-fit, minmax(min(100%, ${props.minWidth ?? 200}px), 1fr))`;
    const children = Array.isArray(props.children) ? props.children : [];
    return html`${children.map(child => this.renderNode(child))}`;
  }
}

class KpiElement extends A2uiLitElement<typeof KpiApi> {
  protected override readonly api = KpiApi;

  static override styles = [
    tileStyles,
    css`
      .value {
        margin: 0;
        font: 600 28px/1.15 var(--a2ui-font-family, system-ui);
        font-variant-numeric: tabular-nums;
      }
      .change {
        margin: 6px 0 0;
        font-size: 13px;
        font-variant-numeric: tabular-nums;
      }
      .good {
        color: var(--dash-good, #0b6e4f);
      }
      .bad {
        color: var(--dash-bad, #b3261e);
      }
      .caption {
        color: var(--a2ui-text-caption-color, #5d666f);
      }
    `,
  ];

  override render() {
    const props = this.controller?.props;
    if (!props) return nothing;
    const value = Number(props.value);
    const delta = props.change === undefined ? undefined : Number(props.change);
    const up = (delta ?? 0) >= 0;
    const flat = delta !== undefined && Math.abs(delta) < 0.05;
    const good = up === ((props.goodWhen ?? 'up') === 'up');
    return html`
      <div class="tile">
        <p class="label">${props.label}</p>
        <p class="value">${formatValue(value, props.format)}</p>
        ${delta === undefined || !Number.isFinite(delta)
          ? nothing
          : html`<p class="change">
              ${flat
                ? html`<span>No change</span>`
                : html`<span class=${good ? 'good' : 'bad'}>${up ? '▲' : '▼'} ${Math.abs(delta).toLocaleString('en')}%</span>`}
              <span class="caption">${props.caption ?? 'vs the period before'}</span>
            </p>`}
        ${delta === undefined && props.caption ? html`<p class="change caption">${props.caption}</p>` : nothing}
      </div>
    `;
  }
}

class LineChartElement extends A2uiLitElement<typeof LineChartApi> {
  protected override readonly api = LineChartApi;

  static override styles = [
    tileStyles,
    css`
      svg {
        display: block;
        width: 100%;
        height: 150px;
        overflow: visible;
      }
      .line {
        fill: none;
        stroke: var(--a2ui-color-primary, #0b6e4f);
        stroke-width: 2;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
      }
      .area {
        fill: var(--a2ui-color-primary, #0b6e4f);
        opacity: 0.1;
      }
      .grid {
        stroke: var(--a2ui-color-border, #dedbd2);
        vector-effect: non-scaling-stroke;
      }
      .axis {
        display: flex;
        justify-content: space-between;
        margin-top: 4px;
        color: var(--a2ui-text-caption-color, #5d666f);
        font-size: 11px;
        font-variant-numeric: tabular-nums;
      }
      .head {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }
    `,
  ];

  override render() {
    const props = this.controller?.props;
    if (!props) return nothing;
    const data = points(props.data);
    if (data.length < 2) return html`<div class="tile"><p class="label">${props.label} · no data</p></div>`;
    const values = data.map(point => point.value);
    const high = Math.max(...values) * 1.08 || 1;
    const x = (i: number) => (i / (data.length - 1)) * 100;
    const y = (v: number) => 100 - (v / high) * 100;
    const line = data.map((point, i) => `${x(i)},${y(point.value)}`).join(' ');
    const last = data.at(-1)!;
    const summary = `${props.label ?? 'Series'}: ${data
      .map(point => `${point.label} ${formatValue(point.value, props.format)}`)
      .join(', ')}`;
    return html`
      <div class="tile">
        <div class="head">
          <p class="label">${props.label}</p>
          <p class="label">${last.label}: <strong>${formatValue(last.value, props.format)}</strong></p>
        </div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label=${summary}>
          ${svg`
            <line class="grid" x1="0" x2="100" y1="100" y2="100"></line>
            <polygon class="area" points="0,100 ${line} 100,100"></polygon>
            <polyline class="line" points=${line}></polyline>
            ${data.map(
              (point, i) =>
                svg`<rect x=${x(i) - 50 / data.length} y="0" width=${100 / data.length} height="100" fill="transparent"><title>${point.label}: ${formatValue(point.value, props.format)}</title></rect>`,
            )}
          `}
        </svg>
        <div class="axis">
          <span>${data[0].label}</span>
          <span>Low ${formatValue(Math.min(...values), props.format)} · High ${formatValue(Math.max(...values), props.format)}</span>
          <span>${last.label}</span>
        </div>
      </div>
    `;
  }
}

class BarChartElement extends A2uiLitElement<typeof BarChartApi> {
  protected override readonly api = BarChartApi;

  static override styles = [
    tileStyles,
    css`
      ol {
        display: grid;
        gap: 8px;
        margin: 4px 0 0;
        padding: 0;
        list-style: none;
      }
      li {
        display: grid;
        grid-template-columns: minmax(64px, 30%) 1fr auto;
        align-items: center;
        gap: 8px;
        font-size: 13px;
      }
      .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .track {
        display: block;
        height: 12px;
        border-radius: 4px;
        background: var(--gh-track, #efede7);
        overflow: hidden;
      }
      .bar {
        display: block;
        height: 100%;
        border-radius: 4px;
        background: var(--a2ui-color-primary, #0b6e4f);
        transition: width 0.4s ease;
      }
      .amount {
        min-width: 4.5em;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
    `,
  ];

  override render() {
    const props = this.controller?.props;
    if (!props) return nothing;
    const data = points(props.data);
    const high = Math.max(0, ...data.map(point => point.value)) || 1;
    return html`
      <div class="tile">
        <p class="label">${props.label}</p>
        ${data.length === 0
          ? html`<p class="label">No data</p>`
          : html`<ol aria-label=${props.label ?? 'Comparison'}>
              ${data.map(
                point => html`<li>
                  <span class="name">${point.label}</span>
                  <span class="track"><span class="bar" style="width:${(Math.max(0, point.value) / high) * 100}%"></span></span>
                  <span class="amount">${formatValue(point.value, props.format)}</span>
                </li>`,
              )}
            </ol>`}
      </div>
    `;
  }
}

const Grid: LitComponentApi = {...GridApi, tagName: 'dash-grid', element: GridElement};
const Kpi: LitComponentApi = {...KpiApi, tagName: 'dash-kpi', element: KpiElement};
const LineChart: LitComponentApi = {...LineChartApi, tagName: 'dash-line-chart', element: LineChartElement};
const BarChart: LitComponentApi = {...BarChartApi, tagName: 'dash-bar-chart', element: BarChartElement};
for (const component of [Grid, Kpi, LineChart, BarChart]) registerUniversalElement(component);

// ----------------------------------------------------------------- functions

const MeasureSchema = z
  .enum(MEASURES)
  .describe('What to measure: revenue (euros), orders, customers, returns, or averageOrder (euros per order).');
const filter = (name: string, values: string) =>
  DynamicValueSchema.describe(
    `Only count these ${name}s: ${values}. A string, a list, or "All". Bind it to the data model to make it a filter control.`,
  ).optional();
const filterArgs = {
  region: filter('region', 'North, South, East, West'),
  product: filter('product', 'Wheels, Drivetrain, Brakes, Accessories'),
  channel: filter('channel', 'Webshop, Dealers, Marketplace'),
  period: DynamicValueSchema.describe(
    'The time window: "lastMonth", "last3Months" or "last12Months" (the default). The latest month is October 2026.',
  ).optional(),
};

/** Reads a measure argument, which may arrive bound from the data model. */
const measureOf = (value: unknown) => (isMeasure(value) ? value : 'revenue');

const Total = createFunctionImplementation(
  {
    name: 'total',
    description: 'The sales data: a measure summed over a period, after filters. Use it for Kpi values.',
    returnType: 'number',
    schema: z.object({measure: MeasureSchema, ...filterArgs}).strict(),
  },
  args => total(measureOf(args.measure), args, args.period),
);

const Change = createFunctionImplementation(
  {
    name: 'change',
    description: 'The sales data: percent change of a measure against the same-length period before it.',
    returnType: 'number',
    schema: z.object({measure: MeasureSchema, ...filterArgs}).strict(),
  },
  args => change(measureOf(args.measure), args, args.period),
);

const Breakdown = createFunctionImplementation(
  {
    name: 'breakdown',
    description:
      'The sales data: a measure split by month (oldest first) or by region, product or channel (largest first), as {label, value} points for charts.',
    returnType: 'array',
    schema: z
      .object({
        measure: MeasureSchema,
        by: z.enum(DIMENSIONS).describe('Split by "month", "region", "product" or "channel".'),
        ...filterArgs,
      })
      .strict(),
  },
  args => breakdown(measureOf(args.measure), (DIMENSIONS.includes(args.by) ? args.by : 'month') as Dimension, args, args.period),
);

export const dashboardCatalog = new Catalog<LitComponentApi>(
  DASHBOARD_CATALOG_ID,
  '1.0',
  [Grid, Kpi, LineChart, BarChart],
  [Total, Change, Breakdown],
);

