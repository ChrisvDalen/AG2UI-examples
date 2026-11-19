import type {Example} from './types.js';

/** Starting points for the live example. */
export const LIVE_SUGGESTIONS = [
  'Help me plan a picnic for six people on Saturday',
  'A signup form for a pottery workshop, with a date picker',
  'Show the greenhouse: temperature 27 °C, humidity 64%, with a trend',
];

export const live: Example = {
  id: 'live',
  title: 'Live with Claude',
  summary:
    'Claude writes the Express. Type a request: the reply streams through the same compiler and renderer, and clicks on the surface go back to Claude.',
  features: ['Real model', 'Streaming compile', 'Actions to the model', 'Self-repair'],
  prompt: '',
  live: true,

  // The app drives this example through LiveAgent, not a script.
  async start() {},
};
