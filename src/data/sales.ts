/**
 * The data behind the dashboard example: two years of monthly sales of a
 * fictional bike-parts shop, by region, product line and channel.
 *
 * This is the "trusted" side of a composable dashboard. The agent decides
 * which tiles to show and what they measure; the numbers in them always come
 * from here, computed in the renderer, never from text the model wrote.
 *
 * The data is generated from a fixed seed, so every run shows the same numbers.
 */

export const MEASURES = ['revenue', 'orders', 'customers', 'returns', 'averageOrder'] as const;
export const DIMENSIONS = ['month', 'region', 'product', 'channel'] as const;
export const PERIODS = ['lastMonth', 'last3Months', 'last12Months'] as const;

export type Measure = (typeof MEASURES)[number];
export type Dimension = (typeof DIMENSIONS)[number];
export type Period = (typeof PERIODS)[number];

export const REGIONS = ['North', 'South', 'East', 'West'];
export const PRODUCTS = ['Wheels', 'Drivetrain', 'Brakes', 'Accessories'];
export const CHANNELS = ['Webshop', 'Dealers', 'Marketplace'];

/** One month of sales for one region, product and channel. */
export interface SalesRow {
  /** 0 is the oldest month, 23 the latest. */
  index: number;
  /** Such as "Oct 2026". */
  month: string;
  region: string;
  product: string;
  channel: string;
  revenue: number;
  orders: number;
  customers: number;
  returns: number;
}

/** Filters a query can take. A value of "All", an empty string or an empty list means no filter. */
export interface Filters {
  region?: unknown;
  product?: unknown;
  channel?: unknown;
}

export interface Point {
  label: string;
  value: number;
}

const MONTHS = 24;
/** The latest month in the data is October 2026. */
const LAST_MONTH = new Date(Date.UTC(2026, 9, 1));

/** A small, fast seeded random generator (mulberry32). */
function random(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function monthLabel(index: number): string {
  const date = new Date(LAST_MONTH);
  date.setUTCMonth(date.getUTCMonth() - (MONTHS - 1 - index));
  return date.toLocaleString('en', {month: 'short', year: 'numeric', timeZone: 'UTC'});
}

function generate(): SalesRow[] {
  const next = random(20261019);
  const regionSize = {North: 1.2, South: 0.9, East: 0.75, West: 1.05} as Record<string, number>;
  const productPrice = {Wheels: 310, Drivetrain: 185, Brakes: 95, Accessories: 38} as Record<string, number>;
  const productVolume = {Wheels: 0.6, Drivetrain: 0.9, Brakes: 1.3, Accessories: 2.4} as Record<string, number>;
  const channelShare = {Webshop: 1.0, Dealers: 0.8, Marketplace: 0.45} as Record<string, number>;
  const returnRate = {Webshop: 0.06, Dealers: 0.025, Marketplace: 0.09} as Record<string, number>;

  const rows: SalesRow[] = [];
  for (let index = 0; index < MONTHS; index++) {
    const calendarMonth = (LAST_MONTH.getUTCMonth() - (MONTHS - 1 - index) + 24) % 12;
    // Cycling peaks in spring and summer; the business grows about 18% a year.
    const season = 1 + 0.35 * Math.sin(((calendarMonth - 2) / 12) * 2 * Math.PI);
    const growth = 1 + 0.18 * (index / 12);
    // Marketplace sales took off in the second year.
    const marketplaceBoost = index >= 12 ? 1.6 : 1;
    for (const region of REGIONS) {
      for (const product of PRODUCTS) {
        for (const channel of CHANNELS) {
          const boost = channel === 'Marketplace' ? marketplaceBoost : 1;
          const noise = 0.85 + next() * 0.3;
          const orders = Math.round(
            40 * regionSize[region] * productVolume[product] * channelShare[channel] * season * growth * boost * noise,
          );
          const price = productPrice[product] * (0.92 + next() * 0.16);
          rows.push({
            index,
            month: monthLabel(index),
            region,
            product,
            channel,
            orders,
            revenue: Math.round(orders * price),
            customers: Math.round(orders * (0.7 + next() * 0.15)),
            returns: Math.round(orders * returnRate[channel] * (0.7 + next() * 0.6)),
          });
        }
      }
    }
  }
  return rows;
}

export const SALES: readonly SalesRow[] = generate();

/** The latest month in the data, such as "Oct 2026". */
export const LATEST_MONTH = monthLabel(MONTHS - 1);

const PERIOD_MONTHS: Record<Period, number> = {lastMonth: 1, last3Months: 3, last12Months: 12};

export function isMeasure(value: unknown): value is Measure {
  return MEASURES.includes(value as Measure);
}

function wanted(filter: unknown): string[] {
  const values = (Array.isArray(filter) ? filter : [filter]).filter(
    (value): value is string => typeof value === 'string' && value !== '' && value !== 'All',
  );
  return values;
}

function matches(row: SalesRow, filters: Filters): boolean {
  for (const key of ['region', 'product', 'channel'] as const) {
    const values = wanted(filters[key]);
    if (values.length && !values.includes(row[key])) return false;
  }
  return true;
}

function periodOf(period: unknown): Period {
  // A ChoicePicker binds a list, so take its first value.
  if (Array.isArray(period)) period = period[0];
  return PERIODS.includes(period as Period) ? (period as Period) : 'last12Months';
}

/** The month indexes in a period, `back` periods before the latest one. */
function window(period: unknown, back = 0): [number, number] {
  const length = PERIOD_MONTHS[periodOf(period)];
  const end = MONTHS - length * back;
  return [end - length, end];
}

function measureOf(rows: SalesRow[], measure: Measure): number {
  if (measure === 'averageOrder') {
    const orders = rows.reduce((sum, row) => sum + row.orders, 0);
    return orders ? Math.round(rows.reduce((sum, row) => sum + row.revenue, 0) / orders) : 0;
  }
  return rows.reduce((sum, row) => sum + row[measure], 0);
}

function select(filters: Filters, [from, to]: [number, number]): SalesRow[] {
  return SALES.filter(row => row.index >= from && row.index < to && matches(row, filters));
}

/** The measure over a period, such as total revenue in the last 3 months. */
export function total(measure: Measure, filters: Filters = {}, period?: unknown): number {
  return measureOf(select(filters, window(period)), measure);
}

/** The percent change of a measure against the period before, rounded to one decimal. */
export function change(measure: Measure, filters: Filters = {}, period?: unknown): number {
  const now = measureOf(select(filters, window(period)), measure);
  const before = measureOf(select(filters, window(period, 1)), measure);
  return before ? Math.round(((now - before) / before) * 1000) / 10 : 0;
}

/** The measure split by a dimension, in month order or largest first. */
export function breakdown(measure: Measure, by: Dimension, filters: Filters = {}, period?: unknown): Point[] {
  const rows = select(filters, window(period));
  const groups = new Map<string, SalesRow[]>();
  for (const row of rows) {
    const key = row[by];
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const points = [...groups].map(([label, group]) => ({label, value: measureOf(group, measure)}));
  return by === 'month' ? points : points.sort((a, b) => b.value - a.value);
}
