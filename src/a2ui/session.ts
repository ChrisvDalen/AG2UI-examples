/**
 * One conversation between a scripted agent and the renderer on this page.
 *
 * The agent side writes what a model would write: prose with an `<a2ui>` block
 * of A2UI Express. `@a2ui/agent` compiles that into A2UI 1.0 messages as the
 * text arrives, checks each one, and applies it to the `MessageProcessor` the
 * surfaces are rendered from.
 */
import {
  A2uiGenerator,
  CatalogConfig,
  ExpressFormatFactory,
  RendererState,
  type A2uiRequestProcessor,
} from '@a2ui/agent';
import {MessageProcessor} from '@a2ui/web_core/v1_0';
import {basicCatalog} from '@a2ui/web_core/catalogs/basic/v1';
import {greenhouseCatalog} from './greenhouse-catalog.js';

/** Any A2UI message, in either direction. */
export type WireMessage = Record<string, unknown>;

/** A user action as the renderer reports it to the agent. */
export interface UserAction {
  name: string;
  surfaceId: string;
  sourceComponentId: string;
  timestamp: string;
  context: Record<string, unknown>;
}

export interface LogEntry {
  direction: 'agent' | 'renderer';
  message: WireMessage;
}

/** One reply of the agent: what it wrote and what that compiled to. */
export interface Turn {
  /** Why the agent spoke, such as the user's prompt or the action it answers. */
  cause: string;
  /** The reply as written so far, prose and Express together. */
  written: string;
  /** The prose outside the `<a2ui>` block. */
  text: string;
  /** The A2UI 1.0 messages the reply compiled to. */
  messages: WireMessage[];
  error?: string;
  done: boolean;
  /** How many earlier turns with the same cause this one replaced. */
  repeats: number;
  /** What the user typed, when a person rather than an action caused the reply. */
  prompt?: string;
}

export interface StreamOptions {
  /** Characters fed to the compiler per step. Zero feeds the reply at once. */
  chunkSize?: number;
  /** Milliseconds between steps. */
  delayMs?: number;
  /**
   * Replaces the earlier turn with the same cause instead of adding one, so a
   * feed that never ends does not grow the transcript without bound.
   */
  transient?: boolean;
  /** What the user typed, if a person caused this reply. */
  prompt?: string;
}

// The catalog classes of `@a2ui/web_core` are generic over the renderer's
// component type, which the agent SDK does not know about.
/* eslint-disable @typescript-eslint/no-explicit-any */
const catalogs = [basicCatalog, greenhouseCatalog] as any[];
const generator = new A2uiGenerator(catalogs.map(catalog => new CatalogConfig(catalog)));

function createProcessor(): A2uiRequestProcessor {
  return generator.createProcessor(
    {supportedCatalogIds: catalogs.map(catalog => catalog.id)} as any,
    new ExpressFormatFactory(),
  );
}

/** The system prompt section a real model would be given for these catalogs. */
export const promptContract: string = createProcessor().promptSnippet;

const EXPRESS_BLOCK = /<a2ui>([\s\S]*?)(<\/a2ui>|$)/g;

/** Returns the Express source inside the `<a2ui>` blocks of a reply. */
export function expressOf(written: string): string {
  return [...written.matchAll(EXPRESS_BLOCK)].map(match => match[1].trim()).join('\n');
}

/**
 * Estimates a token count as a quarter of the character count.
 *
 * This is a rule of thumb, not a tokenizer. Real tokenizers split JSON
 * punctuation into more tokens than prose, so the estimate flatters JSON and
 * understates what Express saves.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Serializes messages the way a model writing JSON by hand could at best.
 *
 * With two catalogs active the Express compiler tags every component with its
 * `catalogId`. Hand-written JSON would name the basic catalog once, as the
 * surface default, and tag only the components from the other catalog. Token
 * comparisons use this leaner form, so the repeated ID does not count against
 * JSON.
 */
export function leanJson(messages: WireMessage[]): string {
  const lean = structuredClone(messages) as any[];
  for (const message of lean) {
    const body = message.createSurface ?? message.updateComponents;
    if (!body?.components) continue;
    if (message.createSurface) body.catalogId ??= basicCatalog.id;
    for (const component of body.components) {
      if (component.catalogId === basicCatalog.id) delete component.catalogId;
    }
  }
  return JSON.stringify(lean);
}

const MAX_LOG_ENTRIES = 200;

function emptyTurn(cause: string): Turn {
  return {cause, written: '', text: '', messages: [], done: false, repeats: 0};
}

