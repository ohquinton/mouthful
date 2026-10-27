// Run tests in a zone with daylight saving unless one is set explicitly (CI also runs a zone
// without DST). Setting process.env.TZ inside a test file doesn't reach Node's clock: Jest gives
// each test file its own copy of process.env. Workers inherit the real env from here.
module.exports = () => {
  process.env.TZ = process.env.MOUTHFUL_TEST_TZ || 'America/Toronto';
};
