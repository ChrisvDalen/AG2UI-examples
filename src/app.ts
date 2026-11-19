import {LitElement, html, nothing, type PropertyValues} from 'lit';
import {ContextProvider} from '@lit/context';
import {Context} from '@a2ui/lit';
import '@a2ui/lit';
import {Session, promptContract, estimateTokens, type Turn, type UserAction} from './a2ui/session.js';
import {examples, type AgentContext, type Example} from './examples/index.js';
import {PLAYGROUND_SOURCE} from './examples/playground.js';
import {LIVE_SUGGESTIONS} from './examples/live.js';
import {LiveAgent} from './llm/live-agent.js';
import {highlightExpress, highlightJson} from './highlight.js';
import {renderMarkdown} from './markdown.js';
import {styles} from './styles.js';

type Pane = 'express' | 'json' | 'log';

const reducedMotion =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const kindOf = (message: Record<string, unknown>) =>
  Object.keys(message).find(key => key !== 'version') ?? 'unknown';

/** Says in a few words what a message is about, for the one-line log view. */
function describe(message: Record<string, any>): string {
  const kind = kindOf(message);
  const body = message[kind] ?? {};
  switch (kind) {
    case 'createSurface':
      return `${body.surfaceId} · ${body.components?.length ?? 0} components`;
    case 'updateComponents':
      return `${body.surfaceId} · ${body.components.map((c: {id: string}) => c.id).join(', ')}`;
    case 'updateDataModel':
      return `${body.surfaceId} · ${body.path ?? '/'}`;
    case 'action':
      return `${body.name} from ${body.sourceComponentId}`;
    case 'callRendererFunction':
      return `${body.callFunction['@call']}()`;
    case 'rendererFunctionResponse':
      return body.functionCallId;
    default:
      return '';
  }
}

export class ExamplesApp extends LitElement {
  static override styles = styles;

  static override properties = {
    selected: {state: true},
    pane: {state: true},
    source: {state: true},
    tick: {state: true},
    draft: {state: true},
  };

  declare selected: number;
  declare pane: Pane;
  /** The Express source in the playground's editor. */
  declare source: string;
  /** Bumped whenever the session changes, to re-render. */
  declare tick: number;
  /** What the visitor is typing in the live example. */
  declare draft: string;

