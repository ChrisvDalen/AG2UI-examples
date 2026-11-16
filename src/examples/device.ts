import {GREENHOUSE_CATALOG_ID, type DeviceInfo} from '../a2ui/greenhouse-catalog.js';
import type {Example} from './types.js';

export const device: Example = {
  id: 'device',
  title: 'The agent asks the renderer',
  summary:
    'Before drawing anything, the agent calls deviceInfo() on the renderer and lays out the answer for the screen it finds.',
  features: ['callRendererFunction', 'rendererFunctionResponse', 'allowedCallers', 'Custom function'],
  prompt: 'Set up my dashboard for this device.',

  async start(agent) {
    const info: DeviceInfo = await agent.callRenderer('deviceInfo', GREENHOUSE_CATALOG_ID);
    const narrow = info.viewportWidth < 700;
    // A narrow screen gets its panels stacked; a wide one gets them side by side.
    const layout = narrow ? 'Column' : 'Row';
    await agent.reply(
      'After deviceInfo() returned',
      `You are on a ${narrow ? 'narrow' : 'wide'} ${info.touch ? 'touch ' : ''}screen, so I ${narrow ? 'stacked the panels' : 'put the panels side by side'}.
<a2ui>
surface("dashboard")
$/device = [
  {key: "Viewport", value: "${info.viewportWidth} × ${info.viewportHeight}"},
  {key: "Locale", value: "${info.locale}"},
  {key: "Time zone", value: "${info.timeZone}"},
  {key: "Color scheme", value: "${info.colorScheme}"},
  {key: "Input", value: "${info.touch ? 'Touch' : 'Pointer'}"}
]
$/now = "${new Date().toISOString()}"
root = ${layout}([facts, today])
facts = Card(Column([Text("### This device"), List(_template($/device, fact))]), weight=1)
fact = Row([Text($key, "caption", weight=1), Text($value)], "spaceBetween")
today = Card(Column([Text("### Today"), Text(formatDate($/now, "EEEE, d MMMM")), Row([Text("Asked at", "caption"), Text(formatDate($/now, "HH:mm"), "caption")]), Button(Text("Ask again"), _, Event("ask_again"))]), weight=1)
</a2ui>`,
    );
  },

  async onAction(action, agent) {
    if (action.name !== 'ask_again') return;
    const info: DeviceInfo = await agent.callRenderer('deviceInfo', GREENHOUSE_CATALOG_ID);
    await agent.reply(
      'Action: ask_again',
      `<a2ui>
surface("dashboard")
$/device/0/value = "${info.viewportWidth} × ${info.viewportHeight}"
$/device/3/value = "${info.colorScheme}"
$/now = "${new Date().toISOString()}"
</a2ui>`,
    );
  },
};
