import type {UserAction} from '../a2ui/session.js';

/** What a scripted agent can do during a conversation. */
export interface AgentContext {
  /** Streams a reply, written the way a model writes it, into the renderer. */
  reply(cause: string, written: string): Promise<unknown>;
  /**
   * Applies a reply at once, for small updates that should not animate. A push
   * replaces the previous push with the same cause in the transcript.
   */
  push(cause: string, written: string): Promise<unknown>;
  /** Calls a renderer function with `callRendererFunction` and awaits its value. */
  callRenderer(name: string, catalogId: string, args?: Record<string, unknown>): Promise<any>;
  /** Reads a value from a surface's data model. */
  data(surfaceId: string, path: string): any;
  /** Runs `tick` on an interval for as long as the example is open. */
  every(ms: number, tick: () => void): void;
}

export interface Example {
  id: string;
  title: string;
  /** One sentence on what the example shows. */
  summary: string;
  /** The A2UI 1.0 features the example uses. */
  features: string[];
  /** What the user asked the agent. */
  prompt: string;
  /** Sends the agent's first answer. */
  start(agent: AgentContext): Promise<void>;
  /** Answers a user action on a surface. */
  onAction?(action: UserAction, agent: AgentContext): Promise<void> | void;
  /** True for the example whose Express source the visitor edits. */
  editable?: boolean;
  /** True for the example answered by a real model instead of a script. */
  live?: boolean;
}
