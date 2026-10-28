/* global jest */
// Stand-in for @sentry/react-native under jest (the real SDK needs a phone).
// Records what our code asks Sentry to do, so test/sentry*.test.ts can check it.
const options = { enabled: true };
const client = { getOptions: () => options };
module.exports = {
  _options: options,
  init: jest.fn(),
  close: jest.fn(() => Promise.resolve()),
  getClient: jest.fn(() => client),
  captureException: jest.fn(),
  wrap: (Component) => Component,
};
