import type {Example} from './types.js';

const opening = `Here is a first plan for Lisbon. Change the dates and I will rework the days.
<a2ui>
surface("trip")
$/from = "2027-03-12T00:00:00Z"
$/nights = 2
$/travellers = ["2"]
$/pack = {shoes: true, adapter: false, jacket: true}
$/days = [
  {day: "Friday", plan: "Alfama on foot, then fado at Tasca do Chico"},
  {day: "Saturday", plan: "Tram 28, LX Factory, sunset at Miradouro da Graça"},
  {day: "Sunday", plan: "Pastéis in Belém before the flight home"}
]
root = Card(main)
main = Column([Text("### A weekend in Lisbon"), tabs])
tabs = Tabs([{title: "Plan", child: plan}, {title: "Dates", child: dates}, {title: "Pack", child: pack}])
plan = Column([List(_template($/days, dayRow)), Row([details, map])])
dayRow = Column([Text($day, "caption"), Text($plan)])
details = Modal(Button(Text("Why these picks?"), _, Event("why")), Column([Text("### Why these picks"), Text("Everything is within 25 minutes of Baixa by tram, and Saturday keeps the afternoon free for the river."), Text("Fado houses fill up; Friday needs a booking.", "caption")]))
map = Button(Text("Open the map"), "borderless", openUrl("https://www.openstreetmap.org/#map=14/38.7139/-9.1394"))
dates = Column([DateTimeInput($/from, true, false, "2027-03-01T00:00:00Z", "2027-03-31T00:00:00Z", "Arrive"), Slider("Nights", 1, 5, $/nights, 4), ChoicePicker("Travellers", "mutuallyExclusive", [{label: "1", value: "1"}, {label: "2", value: "2"}, {label: "3", value: "3"}, {label: "4", value: "4"}], $/travellers, "chips"), Button(Text("Rework the plan"), "primary", Event("replan", {from: $/from, nights: $/nights, travellers: $/travellers}))])
pack = Column([CheckBox("Shoes with grip, the hills are tiled", $/pack/shoes), CheckBox("Type F adapter", $/pack/adapter), CheckBox("A light jacket for the miradouros", $/pack/jacket)])
</a2ui>`;

const IDEAS = [
  'Alfama on foot, then fado at Tasca do Chico',
  'Tram 28, LX Factory, sunset at Miradouro da Graça',
  'Pastéis in Belém, then the MAAT roof',
  'Day trip to Sintra: Pena Palace and Quinta da Regaleira',
  'Cascais by train, lunch on the harbour',
  'Feira da Ladra flea market and the tile museum',
];

export const trip: Example = {
  id: 'trip',
  title: 'A weekend, in tabs',
  summary:
    'Tabs, a modal, a date picker and a link that opens locally: most taps never reach the agent, and only "Rework the plan" does.',
  features: ['Tabs', 'Modal', 'DateTimeInput', 'Slider steps', 'openUrl function action'],
  prompt: 'Plan a weekend in Lisbon for two.',

  async start(agent) {
    await agent.reply('User prompt', opening);
  },

  async onAction(action, agent) {
    if (action.name !== 'replan') return;
    const nights = Number(action.context.nights);
    const start = new Date(String(action.context.from));
    const days = Array.from({length: nights + 1}, (_, index) => {
      const date = new Date(start.getTime() + index * 86_400_000);
      const day = date.toLocaleDateString('en-GB', {weekday: 'long', timeZone: 'UTC'});
      return `{day: "${day}", plan: "${IDEAS[index % IDEAS.length]}"}`;
    });
    await agent.reply(
      'Action: replan',
      `Reworked for ${nights} ${nights === 1 ? 'night' : 'nights'}. The Plan tab has the new days.
<a2ui>
surface("trip")
$/days = [${days.join(', ')}]
</a2ui>`,
    );
  },
};