  private session!: Session;
  private liveAgent?: LiveAgent;
  private editTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    super();
    const fromHash = examples.findIndex(example => `#${example.id}` === location.hash);
    this.selected = Math.max(0, fromHash);
    this.pane = 'express';
    this.source = PLAYGROUND_SOURCE;
    this.tick = 0;
    this.draft = '';
    // The renderer's Text component asks its host for a Markdown renderer.
    new ContextProvider(this, {context: Context.markdown as never, initialValue: renderMarkdown as never});
  }

  private get example(): Example {
    return examples[this.selected];
  }

  override connectedCallback() {
    super.connectedCallback();
    this.open();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.liveAgent?.dispose();
    this.session?.dispose();
  }

  /** Starts the selected example from the beginning. */
  private open() {
    this.liveAgent?.dispose();
    this.liveAgent = undefined;
    this.session?.dispose();
    const example = this.example;
    const changed = () => {
      if (session === this.session) this.tick++;
    };
    const session = new Session(action => {
      if (this.liveAgent) void this.liveAgent.act(action);
      else void example.onAction?.(action, agent);
    }, changed);
    const paced = reducedMotion ? {} : {chunkSize: 7, delayMs: 12};
    const agent: AgentContext = {
      reply: (cause, written) => session.reply(cause, written, paced),
      push: (cause, written) => session.reply(cause, written, {transient: true}),
      callRenderer: (name, catalogId, args) => session.callRenderer(name, catalogId, args),
      data: (surfaceId, path) => session.data(surfaceId, path),
      every: (ms, tick) => session.every(ms, tick),
    };
    this.session = session;
    this.tick++;
    if (example.live) {
      this.liveAgent = new LiveAgent(session, changed);
    } else if (example.editable) {
      void agent.push('Editor', `<a2ui>\n${this.source}\n</a2ui>`);
    } else {
      void example.start(agent).catch(error => console.error(error));
    }
  }

  private select(index: number) {
    if (index === this.selected) return;
    this.selected = index;
    history.replaceState(null, '', `#${examples[index].id}`);
    this.open();
  }

  private edit(event: Event) {
    this.source = (event.target as HTMLTextAreaElement).value;
    clearTimeout(this.editTimer);
    this.editTimer = setTimeout(() => this.open(), 250);
  }

  protected override updated(changed: PropertyValues) {
    // Keep the newest model output in view while it streams.
    if (changed.has('tick') && this.pane === 'express') {
      const pane = this.renderRoot.querySelector('.pane-body');
      const streaming = this.session.turns.some(turn => !turn.done);
      if (pane && streaming) pane.scrollTop = pane.scrollHeight;
    }
  }

  override render() {
    const example = this.example;
    return html`
      <header class="top">
        <div>
          <h1>A2UI 1.0 examples</h1>
          <p>
            An agent answers with interface instead of text. It writes compact
            <strong>A2UI Express</strong>; the page compiles that to A2UI 1.0 messages and renders
            them with Lit.
          </p>
        </div>
      </header>

      <nav aria-label="Examples">
        ${examples.map(
          (item, index) => html`
            <button
              class="example-tab"
              aria-current=${index === this.selected ? 'true' : 'false'}
              @click=${() => this.select(index)}
            >
              ${item.title}
            </button>
          `,
        )}
      </nav>

      <section class="intro">
        <p class="summary">${example.summary}</p>
        <ul class="features" aria-label="A2UI features used">
          ${example.features.map(feature => html`<li>${feature}</li>`)}
        </ul>
      </section>

      <main>
        <section class="chat" aria-label="Conversation">
          ${example.live
            ? this.renderLive()
            : example.editable
              ? this.renderEditor()
              : this.renderConversation()}
        </section>
        <section class="wire" aria-label="What went over the wire">${this.renderWire()}</section>
      </main>

      <footer>
        Built on <code>@a2ui/agent</code>, <code>@a2ui/web_core</code> and <code>@a2ui/lit</code>.
        The agents are scripted, so the examples run without a model or an API key, except
        <em>Live with Claude</em>, which needs one on the dev server. The Express prompt
        contract for these catalogs is about ${estimateTokens(promptContract).toLocaleString('en')}
        tokens.
      </footer>
    `;
  }

  private renderSurfaces() {
    return this.session.surfaces.map(
      surface => html`
        <div class="surface">
          <a2ui-surface .surface=${surface}></a2ui-surface>
        </div>
      `,
    );
  }

  private renderConversation() {
    const [first, ...rest] = this.session.turns.filter(turn => turn.cause !== 'Sensor feed');
    const feed = this.session.turns.find(turn => turn.cause === 'Sensor feed');
    return html`
      <div class="bar">
        <h2>Conversation</h2>
        <button class="ghost" @click=${() => this.open()}>Replay</button>
      </div>
      <p class="bubble user">${this.example.prompt}</p>
      ${first?.text ? html`<p class="bubble agent">${first.text}</p>` : nothing}
      ${this.renderSurfaces()}
      ${feed
        ? html`<p class="note">
            Sensor feed: ${feed.repeats + 1} data-only
            ${feed.repeats ? 'updates' : 'update'} so far. Drag the alarm slider below the latest
            reading: the gauge changes color without asking the agent.
          </p>`
        : nothing}
      ${rest.map(
        turn => html`
          <p class="event">${turn.cause}</p>
          ${turn.text ? html`<p class="bubble agent">${turn.text}</p>` : nothing}
        `,
      )}
      ${this.renderErrors()}
    `;
  }

  private renderLive() {
    const busy = this.liveAgent?.busy ?? false;
    const turns = this.session.turns;
    const submit = (event: Event) => {
      event.preventDefault();
      if (busy || !this.draft.trim()) return;
      void this.liveAgent?.ask(this.draft);
      this.draft = '';
    };
    return html`
      <div class="bar">
        <h2>Conversation</h2>
        <button class="ghost" ?disabled=${turns.length === 0} @click=${() => this.open()}>
          New conversation
        </button>
      </div>
      ${turns.length === 0
        ? html`<p class="note">
              Ask for something an interface would help with. Claude answers in Express; the page
              compiles and renders it as it streams.
            </p>
            <div class="suggestions">
              ${LIVE_SUGGESTIONS.map(
                text => html`<button class="ghost" @click=${() => void this.liveAgent?.ask(text)}>
                  ${text}
                </button>`,
              )}
            </div>`
        : nothing}
      ${turns.map(
        turn => html`
          ${turn.prompt !== undefined
            ? html`<p class="bubble user">${turn.prompt}</p>`
            : html`<p class="event">${turn.cause}</p>`}
          ${turn.text ? html`<p class="bubble agent">${turn.text}</p>` : nothing}
          ${!turn.done && !turn.written ? html`<p class="note">Claude is thinking…</p>` : nothing}
          ${turn.error ? html`<p class="error" role="alert">${turn.error}</p>` : nothing}
        `,
      )}
      ${this.renderSurfaces()}
      <form class="ask" @submit=${submit}>
        <input
          aria-label="Message to Claude"
          placeholder=${busy ? 'Claude is answering…' : 'Ask for an interface…'}
          .value=${this.draft}
          ?disabled=${busy}
          @input=${(event: Event) => (this.draft = (event.target as HTMLInputElement).value)}
        />
        <button class="primary" type="submit" ?disabled=${busy || !this.draft.trim()}>Send</button>
      </form>
    `;
  }

  private renderEditor() {
    const actions = this.session.log.filter(entry => 'action' in entry.message);
    const last = actions.at(-1)?.message.action as UserAction | undefined;
    return html`
      <div class="bar">
        <h2>Express source</h2>
        <button
          class="ghost"
          @click=${() => {
            this.source = PLAYGROUND_SOURCE;
            this.open();
          }}
        >
          Reset
        </button>
      </div>
      <textarea
        aria-label="A2UI Express source"
        spellcheck="false"
        autocapitalize="off"
        autocomplete="off"
        .value=${this.source}
        @input=${this.edit}
      ></textarea>
      ${this.renderErrors()} ${this.renderSurfaces()}
      ${last
        ? html`<p class="note">
            Last action: <code>${last.name}</code> with
            <code>${JSON.stringify(last.context)}</code>
          </p>`
        : html`<p class="note">
            Components: every basic one, plus <code>Gauge</code> and <code>Sparkline</code>. Bind
            data with <code>$/path</code>, add checks with <code>?required</code>.
          </p>`}
    `;
  }

  private renderErrors() {
    return this.session.turns
      .filter(turn => turn.error)
      .map(turn => html`<p class="error" role="alert">${turn.error}</p>`);
  }

  private renderWire() {
    const {expressTokens, jsonTokens} = this.session.totals;
    const saved = jsonTokens ? Math.round((1 - expressTokens / jsonTokens) * 100) : 0;
    const panes: Array<[Pane, string]> = [
      ['express', 'Model output'],
      ['json', 'A2UI 1.0 JSON'],
      ['log', `Messages (${this.session.log.length})`],
    ];
    return html`
      <div class="meter" aria-label="Estimated tokens">
        <div class="meter-row">
          <span>Express</span>
          <span class="track"
            ><span class="fill express" style="width:${jsonTokens ? (expressTokens / jsonTokens) * 100 : 0}%"></span
          ></span>
          <span class="count">${expressTokens.toLocaleString('en')}</span>
        </div>
        <div class="meter-row">
          <span>JSON</span>
          <span class="track"><span class="fill json" style="width:${jsonTokens ? 100 : 0}%"></span></span>
          <span class="count">${jsonTokens.toLocaleString('en')}</span>
        </div>
        <p class="meter-note">
          ${jsonTokens > expressTokens
            ? html`<strong>${saved}% fewer</strong> output tokens for the same interface.`
            : 'Nothing compiled yet.'}
          Estimated at 4 characters per token.
        </p>
      </div>

      <div class="tabs" role="tablist">
        ${panes.map(
          ([pane, label]) => html`
            <button
              role="tab"
              aria-selected=${this.pane === pane ? 'true' : 'false'}
              @click=${() => (this.pane = pane)}
            >
              ${label}
            </button>
          `,
        )}
      </div>
      <div class="pane-body" role="tabpanel">
        ${this.pane === 'log' ? this.renderLog() : this.session.turns.map(turn => this.renderTurn(turn))}
      </div>
    `;
  }

  private renderTurn(turn: Turn) {
    const repeats = turn.repeats ? ` · update ${turn.repeats + 1}` : '';
    return html`
      <h3 class="cause">${turn.cause}${repeats}</h3>
      ${this.pane === 'express'
        ? html`<pre>${highlightExpress(turn.written)}${turn.done ? nothing : html`<span class="caret"></span>`}</pre>`
        : html`<pre>${highlightJson(JSON.stringify(turn.messages, null, 2))}</pre>`}
    `;
  }

  private renderLog() {
    if (this.session.log.length === 0) return html`<p class="note">No messages yet.</p>`;
    return html`
      <ol class="log">
        ${this.session.log.map(
          entry => html`
            <li>
              <details>
                <summary>
                  <span class="dir ${entry.direction}"
                    >${entry.direction === 'agent' ? 'agent → renderer' : 'renderer → agent'}</span
                  >
                  <span class="kind">${kindOf(entry.message)}</span>
                  <span class="what">${describe(entry.message)}</span>
                </summary>
                <pre>${highlightJson(JSON.stringify(entry.message, null, 2))}</pre>
              </details>
            </li>
          `,
        )}
      </ol>
    `;
  }
}

customElements.define('examples-app', ExamplesApp);