/** Cuts a finished reply into pieces, to replay it the way a model streams. */
async function* paced(written: string, {chunkSize, delayMs}: StreamOptions): AsyncGenerator<string> {
  const size = chunkSize || written.length;
  for (let at = 0; at < written.length; at += size) {
    if (at > 0 && delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
    yield written.slice(at, at + size);
  }
}

export class Session {
  readonly renderer: MessageProcessor<any>;
  readonly turns: Turn[] = [];
  readonly log: LogEntry[] = [];
  /** The surfaces the agent created, oldest first. */
  readonly surfaces: any[] = [];

  private readonly processor = createProcessor();
  private readonly state: RendererState;
  /**
   * A second compiler with no renderer behind it, used only to measure. A
   * streamed reply reaches the renderer as many small messages, which repeat
   * the message envelope; compiling the finished reply once gives the JSON a
   * model would have had to write instead of the Express.
   */
  private readonly measure = createProcessor();
  private readonly measureState = this.measure.createState();
  private readonly timers = new Set<ReturnType<typeof setInterval>>();
  private queue: Promise<unknown> = Promise.resolve();
  private disposed = false;
  private expressChars = 0;
  private jsonChars = 0;

  constructor(
    private readonly onAction: (action: UserAction) => void,
    private readonly onChange: () => void,
  ) {
    this.renderer = new MessageProcessor<any>(
      catalogs,
      ((action: UserAction) => {
        this.log.push({direction: 'renderer', message: {version: '1.0', action}});
        this.onChange();
        this.onAction(action);
      }) as any,
      {
        outboundListener: (message: WireMessage) => {
          this.log.push({direction: 'renderer', message});
          this.onChange();
        },
      } as any,
    );
    this.renderer.onSurfaceCreated((surface: any) => {
      this.surfaces.push(surface);
      this.onChange();
    });
    this.renderer.onSurfaceDeleted((surfaceId: string) => {
      const index = this.surfaces.findIndex(surface => surface.id === surfaceId);
      if (index >= 0) this.surfaces.splice(index, 1);
      this.onChange();
    });
    this.state = RendererState.of(this.renderer as any);
  }

  /**
   * Streams one reply of the agent into the renderer.
   *
   * Replies run one after another, so a reply that starts while another is
   * still streaming waits for it.
   */
  reply(cause: string, written: string, options: StreamOptions = {}): Promise<Turn> {
    if (!written) return Promise.resolve(emptyTurn(cause));
    return this.enqueue(() => this.stream(cause, paced(written, options), options));
  }

  /**
   * Streams a reply whose text arrives in pieces, such as a model's output,
   * into the renderer. Each piece is compiled as soon as it arrives, so the
   * surface builds up while the model is still writing.
   *
   * An error thrown by `chunks` ends the turn with that error, like an error
   * of the compiler does.
   */
  replyStream(cause: string, chunks: AsyncIterable<string>, options: StreamOptions = {}): Promise<Turn> {
    return this.enqueue(() => this.stream(cause, chunks, options));
  }

  private enqueue(run: () => Promise<Turn>): Promise<Turn> {
    const result = this.queue.then(run, run);
    this.queue = result;
    return result;
  }

  private async stream(cause: string, chunks: AsyncIterable<string>, options: StreamOptions): Promise<Turn> {
    const turn = emptyTurn(cause);
    if (options.prompt !== undefined) turn.prompt = options.prompt;
    if (this.disposed) return turn;
    if (options.transient) {
      const earlier = this.turns.findIndex(other => other.cause === cause && other.done);
      if (earlier >= 0) {
        turn.repeats = this.turns[earlier].repeats + 1;
        this.turns.splice(earlier, 1);
      }
    }
    this.turns.push(turn);
    const stream = this.processor.openStream({state: this.state});
    const take = (parts: Iterable<any>) => {
      for (const part of parts) {
        if (part.type === 'text') {
          turn.text += part.text;
        } else if (part.type === 'a2ui') {
          turn.messages.push(...part.a2ui);
          for (const message of part.a2ui) this.log.push({direction: 'agent', message});
        }
      }
    };
    try {
      for await (const chunk of chunks) {
        if (this.disposed) break;
        turn.written += chunk;
        take(stream.feed(chunk));
        this.onChange();
      }
      if (!this.disposed) take(stream.close());
    } catch (error) {
      turn.error = error instanceof Error ? error.message : String(error);
      take((error as {partialResults?: Iterable<any>}).partialResults ?? []);
    }
    turn.text = turn.text.trim();
    turn.done = true;
    if (!turn.error) {
      this.expressChars += expressOf(turn.written).length;
      this.jsonChars += this.jsonLength(turn);
    }
    if (this.log.length > MAX_LOG_ENTRIES) this.log.splice(0, this.log.length - MAX_LOG_ENTRIES);
    this.onChange();
    return turn;
  }

  /**
   * Calls a renderer function on behalf of the agent, with a
   * `callRendererFunction` message, and returns the value the renderer sends
   * back in its `rendererFunctionResponse`.
   */
  async callRenderer(name: string, catalogId: string, args: Record<string, unknown> = {}) {
    const message = {
      version: '1.0',
      callRendererFunction: {
        functionCallId: `call-${this.log.length + 1}`,
        callFunction: {'@call': name, catalogId, args},
      },
    };
    this.log.push({direction: 'agent', message});
    this.onChange();
    const [response] = (await this.renderer.processMessagesAsync([message as any])) as any[];
    const result = response?.rendererFunctionResponse;
    if (!result || result.error) {
      throw new Error(result?.error?.message ?? `The renderer did not answer ${name}().`);
    }
    return result.value;
  }

  /** Reads a value from a surface's data model, as the agent last saw it. */
  data(surfaceId: string, path: string): unknown {
    return this.renderer.model.getSurface(surfaceId)?.dataModel.get(path);
  }

  /** Runs `tick` on an interval until the session is disposed. */
  every(ms: number, tick: () => void): void {
    this.timers.add(setInterval(tick, ms));
  }

  /** The length of the JSON a finished reply stands for, compiled in one piece. */
  private jsonLength(turn: Turn): number {
    try {
      const parts = this.measure.parseResponse(turn.written, {state: this.measureState}) as any[];
      return leanJson(parts.flatMap(part => (part.type === 'a2ui' ? part.a2ui : []))).length;
    } catch {
      return leanJson(turn.messages).length;
    }
  }

  /** Estimated tokens of all Express written so far, and of the JSON it stands for. */
  get totals() {
    return {
      expressTokens: Math.ceil(this.expressChars / 4),
      jsonTokens: Math.ceil(this.jsonChars / 4),
    };
  }

  dispose(): void {
    this.disposed = true;
    for (const timer of this.timers) clearInterval(timer);
    this.timers.clear();
    this.renderer.dispose();
  }
}
