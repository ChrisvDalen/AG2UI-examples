import type {AgentContext, Example} from './types.js';

const opening = `Tunnel 3 is within range. Temperature has been climbing for the last two minutes.
<a2ui>
surface("tunnel")
$/temp = 24.1
$/humidity = 68
$/co2 = 640
$/limit = 28
$/vents = "Vents closed"
$/history = [22.8, 23.0, 22.9, 23.3, 23.6, 23.5, 23.9, 24.1]
$/sensors = [
  {name: "Soil moisture, bed A", value: "41 %"},
  {name: "Soil moisture, bed B", value: "37 %"},
  {name: "Light", value: "540 µmol"}
]
root = Card(main)
main = Column([head, gauges, trend, limit, sensorTitle, sensors, actions])
head = Row([Text("### Tunnel 3 · tomatoes", weight=1), Text($/vents, "caption")], "spaceBetween", "center")
gauges = Row([Gauge("Temperature", $/temp, max=40, unit="°C", warnAbove=$/limit), Gauge("Humidity", $/humidity, max=100, unit="%"), Gauge("CO₂", $/co2, max=1500, unit="ppm")])
trend = Sparkline($/history, "Temperature, last readings")
limit = Slider("Alarm above (°C)", 15, 40, $/limit)
sensorTitle = Text("Other sensors", "caption")
sensors = List(_template($/sensors, sensorRow))
sensorRow = Row([Text(formatString("\${@index(offset:1)}"), "caption"), Text($name, weight=1), Text($value, "caption")], _, "center")
actions = Row([Button(Text("Open vents"), "primary", Event("open_vents", {temp: $/temp, limit: $/limit})), Button(Text("Close vents"), _, Event("close_vents"))])
</a2ui>`;

/** The scripted agent's picture of the tunnel, which it nudges on every tick. */
interface Tunnel {
  temp: number;
  humidity: number;
  co2: number;
  history: number[];
  ventsOpen: boolean;
}

const round = (value: number) => Math.round(value * 10) / 10;

function tick(tunnel: Tunnel, agent: AgentContext) {
  // With the vents closed the tunnel warms toward 31 °C; open, it cools toward 21 °C.
  const target = tunnel.ventsOpen ? 21 : 31;
  tunnel.temp = round(tunnel.temp + (target - tunnel.temp) * 0.12 + (Math.random() - 0.5) * 0.3);
  tunnel.humidity = Math.round(
    Math.min(90, Math.max(45, tunnel.humidity + (tunnel.ventsOpen ? -1 : 0.5) + Math.random() - 0.5)),
  );
  tunnel.co2 = Math.round(
    Math.min(1200, Math.max(420, tunnel.co2 + (tunnel.ventsOpen ? -18 : 9) + Math.random() * 6)),
  );
  tunnel.history = [...tunnel.history.slice(-11), tunnel.temp];
  void agent.push(
    'Sensor feed',
    `<a2ui>
surface("tunnel")
$/temp = ${tunnel.temp}
$/humidity = ${tunnel.humidity}
$/co2 = ${tunnel.co2}
$/history = [${tunnel.history.join(', ')}]
</a2ui>`,
  );
}

let tunnel: Tunnel;

export const greenhouse: Example = {
  id: 'greenhouse',
  title: 'Tomato tunnel, live',
  summary:
    'Gauges and a sparkline from a custom catalog sit next to basic components on one surface, fed by small data-only updates.',
  features: ['Mixed catalogs', '@catalogId', '@index', 'updateDataModel stream', 'Local data binding'],
  prompt: 'How is tunnel 3 doing?',

  async start(agent) {
    tunnel = {
      temp: 24.1,
      humidity: 68,
      co2: 640,
      history: [22.8, 23.0, 22.9, 23.3, 23.6, 23.5, 23.9, 24.1],
      ventsOpen: false,
    };
    await agent.reply('User prompt', opening);
    agent.every(2000, () => tick(tunnel, agent));
  },

  async onAction(action, agent) {
    if (action.name !== 'open_vents' && action.name !== 'close_vents') return;
    tunnel.ventsOpen = action.name === 'open_vents';
    await agent.reply(
      `Action: ${action.name}`,
      `${tunnel.ventsOpen ? 'Vents are opening. Expect the temperature to drop over the next readings.' : 'Vents closed.'}
<a2ui>
surface("tunnel")
$/vents = "${tunnel.ventsOpen ? 'Vents open' : 'Vents closed'}"
</a2ui>`,
    );
  },
};
