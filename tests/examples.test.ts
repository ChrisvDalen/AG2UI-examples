import {describe, expect, it, vi} from 'vitest';
import {Session, expressOf, leanJson, type UserAction} from '../src/a2ui/session';
import {examples, type AgentContext, type Example} from '../src/examples';

/** Runs an example's scripted agent against a renderer with no page. */
function open(example: Example) {
  const session = new Session(() => {}, () => {});
  const agent: AgentContext = {
    reply: (cause, written) => session.reply(cause, written),
    push: (cause, written) => session.reply(cause, written, {transient: true}),
    callRenderer: (name, catalogId, args) => session.callRenderer(name, catalogId, args),
    data: (surfaceId, path) => session.data(surfaceId, path),
    every: () => {},
  };
  const act = (name: string, surfaceId: string, context: Record<string, unknown> = {}) =>
    example.onAction?.(
      {name, surfaceId, context, sourceComponentId: 'test', timestamp: new Date().toISOString()} as UserAction,
      agent,
    );
  return {session, agent, act};
}

const errors = (session: Session) => session.turns.map(turn => turn.error).filter(Boolean);

describe('every example', () => {
  for (const example of examples) {
    it(`${example.id}: the opening reply compiles and creates a surface`, async () => {
      const {session, agent} = open(example);
      await example.start(agent);
      expect(errors(session)).toEqual([]);
      expect(session.surfaces).toHaveLength(1);
      const [first] = session.turns[0].messages as any[];
      expect(first.version).toBe('1.0');
      expect(first.createSurface.components.some((c: any) => c.id === 'root')).toBe(true);
      session.dispose();
    });
  }
});

describe('follow-up turns', () => {
  it('dinner: picking a table and confirming update the same surface', async () => {
    const {session, agent, act} = open(examples.find(e => e.id === 'dinner')!);
    await examples[0].start(agent);
    await act('pick_table', 'dinner', {id: 'nami', name: 'Nami'});
    expect(session.data('dinner', '/table')).toBe('nami');
    await act('confirm', 'dinner', {slot: ['20:15'], table: 'nami', ride: true});
    expect(errors(session)).toEqual([]);
    expect(session.data('dinner', '/status')).toBe('Confirmed · Friday 20:15');
    expect(JSON.stringify(session.turns[2].messages)).toContain('Ride home booked for 22:15');
    session.dispose();
  });

  it('greenhouse: mixes two catalogs and takes data-only updates', async () => {
    vi.useFakeTimers();
    const example = examples.find(e => e.id === 'greenhouse')!;
    const {session, agent, act} = open(example);
    const ticks: Array<() => void> = [];
    agent.every = (_ms, tick) => void ticks.push(tick);
    await example.start(agent);
    const components = (session.turns[0].messages[0] as any).createSurface.components;
    const catalogOf = (id: string) => components.find((c: any) => c.component === id).catalogId;
    expect(catalogOf('Gauge')).toContain('greenhouse');
    expect(catalogOf('Card')).toContain('a2ui.org');
    await act('open_vents', 'tunnel');
    ticks[0]();
    ticks[0]();
    await session.reply('flush', '<a2ui>\nsurface("tunnel")\n$/vents = "x"\n</a2ui>');
    const feed = session.turns.find(turn => turn.cause === 'Sensor feed')!;
    expect(feed.messages.every((m: any) => m.updateDataModel)).toBe(true);
    expect(feed.repeats).toBe(1);
    expect(session.turns.filter(turn => turn.cause === 'Sensor feed')).toHaveLength(1);
    expect(session.data('tunnel', '/history')).toHaveLength(10);
    expect(errors(session)).toEqual([]);
    session.dispose();
    vi.useRealTimers();
  });

  it('signup, trip: the action replies compile', async () => {
    const signup = open(examples.find(e => e.id === 'signup')!);
    await examples.find(e => e.id === 'signup')!.start(signup.agent);
    await signup.act('signup', 'signup', {name: 'Sam', email: 'sam@example.com', code: 'ABC-1234'});
    expect(errors(signup.session)).toEqual([]);

    const trip = open(examples.find(e => e.id === 'trip')!);
    await examples.find(e => e.id === 'trip')!.start(trip.agent);
    await trip.act('replan', 'trip', {from: '2027-03-18T00:00:00Z', nights: 4, travellers: ['2']});
    expect(errors(trip.session)).toEqual([]);
    expect(trip.session.data('trip', '/days')).toHaveLength(5);
    expect((trip.session.data('trip', '/days') as any[])[0].day).toBe('Thursday');
  });

  it('device: the agent calls deviceInfo() on the renderer before it draws', async () => {
    const example = examples.find(e => e.id === 'device')!;
    const {session, agent, act} = open(example);
    await example.start(agent);
    const kinds = session.log.map(entry => Object.keys(entry.message).find(key => key !== 'version'));
    expect(kinds.slice(0, 3)).toEqual(['callRendererFunction', 'rendererFunctionResponse', 'createSurface']);
    await act('ask_again', 'dashboard');
    expect(errors(session)).toEqual([]);
    session.dispose();
  });
});

describe('Express', () => {
  it('is shorter than the JSON it compiles to', async () => {
    for (const example of examples) {
      const {session, agent} = open(example);
      await example.start(agent);
      const express = expressOf(session.turns.at(-1)!.written);
      const json = leanJson(session.turns.at(-1)!.messages);
      expect(express.length, example.id).toBeLessThan(json.length);
      console.log(`${example.id}: Express ${express.length} chars, JSON ${json.length} chars`);
      session.dispose();
    }
  });

  it('reports a compile error instead of throwing', async () => {
    const {session} = open(examples[0]);
    const turn = await session.reply('test', '<a2ui>\nsurface("x")\nroot = Nope("hi")\n</a2ui>');
    expect(turn.error).toMatch(/Nope/);
  });
});
