// Run every test in a zone with daylight saving, whatever the machine's own zone (CI is UTC).
// Setting process.env.TZ inside a test file doesn't reach Node's clock: Jest gives each test
// file its own copy of process.env. Workers inherit the real env from here, before they start.
module.exports = () => {
  process.env.TZ = 'America/Toronto';
};
