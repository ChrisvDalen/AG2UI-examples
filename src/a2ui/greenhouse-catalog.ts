/**
 * A small custom catalog that is mixed with the basic catalog on one surface.
 *
 * A2UI 1.0 lets a surface combine components and functions from several
 * catalogs: anything not in the surface's default catalog carries its own
 * `@catalogId`. This catalog adds two visual components the basic catalog
 * lacks, and one function the agent may call on the renderer.
 */
import {css, html, nothing, svg} from 'lit';
import {z} from 'zod';
import {
  Catalog,
  DynamicNumberSchema,
  DynamicStringSchema,
  DynamicValueSchema,
  createFunctionImplementation,
} from '@a2ui/web_core/v1_0';
import {A2uiLitElement, registerUniversalElement} from '@a2ui/web_core/universal';
import type {LitComponentApi} from '@a2ui/lit';

export const GREENHOUSE_CATALOG_ID = 'https://example.com/catalogs/greenhouse/v1/catalog.json';

const GaugeApi = {
  name: 'Gauge',
  schema: z
    .object({
      label: DynamicStringSchema.describe('The name of the measured quantity.'),
      value: DynamicNumberSchema.describe('The current reading.'),
      min: z.number().describe('The lowest value on the dial.').optional(),
      max: z.number().describe('The highest value on the dial.'),
      unit: z.string().describe('The unit shown after the reading, such as "°C".').optional(),
      warnAbove: DynamicNumberSchema.describe(
        'Readings above this value are drawn in the warning color.',
      ).optional(),
    })
    .strict(),
};

const SparklineApi = {
  name: 'Sparkline',
  schema: z
    .object({
      values: DynamicValueSchema.describe('The series to draw: a list of numbers, oldest first.'),
      label: DynamicStringSchema.describe('A short caption for the series.').optional(),
    })
    .strict(),
};

/** A half-circle dial with the reading in the middle. */
class GaugeElement extends A2uiLitElement<typeof GaugeApi> {
  protected override readonly api = GaugeApi;

  static override styles = css`
    :host {
      display: block;
      flex: 1;
      min-width: 0;
    }
    .gauge {
      display: grid;
      justify-items: center;
      gap: 2px;
    }
    svg {
      width: 100%;
      max-width: 132px;
      overflow: visible;
    }
    .track {
      stroke: var(--gh-track, #d7dde3);
    }
    .arc {
      stroke: var(--a2ui-color-primary, #0b7a43);
      transition:
        stroke-dashoffset 0.6s ease,
        stroke 0.3s;
    }
    .arc.warn {
      stroke: var(--gh-warn, #d9480f);
    }
    .reading {
      font: 600 20px/1 var(--a2ui-font-family, system-ui);
      fill: var(--a2ui-color-on-surface, #1b1f23);
      font-variant-numeric: tabular-nums;
    }
    .unit {
      font-size: 10px;
      fill: var(--a2ui-text-caption-color, #68727d);
    }
    .label {
      font-size: 12px;
      color: var(--a2ui-text-caption-color, #68727d);
    }
  `;

  override render() {
    const props = this.controller?.props;
    if (!props) return nothing;
    const min = props.min ?? 0;
    const value = Number(props.value ?? min);
    const span = props.max - min || 1;
    const fraction = Math.min(1, Math.max(0, (value - min) / span));
    // The dial is a half circle of radius 40, so its arc is π·40 long.
    const length = Math.PI * 40;
    const warn = props.warnAbove !== undefined && value > Number(props.warnAbove);
    return html`
      <div class="gauge" role="meter" aria-valuemin=${min} aria-valuemax=${props.max}
        aria-valuenow=${value} aria-label=${props.label ?? ''}>
        <svg viewBox="0 0 100 58">
          ${svg`
            <path class="track" d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke-width="8"
              stroke-linecap="round"></path>
            <path class=${warn ? 'arc warn' : 'arc'} d="M10 50 A40 40 0 0 1 90 50" fill="none"
              stroke-width="8" stroke-linecap="round" stroke-dasharray=${length}
              stroke-dashoffset=${length * (1 - fraction)}></path>
            <text class="reading" x="50" y="46" text-anchor="middle">${value}</text>
            <text class="unit" x="50" y="57" text-anchor="middle">${props.unit ?? ''}</text>
          `}
        </svg>
        <span class="label">${props.label}</span>
      </div>
    `;
  }
}

