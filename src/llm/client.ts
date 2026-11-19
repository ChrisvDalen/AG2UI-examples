/** The browser side of /api/chat: sends the conversation, yields the reply as it streams. */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Streams Claude's reply to `messages`, piece by piece.
 *
 * Throws if the server reports an error, including one that arrives after part
 * of the reply has already been yielded.
 */
export async function* streamClaude(messages: ChatMessage[], signal?: AbortSignal): AsyncGenerator<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({messages}),
    signal,
  });
  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      response.status === 404
        ? 'No /api/chat here. The live example needs the dev server: npm run dev.'
        : `The server answered ${response.status}${detail ? `: ${detail}` : ''}`,
    );
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let done = false;
  while (!done) {
    const read = await reader.read();
    if (read.done) break;
    buffer += read.value;
    let newline: number;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const event = JSON.parse(line) as {text?: string; error?: string; done?: boolean};
      if (event.error) throw new Error(event.error);
      if (event.text) yield event.text;
      if (event.done) done = true;
    }
  }
  if (!done) throw new Error('The connection closed before the reply was complete.');
}
