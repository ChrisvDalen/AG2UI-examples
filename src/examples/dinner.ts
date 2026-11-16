import type {Example} from './types.js';

const opening = `Friday works for both of you. I checked your calendars and found open tables near Priya's office.
<a2ui>
surface("dinner")
$/status = "Draft · moving from Thursday"
$/slot = ["19:30"]
$/table = ""
$/choice = "No table picked yet"
$/ride = true
$/tables = [
  {id: "lucca", name: "Osteria Lucca", note: "Italian · 4 min walk · table for 2"},
  {id: "nami", name: "Nami", note: "Japanese · 9 min walk · counter seats"},
  {id: "olive", name: "The Olive Yard", note: "Mediterranean · 12 min walk · terrace"}
]
root = Card(main)
main = Column([head, slots, tablesTitle, tableList, ride, Divider(), footer])
head = Row([Icon("event"), Column([Text("### Dinner with Priya"), Text($/status, "caption")])], _, "center")
slots = ChoicePicker("Friday, when you are both free", "mutuallyExclusive", [{label: "18:30", value: "18:30"}, {label: "19:00", value: "19:00"}, {label: "19:30", value: "19:30"}, {label: "20:15", value: "20:15"}], $/slot, "chips")
tablesTitle = Text("Open tables", "caption")
tableList = List(_template($/tables, tableRow))
tableRow = Row([Column([Text($name), Text($note, "caption")], weight=1), Button(Text("Pick"), _, Event("pick_table", {id: $id, name: $name}))], "spaceBetween", "center")
ride = CheckBox("Book a ride home, about €14", $/ride)
footer = Row([Text($/choice, "caption", weight=1), Button(Text("Move dinner"), "primary", Event("confirm", {slot: $/slot, table: $/table, ride: $/ride}), ?required($/table, "Pick a table first"))], "spaceBetween", "center")
</a2ui>`;

export const dinner: Example = {
  id: 'dinner',
  title: 'Dinner, rescheduled',
  summary:
    'One request, one surface: free slots, open tables and a ride, with every tap going back to the agent as a typed action.',
  features: ['Express', 'createSurface with data', 'List template', 'Actions with context', '@checks'],
  prompt: 'Move dinner with Priya to Friday.',

  async start(agent) {
    await agent.reply('User prompt', opening);
  },

  async onAction(action, agent) {
    if (action.name === 'pick_table') {
      const {id, name} = action.context as {id: string; name: string};
      await agent.reply(
        `Action: pick_table`,
        `<a2ui>
surface("dinner")
$/table = "${id}"
$/choice = "${name}"
</a2ui>`,
      );
    } else if (action.name === 'confirm') {
      const slot = (action.context.slot as string[])[0];
      const ride = action.context.ride as boolean;
      const table = agent.data('dinner', '/choice') as string;
      await agent.reply(
        'Action: confirm',
        `Done. Priya has the new invite.
<a2ui>
surface("dinner")
$/status = "Confirmed · Friday ${slot}"
main = Column([head, Divider(), done, details])
done = Row([Icon("check"), Text("**Dinner moved to Friday ${slot}**")], _, "center")
details = Column([Text("${table} · table for 2"), Text("${ride ? `Ride home booked for ${addHours(slot, 2)}` : 'No ride booked'}", "caption")])
</a2ui>`,
      );
    }
  },
};

/** Adds whole hours to an `HH:mm` time. */
function addHours(time: string, hours: number): string {
  const [hour, minute] = time.split(':').map(Number);
  return `${String((hour + hours) % 24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
