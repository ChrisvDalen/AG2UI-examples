/**
 * A Vite dev-server plugin that lets the page talk to Claude without ever
 * seeing the API key.
 *
 * The browser POSTs the conversation to /api/chat. The server adds the system
 * prompt, streams the reply from the Claude API and passes the text on as
 * newline-delimited JSON:
 *
 *   {"text": "..."}               a piece of the reply
 *   {"error": "..."}              the reply failed; nothing more follows
 *   {"done": true, "model": "…"}  the reply is complete
 */
import Anthropic from '@anthropic-ai/sdk';
import type {IncomingMessage, ServerResponse} from 'node:http';
import type {Plugin, ViteDevServer} from 'vite';

type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
const EFFORT: Effort = EFFORTS.includes(process.env.CLAUDE_EFFORT as Effort)
  ? (process.env.CLAUDE_EFFORT as Effort)
  : 'medium';

/**
 * The dev server listens on every interface (`host: true`), so without this
 * anyone on the same network could spend your credits through /api/chat.
 */
const ALLOW_REMOTE = process.env.CLAUDE_PROXY_ALLOW_REMOTE === '1';

/** Limits that keep a stray or hostile page from running up the bill. */
const MAX_BODY_BYTES = 200_000;
const MAX_MESSAGES = 60;

export function claudeProxy(): Plugin {
  return {
    name: 'claude-proxy',
    configureServer(server) {
      let client: Anthropic | undefined;
      server.middlewares.use('/api/chat', (req, res) => {
        client ??= new Anthropic();
        void handle(server, client, req, res);
      });
    },
  };
}

async function handle(server: ViteDevServer, client: Anthropic, req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end();
    return;
  }
  if (!ALLOW_REMOTE && !isLoopback(req.socket.remoteAddress)) {
    res.statusCode = 403;
    res.end('/api/chat only answers this machine. Set CLAUDE_PROXY_ALLOW_REMOTE=1 to allow others.');
    return;
  }

  let messages: Anthropic.Beta.BetaMessageParam[];
  try {
    messages = parseConversation(await readBody(req));
  } catch (error) {
    res.statusCode = 400;
    res.end(error instanceof Error ? error.message : 'Bad request');
    return;
  }

  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const send = (event: Record<string, unknown>) => res.write(`${JSON.stringify(event)}\n`);

  try {
    // Loaded through Vite so the prompt is built from the same TypeScript as
    // the page, and picks up edits without a restart.
    const {SYSTEM_PROMPT} = (await server.ssrLoadModule('/src/llm/system-prompt.ts')) as {
      SYSTEM_PROMPT: string;
    };

    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      output_config: {effort: EFFORT},
      // The prompt contract is about 6,000 tokens and identical on every turn.
      system: [{type: 'text', text: SYSTEM_PROMPT, cache_control: {type: 'ephemeral'}}],
      messages,
      // If a safety classifier declines, the API retries on the model it
      // recommends for that case, on the same stream.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
    res.on('close', () => {
      if (!res.writableFinished) stream.abort();
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        send({text: event.delta.text});
      }
    }

    const message = await stream.finalMessage();
    if (message.stop_reason === 'refusal') {
      send({error: 'Claude declined this request.'});
    } else if (message.stop_reason === 'max_tokens') {
      send({error: 'The reply was cut off at the token limit.'});
    } else {
      send({done: true, model: message.model});
    }
  } catch (error) {
    send({error: describeError(error)});
  }
  res.end();
}

function isLoopback(address: string | undefined): boolean {
  return address === '::1' || address === '127.0.0.1' || address?.startsWith('::ffff:127.') === true
    || address?.startsWith('127.') === true;
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return 'The Claude API rejected the credentials. Check ANTHROPIC_API_KEY.';
  }
  if (error instanceof Anthropic.RateLimitError) return 'Rate limited by the Claude API. Try again shortly.';
  if (error instanceof Anthropic.APIUserAbortError) return 'The request was cancelled.';
  if (error instanceof Anthropic.APIError) return `Claude API error ${error.status ?? ''}: ${error.message}`;
  if (error instanceof Error && /credentials|api key|apiKey/i.test(error.message)) {
    return 'No Claude credentials found. Set ANTHROPIC_API_KEY before running npm run dev.';
  }
  return error instanceof Error ? error.message : String(error);
}

/** Accepts only plain user/assistant text turns: the server owns everything else. */
export function parseConversation(body: string): Anthropic.Beta.BetaMessageParam[] {
  const parsed = JSON.parse(body) as {messages?: unknown};
  const list = parsed.messages;
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_MESSAGES) {
    throw new Error(`Send between 1 and ${MAX_MESSAGES} messages.`);
  }
  const messages = list.map(item => {
    const {role, content} = (item ?? {}) as {role?: unknown; content?: unknown};
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string' || !content) {
      throw new Error('Each message needs a role of user or assistant and text content.');
    }
    return {role, content} as Anthropic.Beta.BetaMessageParam;
  });
  if (messages[0].role !== 'user' || messages.at(-1)!.role !== 'user') {
    throw new Error('The conversation must start and end with a user message.');
  }
  return messages;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const parts: Buffer[] = [];
    req.on('data', (part: Buffer) => {
      size += part.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large.'));
        req.destroy();
      } else {
        parts.push(part);
      }
    });
    req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
    req.on('error', reject);
  });
}
