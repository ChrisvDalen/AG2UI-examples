/**
 * The agent of the live example: Claude, reached through /api/chat.
 *
 * It keeps the conversation the model sees, turns user actions on a surface
 * into messages, and asks the model once to fix a reply whose Express does not
 * compile.
 */
import type {Session, Turn, UserAction} from '../a2ui/session.js';
import {streamClaude, type ChatMessage} from './client.js';

/** How much of a surface's data model goes along with an action. */
const MAX_DATA_CHARS = 4000;

export class LiveAgent {
  /** True while a reply is streaming or waiting to start. */
  busy = false;

  private readonly history: ChatMessage[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  private readonly abort = new AbortController();

  constructor(
    private readonly session: Session,
    private readonly onChange: () => void,
  ) {}

  /** Sends what the user typed. */
  ask(prompt: string): Promise<void> {
    const text = prompt.trim();
    if (!text) return Promise.resolve();
    return this.enqueue(() => this.exchange(text, `You: ${text}`, text));
  }

  /** Tells the model the user used its interface. */
  act(action: UserAction): Promise<void> {
    const data = this.session.data(action.surfaceId, '/');
    let dataJson = JSON.stringify(data ?? {});
    if (dataJson.length > MAX_DATA_CHARS) dataJson = `${dataJson.slice(0, MAX_DATA_CHARS)}… (truncated)`;
    const content = [
      `[action] ${action.name} on surface "${action.surfaceId}"`,
      `context: ${JSON.stringify(action.context)}`,
      `data model: ${dataJson}`,
    ].join('\n');
    return this.enqueue(() => this.exchange(content, `Action: ${action.name}`));
  }

  dispose(): void {
    this.abort.abort();
  }

  private enqueue(run: () => Promise<void>): Promise<void> {
    this.busy = true;
    this.onChange();
    const result = this.queue.then(run, run).finally(() => {
      if (result === this.queue) {
        this.busy = false;
        this.onChange();
      }
    });
    this.queue = result;
    return result;
  }

  /** One user message and the reply to it, plus one repair if the reply did not compile. */
  private async exchange(content: string, cause: string, prompt?: string): Promise<void> {
    const turn = await this.send(content, cause, prompt);
    if (turn?.error && turn.written) {
      await this.send(`[compile error] ${turn.error}`, 'Repair after a compile error');
    }
  }

  /**
   * Sends one message and streams the reply into the session. Returns the turn
   * when the model answered, even if its Express did not compile, and nothing
   * when the request itself failed.
   */
  private async send(content: string, cause: string, prompt?: string): Promise<Turn | undefined> {
    if (this.abort.signal.aborted) return undefined;
    this.history.push({role: 'user', content});
    let requestFailed = false;
    const chunks = streamClaude(structuredClone(this.history), this.abort.signal);
    const tracked = (async function* () {
      try {
        yield* chunks;
      } catch (error) {
        requestFailed = true;
        throw error;
      }
    })();
    const turn = await this.session.replyStream(cause, tracked, {prompt});
    if (requestFailed) {
      // Forget the failed exchange, so a retry starts from the same place.
      this.history.pop();
      return undefined;
    }
    if (turn.written) this.history.push({role: 'assistant', content: turn.written});
    return turn;
  }
}
