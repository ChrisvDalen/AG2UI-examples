import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({html: false, linkify: false});

/**
 * Renders the Markdown of a Text component to sanitized HTML.
 *
 * The Lit renderer asks its host for a Markdown renderer through a context and
 * shows the raw text when none is given.
 */
export function renderMarkdown(source: string): Promise<string> {
  return Promise.resolve(DOMPurify.sanitize(markdown.render(source)));
}
