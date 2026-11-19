import type {Example} from './types.js';

/** Every tile reads the same two filters, so one control recomputes them all. */
const F = 'region=$/filters/region, period=$/filters/period';

const opening = `Here is the shop at a glance. Pick a region or period to refilter every tile; the numbers
come from the sales data in your browser, not from me.
<a2ui>
surface("sales")
$/filters/region = ["All"]
$/filters/period = ["last12Months"]
root = Column([head, filters, board, more])
board = Column([kpis, charts])
head = Row([Icon("shoppingCart"), Column([Text("### Sales overview"), Text("Sample data · through October 2026", "caption")])], _, "center")
filters = Column([regionPick, periodPick])
regionPick = ChoicePicker("Region", "mutuallyExclusive", [{label: "All", value: "All"}, {label: "North", value: "North"}, {label: "South", value: "South"}, {label: "East", value: "East"}, {label: "West", value: "West"}], $/filters/region, "chips")
periodPick = ChoicePicker("Period", "mutuallyExclusive", [{label: "12 months", value: "last12Months"}, {label: "3 months", value: "last3Months"}, {label: "Last month", value: "lastMonth"}], $/filters/period, "chips")
kpis = Grid([revenue, orders, basket, returns], minWidth=140)
revenue = Kpi("Revenue", total("revenue", ${F}), change("revenue", ${F}), format="currency")
orders = Kpi("Orders", total("orders", ${F}), change("orders", ${F}))
basket = Kpi("Average order", total("averageOrder", ${F}), change("averageOrder", ${F}), format="currency")
returns = Kpi("Returns", total("returns", ${F}), change("returns", ${F}), goodWhen="down")
charts = Grid([trend, byChannel], minWidth=280)
trend = LineChart(breakdown("revenue", "month", region=$/filters/region), "Revenue by month, last 12 months", "currency")
byChannel = BarChart(breakdown("revenue", "channel", ${F}), "Revenue by channel", "currency")
more = Row([Button(Text("Add product mix"), _, Event("add_tile", {tile: "products"})), Button(Text("Look into returns"), _, Event("add_tile", {tile: "returns"}))])
</a2ui>`;

export const dashboard: Example = {
  id: 'dashboard',
  title: 'A dashboard, composed',
  summary:
    'The agent assembles a dashboard from a trusted catalog of tiles and binds each one to a data function. Filters recompute every tile in the renderer; asking for more adds tiles to the same surface.',
  features: ['Custom catalog', 'Data functions', 'Bound filters', 'updateComponents'],
  prompt: 'How is the shop doing this year? Show me revenue, where it comes from, and returns.',

  async start(agent) {
    await agent.reply('User prompt', opening);
  },

  async onAction(action, agent) {
    if (action.name !== 'add_tile') return;
    if (action.context.tile === 'products') {
      await agent.reply(
        'Action: add_tile (products)',
        `Added the product mix next to the channels. It follows the same filters.
<a2ui>
surface("sales")
charts = Grid([trend, byChannel, byProduct], minWidth=280)
byProduct = BarChart(breakdown("revenue", "product", ${F}), "Revenue by product", "currency")
</a2ui>`,
      );
    } else if (action.context.tile === 'returns') {
      await agent.reply(
        'Action: add_tile (returns)',
        `Returns sit mostly with the marketplace. Here they are by channel and over time.
<a2ui>
surface("sales")
board = Column([kpis, charts, returnsRow])
returnsRow = Grid([returnsByChannel, returnsTrend], minWidth=280)
returnsByChannel = BarChart(breakdown("returns", "channel", ${F}), "Returns by channel")
returnsTrend = LineChart(breakdown("returns", "month", region=$/filters/region), "Returns by month")
</a2ui>`,
      );
    }
  },
};
