import {html, type TemplateResult} from 'lit';

const EXPRESS =
  /(<\/?a2ui>)|("(?:\\.|[^"\\])*")|(#.*|\/\/.*)|(\$[A-Za-z0-9_/]*)|(\?[A-Za-z_]\w*)|\b([A-Z][A-Za-z]*)(?=\()|\b(\d+(?:\.\d+)?)\b/g;
const EXPRESS_CLASSES = ['tag', 'str', 'com', 'path', 'check', 'comp', 'num'];

const JSON_TOKENS = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)/g;

function paint(
  source: string,
  pattern: RegExp,
  classOf: (match: RegExpExecArray) => string,
): Array<string | TemplateResult> {
  const out: Array<string | TemplateResult> = [];
  let last = 0;
  pattern.lastIndex = 0;
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    if (match.index > last) out.push(source.slice(last, match.index));
    out.push(html`<span class=${classOf(match)}>${match[0]}</span>`);
    last = match.index + match[0].length;
    if (match[0].length === 0) pattern.lastIndex++;
  }
  out.push(source.slice(last));
  return out;
}

/** Colors a model reply: prose is left alone, Express is highlighted. */
export function highlightExpress(source: string) {
  return paint(source, EXPRESS, match => EXPRESS_CLASSES[match.findIndex((g, i) => i > 0 && g !== undefined) - 1]);
}

/** Colors pretty-printed JSON. */
export function highlightJson(source: string) {
  return paint(source, JSON_TOKENS, match =>
    match[1] ? (match[2] ? 'key' : 'str') : match[3] ? 'kw' : 'num',
  );
}
