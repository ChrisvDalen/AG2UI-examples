import {describe, expect, it} from 'vitest';
import {Session, type UserAction} from '../src/a2ui/session';
import {dashboard} from '../src/examples/dashboard';
import type {AgentContext} from '../src/examples';
import {SALES, breakdown, change, total, LATEST_MONTH} from '../src/data/sales';
import {formatValue} from '../src/a2ui/dashboard-catalog';
import {SYSTEM_PROMPT} from '../src/llm/system-prompt';

describe('sales data', () => {
  it('is the same on every run and ends in October 2026', () => {
    expect(SALES).toHaveLength(24 * 4 * 4 * 3);
    expect(LATEST_MONTH).toBe('Oct 2026');
    expect(total('revenue')).toBe(total('revenue'));
  });

  it('splits into parts that add up to the total', () => {
    const all = total('orders');
    const byRegion = breakdown('orders', 'region');
    expect(byRegion.map(p => p.label).sort()).toEqual(['East', 'North', 'South', 'West']);
    expect(byRegion.reduce((sum, p) => sum + p.value, 0)).toBe(all);
    // Largest first for categories, oldest first for months.
    expect(byRegion[0].value).toBeGreaterThanOrEqual(byRegion[1].value);
    const months = breakdown('orders', 'month');
    expect(months).toHaveLength(12);
    expect(months.at(-1)!.label).toBe('Oct 2026');
  });

  it('takes filters as a string, a list or "All", the way a ChoicePicker binds them', () => {
    const north = total('revenue', {region: 'North'});
    expect(total('revenue', {region: ['North']})).toBe(north);
    expect(total('revenue', {region: ['All']})).toBe(total('revenue'));
    expect(total('revenue', {region: ['North', 'South']})).toBe(north + total('revenue', {region: 'South'}));
    expect(total('revenue', {}, ['lastMonth'])).toBe(total('revenue', {}, 'lastMonth'));
    expect(total('revenue', {}, 'lastMonth')).toBeLessThan(total('revenue', {}, 'last3Months'));
  });

  it('computes change against the period before', () => {
    const now = total('orders');
    const pct = change('orders');
    expect(pct).toBeGreaterThan(0); // the shop grows year on year
    expect(Number.isFinite(pct)).toBe(true);
    expect(now).toBeGreaterThan(0);
  });
});

describe('formatValue', () => {
  it('formats compactly', () => {
    expect(formatValue(3_412_000, 'currency')).toBe('€3.4M');
    expect(formatValue(1204)).toBe('1,204');
    expect(formatValue(6.14, 'percent')).toBe('6.1%');
  });
});

describe('dashboard example', () => {
  it('composes the dashboard and adds tiles to the same surface on request', async () => {
    const session = new Session(() => {}, () => {});
    const agent = {reply: (cause: string, written: string) => session.reply(cause, written)} as AgentContext;
    await dashboard.start(agent);
    const act = (tile: string) =>
      dashboard.onAction!(
        {name: 'add_tile', surfaceId: 'sales', sourceComponentId: 'more', timestamp: '', context: {tile}} as UserAction,
        agent,
      );
    await act('products');
    await act('returns');

    expect(session.turns.map(turn => turn.error)).toEqual([undefined, undefined, undefined]);
    expect(session.surfaces).toHaveLength(1);
    // Follow-ups update components; only the first reply creates the surface.
    const kinds = session.turns.flatMap(turn => turn.messages.map(m => Object.keys(m).find(k => k !== 'version')));
    expect(kinds.filter(kind => kind === 'createSurface')).toHaveLength(1);
    const json = JSON.stringify(session.turns.map(turn => turn.messages));
    expect(json).toContain('"@call":"breakdown"');
    expect(json).toContain('"@path":"/filters/region"');
    // The tiles are bound to data functions, so no figure appears in what the agent wrote.
    for (const turn of session.turns) expect(turn.written).not.toMatch(/€|\b(?!20\d\d\b)\d{4,}\b/);
    session.dispose();
  });
});

describe('system prompt', () => {
  it('tells the model about the dashboard catalog and not to invent numbers', () => {
    expect(SYSTEM_PROMPT).toContain('Never type sales numbers yourself');
    expect(SYSTEM_PROMPT).toContain('Kpi(');
    expect(SYSTEM_PROMPT).toContain('breakdown(');
  });
});
