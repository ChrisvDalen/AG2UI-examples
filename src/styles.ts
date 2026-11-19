import {css} from 'lit';

export const styles = css`
  :host {
    --bg: #f6f5f1;
    --panel: #ffffff;
    --sunken: #efede7;
    --ink: #1b1f23;
    --muted: #5d666f;
    --line: #dedbd2;
    --accent: #0b6e4f;
    --on-accent: #ffffff;
    --accent-soft: #dcefe6;
    --json: #a8a296;
    --danger: #b3261e;
    --warn: #c2410c;
    --code-str: #9a3412;
    --code-key: #1d4ed8;
    --code-path: #0b6e4f;
    --code-comp: #6d28d9;
    --code-num: #b45309;
    --mono: ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, Consolas, monospace;

    /* The A2UI renderer reads its theme from these custom properties. */
    --a2ui-color-primary: var(--accent);
    --a2ui-color-on-primary: var(--on-accent);
    --a2ui-color-surface: var(--panel);
    --a2ui-color-on-surface: var(--ink);
    --a2ui-color-background: var(--panel);
    --a2ui-color-on-background: var(--ink);
    --a2ui-color-border: var(--line);
    --a2ui-color-input: var(--panel);
    --a2ui-color-on-input: var(--ink);
    --a2ui-text-color-text: var(--ink);
    --a2ui-text-caption-color: var(--muted);
    --a2ui-textfield-color-error: var(--danger);
    --a2ui-slider-color-error: var(--danger);
    --a2ui-checkbox-color-error: var(--danger);
    --a2ui-border-radius: 10px;
    --a2ui-spacing-m: 12px;
    --a2ui-button-padding: 8px 14px;
    --a2ui-button-margin: 4px;
    --a2ui-button-border-radius: 8px;
    --gh-track: var(--sunken);
    --gh-warn: var(--warn);
    --dash-good: var(--accent);
    --dash-bad: var(--danger);

    display: block;
    max-width: 1180px;
    margin: 0 auto;
    padding: 20px 16px 40px;
    color: var(--ink);
    font: 15px/1.5 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }

  @media (prefers-color-scheme: dark) {
    :host {
      --bg: #14171a;
      --panel: #1c2024;
      --sunken: #262b30;
      --ink: #e8eaec;
      --muted: #9ba5ae;
      --line: #30363c;
      --accent: #4cc38a;
      --on-accent: #06281a;
      --accent-soft: #173327;
      --json: #5b646d;
      --danger: #ff8a80;
      --warn: #fb923c;
      --code-str: #fdba74;
      --code-key: #93c5fd;
      --code-path: #6ee7b7;
      --code-comp: #c4b5fd;
      --code-num: #fcd34d;
    }
  }

  * {
    box-sizing: border-box;
  }

  h1 {
    margin: 0 0 4px;
    font-size: 24px;
    line-height: 1.2;
    letter-spacing: -0.01em;
    text-wrap: balance;
  }
  h2 {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .top p {
    margin: 0;
    max-width: 62ch;
    color: var(--muted);
  }
  .top strong {
    color: var(--ink);
  }
  code {
    font: 0.92em var(--mono);
  }

  button {
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
  button:focus-visible,
  textarea:focus-visible,
  summary:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  nav {
    display: flex;
    gap: 8px;
    margin: 18px -16px 0;
    padding: 2px 16px 10px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  nav::-webkit-scrollbar {
    display: none;
  }
  .example-tab {
    flex: none;
    padding: 8px 14px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--panel);
    white-space: nowrap;
  }
  .example-tab[aria-current='true'] {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--on-accent);
    font-weight: 600;
  }

  .intro {
    margin: 6px 0 16px;
  }
  .summary {
    margin: 0 0 8px;
    max-width: 70ch;
    font-size: 16px;
  }
  .features {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .features li {
    padding: 2px 9px;
    border-radius: 6px;
    background: var(--accent-soft);
    font: 12px/1.6 var(--mono);
  }

  main {
    display: grid;
    gap: 16px;
    align-items: start;
  }
  @media (min-width: 920px) {
    main {
      grid-template-columns: minmax(0, 440px) minmax(0, 1fr);
    }
    .wire {
      position: sticky;
      top: 16px;
    }
  }

  .chat,
  .wire {
    min-width: 0;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--bg);
  }
  .chat {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
  }
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 32px;
  }
  .ghost {
    padding: 4px 12px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--panel);
    font-size: 13px;
  }

  .bubble {
    margin: 0;
    padding: 9px 13px;
    border-radius: 16px;
    max-width: 88%;
  }
  .bubble.user {
    align-self: flex-end;
    border-bottom-right-radius: 4px;
    background: var(--accent);
    color: var(--on-accent);
  }
  .bubble.agent {
    align-self: flex-start;
    border: 1px solid var(--line);
    border-bottom-left-radius: 4px;
    background: var(--panel);
  }
  .event {
    align-self: center;
    margin: 4px 0 0;
    padding: 1px 10px;
    border-radius: 999px;
    background: var(--sunken);
    color: var(--muted);
    font: 12px/1.7 var(--mono);
  }
  .note {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
    overflow-wrap: anywhere;
  }
  .error {
    margin: 0;
    padding: 9px 12px;
    border: 1px solid var(--danger);
    border-radius: 10px;
    color: var(--danger);
    font: 13px/1.5 var(--mono);
    overflow-wrap: anywhere;
  }
  .surface {
    min-width: 0;
  }
  a2ui-surface {
    display: block;
  }

  .suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .suggestions .ghost {
    text-align: left;
  }
  .ask {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }
  .ask input {
    flex: 1;
    min-width: 0;
    padding: 9px 12px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--panel);
    color: var(--ink);
    font: inherit;
  }
  .ask input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .primary {
    padding: 8px 16px;
    border: 0;
    border-radius: 10px;
    background: var(--accent);
    color: var(--on-accent);
  }
  button:disabled,
  input:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  textarea {
    width: 100%;
    min-height: 260px;
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--panel);
    color: var(--ink);
    font: 13px/1.55 var(--mono);
    resize: vertical;
    white-space: pre;
    overflow: auto;
    tab-size: 2;
  }

  .meter {
    display: grid;
    gap: 6px;
    padding: 14px 14px 10px;
  }
  .meter-row {
    display: grid;
    grid-template-columns: 62px 1fr 56px;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }
  .track {
    height: 10px;
    border-radius: 5px;
    background: var(--sunken);
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
    border-radius: 5px;
    transition: width 0.3s ease;
  }
  .fill.express {
    background: var(--accent);
  }
  .fill.json {
    background: var(--json);
  }
  .count {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .meter-note {
    margin: 2px 0 0;
    color: var(--muted);
    font-size: 13px;
  }
  .meter-note strong {
    color: var(--ink);
  }

  .tabs {
    display: flex;
    gap: 2px;
    padding: 0 8px;
    border-bottom: 1px solid var(--line);
    overflow-x: auto;
    scrollbar-width: none;
  }
  .tabs button {
    flex: none;
    padding: 9px 10px;
    border: 0;
    border-bottom: 2px solid transparent;
    background: none;
    color: var(--muted);
    font-size: 14px;
    white-space: nowrap;
  }
  .tabs button[aria-selected='true'] {
    border-bottom-color: var(--accent);
    color: var(--ink);
    font-weight: 600;
  }

  .pane-body {
    max-height: 62vh;
    min-height: 200px;
    padding: 4px 14px 14px;
    overflow: auto;
    border-radius: 0 0 14px 14px;
    background: var(--panel);
  }
  .cause {
    margin: 12px 0 4px;
    color: var(--muted);
    font: 600 12px/1.5 var(--mono);
  }
  pre {
    margin: 0;
    font: 12.5px/1.6 var(--mono);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    tab-size: 2;
  }
  .str {
    color: var(--code-str);
  }
  .key,
  .tag {
    color: var(--code-key);
  }
  .path {
    color: var(--code-path);
    font-weight: 600;
  }
  .comp,
  .check {
    color: var(--code-comp);
  }
  .num,
  .kw {
    color: var(--code-num);
  }
  .com {
    color: var(--muted);
  }
  .caret {
    display: inline-block;
    width: 7px;
    height: 1em;
    margin-left: 1px;
    vertical-align: text-bottom;
    background: var(--accent);
    animation: blink 0.9s steps(2) infinite;
  }
  @keyframes blink {
    50% {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .caret {
      animation: none;
    }
    .fill {
      transition: none;
    }
  }

  .log {
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
  }
  .log li + li {
    border-top: 1px solid var(--line);
  }
  summary {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 8px;
    padding: 7px 0;
    cursor: pointer;
    font-size: 13px;
    list-style: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  .dir {
    font: 11px/1.6 var(--mono);
    color: var(--muted);
  }
  .dir.renderer {
    color: var(--warn);
  }
  .kind {
    font: 600 12.5px/1.5 var(--mono);
  }
  .what {
    color: var(--muted);
    overflow-wrap: anywhere;
  }
  details pre {
    padding: 0 0 10px;
  }

  footer {
    margin-top: 22px;
    color: var(--muted);
    font-size: 13px;
    max-width: 80ch;
  }
`;
