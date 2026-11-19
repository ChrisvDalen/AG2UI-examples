# A2UI 1.0 examples

Six interactive examples of [A2UI 1.0](https://a2ui.org/), the protocol that lets an agent answer
with interface instead of text. Each one shows the conversation, the surface the agent drew, and
what went over the wire to draw it.

The agent writes **A2UI Express**, the compact inference format that shipped with 1.0. The page
compiles it to A2UI 1.0 JSON as it streams in, checks every message against the catalogs, and
renders the result with Lit.

![The dinner example: the conversation on the left, the Express the agent wrote on the right](docs/dinner.png)

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # compiles every example and replays its actions, without a browser
npm run build    # type-checks and writes dist/
```

Needs Node 22. Six examples are scripted, so they run without a model or an API key and every run
is the same. The seventh, **Live with Claude**, sends your requests to Claude; see below.

## The examples

| Example                     | What it shows                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| Dinner, rescheduled         | A whole surface in one `createSurface`, a list template, and actions that carry context to the agent.   |
| Tomato tunnel, live         | Two catalogs on one surface (`@catalogId`), `@index`, and a feed of data-only `updateDataModel`s.      |
| A form that checks itself   | `@checks` with `required`, `email`, `regex` and `length`, and a submit button gated by `and()`.         |
| The agent asks the renderer | `callRendererFunction` and `rendererFunctionResponse`: the agent calls `deviceInfo()` before it draws. |
| A weekend, in tabs          | `Tabs`, `Modal`, `DateTimeInput`, and an `openUrl` action that never leaves the renderer.              |
| Playground                  | An editor: your own Express, compiled, validated and rendered on every keystroke.                      |
| A dashboard, composed       | Tiles from a trusted catalog, bound to data functions. Filters recompute in the renderer; asking adds tiles. |
| Live with Claude            | A real model writes the Express. Replies stream into the renderer; clicks go back to the model.         |

## A composable dashboard

The dashboard is not a template and not generated HTML. The agent picks pieces from a trusted
catalog (`src/a2ui/dashboard-catalog.ts`) and wires them together:

- **Components**: `Grid` (responsive tiles), `Kpi`, `LineChart` and `BarChart`. The renderer
  rejects anything outside the catalog, down to the allowed icon names.
- **Data functions**: `total()`, `change()` and `breakdown()` run in the renderer against
  `src/data/sales.ts`, two years of fictional sales. The agent binds tiles to them and never
  writes a figure itself, so a model cannot make up numbers on the dashboard.
- **Filters**: the functions take region, product, channel and period arguments that can be bound
  to the data model. A `ChoicePicker` on `$/filters/region` recomputes every tile in the browser,
  without a round trip to the agent.
- **Composing further**: asking for more sends `updateComponents` that reassign a container
  (`board`, `charts`) on the same surface. Reassigning `root` instead would try to create the
  surface a second time, which the renderer refuses.

In the live example Claude gets the same catalog and the rule not to type sales numbers, so it
can build its own dashboards: try "Show me how the regions compare this quarter".

The data lives in the browser here. With real data you would put the same functions in front of
an API, keeping the split: the model chooses the view, your code supplies the numbers.

## Live with Claude

```sh
export ANTHROPIC_API_KEY=sk-ant-...   # or sign in once with `ant auth login`
npm run dev                           # open http://localhost:5173/#live
```

The key stays on the dev server. The page POSTs the conversation to `/api/chat`, a Vite plugin
(`server/claude-proxy.ts`) adds the system prompt and streams Claude's reply back, and the page feeds
each piece into the same Express compiler and renderer the scripted examples use.

- **System prompt**: `src/llm/system-prompt.ts`, a short role description plus `promptContract`.
  It is cached (`cache_control`), so the roughly 7,000-token contract is billed in full only once
  every few minutes.
- **Actions**: a click on a surface goes back to Claude as a `[action]` message with the action's
  context and the surface's data model (`src/llm/live-agent.ts`).
- **Self-repair**: if a reply's Express does not compile, the agent sends the error back once and
  Claude writes the reply again.
- **Model and effort**: `claude-opus-5-5` at effort `medium` by default. Override with
  `CLAUDE_MODEL` and `CLAUDE_EFFORT` (`low` answers faster).
- **Refusals**: requests use the server-side fallback (`fallbacks: "default"`), so a reply that a
  safety classifier declines is retried on the recommended fallback model.
- **Only this machine**: the dev server listens on the network (`host: true`), but `/api/chat`
  answers only requests from this machine, so others on the network cannot spend your credits. Set
  `CLAUDE_PROXY_ALLOW_REMOTE=1` to change that.
- **Dev server only**: `npm run build` produces a static site without `/api/chat`. To host the live
  example you need a server that does what `server/claude-proxy.ts` does, with authentication in
  front of it.

## How it fits together

```
scripted agent ──Express text──▶ @a2ui/agent ──A2UI 1.0 messages──▶ @a2ui/web_core ──▶ @a2ui/lit
      ▲                           (compile + check)                  (MessageProcessor)   (<a2ui-surface>)
      └──────────────── action / rendererFunctionResponse ◀──────────────────┘
```

- `src/a2ui/session.ts` is the whole integration: one `MessageProcessor`, one Express stream per
  reply, and the `callRendererFunction` round trip.
- `src/a2ui/dashboard-catalog.ts` is the dashboard catalog, with `src/data/sales.ts` behind its
  data functions.
- `src/a2ui/greenhouse-catalog.ts` is a custom catalog with two Lit components (`Gauge`,
  `Sparkline`) and one function the agent may call (`deviceInfo`).
- `src/examples/` holds one file per example: the reply a model would write, and how the agent
  answers each action.

- `src/llm/` and `server/` put Claude behind the live example: `Session.replyStream` compiles the
  model's output while it streams.

## About the token meter

The meter compares the Express the agent wrote with the JSON it stands for, at four characters per
token. That is a rule of thumb, not a tokenizer. Two things keep it from overstating the saving:
the JSON is the reply compiled in one piece rather than the many small messages a stream produces,
and it names the basic catalog once per surface instead of on every component. Across these
examples Express comes out 55 to 70 percent shorter. The Express prompt contract itself costs about
6,000 input tokens for these two catalogs, which the meter does not count.

## Versions

Built against `@a2ui/agent` 0.1.0 and `@a2ui/web_core` / `@a2ui/lit` 0.15.0. Two things to know
about those releases:

- The Express grammar in `@a2ui/agent` 0.1.0 has no `@index()` call of its own. Inside
  `formatString` it works: `formatString("${@index(offset:1)}")`.
- `@a2ui/angular` 0.14.0 renders 0.8 and 0.9 only, which is why this uses the Lit renderer.
  `@a2ui/markdown-it` still pins `@a2ui/web_core` 0.14, so Markdown is rendered by
  `src/markdown.ts` instead.