/** A line chart with no axes, for showing the shape of a recent series. */
class SparklineElement extends A2uiLitElement<typeof SparklineApi> {
  protected override readonly api = SparklineApi;

  static override styles = css`
    :host {
      display: block;
      flex: 1;
      min-width: 0;
    }
    svg {
      display: block;
      width: 100%;
      height: 44px;
    }
    polyline {
      fill: none;
      stroke: var(--a2ui-color-primary, #0b7a43);
      stroke-width: 2;
      stroke-linejoin: round;
      stroke-linecap: round;
      vector-effect: non-scaling-stroke;
    }
    polygon {
      fill: var(--a2ui-color-primary, #0b7a43);
      opacity: 0.12;
    }
    .label {
      font-size: 12px;
      color: var(--a2ui-text-caption-color, #68727d);
    }
  `;

  override render() {
    const props = this.controller?.props;
    if (!props) return nothing;
    const values = (Array.isArray(props.values) ? props.values : []).map(Number).filter(isFinite);
    if (values.length < 2) return html`<span class="label">${props.label}</span>`;
    const low = Math.min(...values);
    const high = Math.max(...values);
    const range = high - low || 1;
    const points = values
      .map((v, i) => `${(i / (values.length - 1)) * 100},${36 - ((v - low) / range) * 32}`)
      .join(' ');
    return html`
      <span class="label">${props.label}</span>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img"
        aria-label=${`${props.label ?? 'Series'}: ${low} to ${high}`}>
        ${svg`<polygon points="0,40 ${points} 100,40"></polygon><polyline points=${points}></polyline>`}
      </svg>
    `;
  }
}

const Gauge: LitComponentApi = {...GaugeApi, tagName: 'gh-gauge', element: GaugeElement};
const Sparkline: LitComponentApi = {
  ...SparklineApi,
  tagName: 'gh-sparkline',
  element: SparklineElement,
};
registerUniversalElement(Gauge);
registerUniversalElement(Sparkline);

/** What the renderer tells the agent about the device it runs on. */
export interface DeviceInfo extends Record<string, unknown> {
  viewportWidth: number;
  viewportHeight: number;
  locale: string;
  timeZone: string;
  colorScheme: 'dark' | 'light';
  touch: boolean;
}

/**
 * `deviceInfo()` may be called by the agent (`rendererOrAgent`), which is what
 * makes it reachable through a `callRendererFunction` message. Functions are
 * `rendererOnly` unless their catalog says otherwise.
 */
const DeviceInfo = createFunctionImplementation(
  {
    name: 'deviceInfo',
    description: 'Describes the device the renderer runs on: viewport, locale, time zone and color scheme.',
    returnType: 'object',
    allowedCallers: 'rendererOrAgent',
    schema: z.object({}).strict(),
  },
  (): DeviceInfo => {
    const hasWindow = typeof window !== 'undefined';
    return {
      viewportWidth: hasWindow ? window.innerWidth : 0,
      viewportHeight: hasWindow ? window.innerHeight : 0,
      locale: typeof navigator !== 'undefined' ? navigator.language : 'en',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      colorScheme:
        hasWindow && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      touch: typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0,
    };
  },
);

export const greenhouseCatalog = new Catalog<LitComponentApi>(
  GREENHOUSE_CATALOG_ID,
  '1.0',
  [Gauge, Sparkline],
  [DeviceInfo],
);
