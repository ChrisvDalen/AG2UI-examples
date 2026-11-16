import type {Example} from './types.js';

/** The Express source the playground starts with. */
export const PLAYGROUND_SOURCE = `surface("playground")
$/name = "world"
$/volume = 40
root = Card(main)
main = Column([title, name, volume, dial, hello])
title = Text("### Edit me")
name = TextField("Name", $/name, "Type a name")
volume = Slider("Volume", 0, 100, $/volume)
dial = Gauge("Volume", $/volume, max=100, unit="%", warnAbove=80)
hello = Button(Text(formatString("Say hello to \${/name}")), "primary", Event("hello", {name: $/name}))`;

export const playground: Example = {
  id: 'playground',
  title: 'Playground',
  summary:
    'Write A2UI Express yourself. Every keystroke is compiled to A2UI 1.0 JSON, checked against both catalogs and rendered.',
  features: ['Express compiler', 'Live validation', 'Both catalogs'],
  prompt: 'Your own Express source',
  editable: true,

  async start(agent) {
    await agent.push('Editor', `<a2ui>\n${PLAYGROUND_SOURCE}\n</a2ui>`);
  },
};
