import { run, preparePassage } from './h';
const MEM = require('C:/Users/ohqui/Downloads/mouthful-app/mouthful-app/src/engine/__tests__/fixtures/memory-scripts.json').scripts;
test('x', () => {
  const t = MEM.find((m: any) => m.id === 'why-this-job').text; const keys = preparePassage(t).map(w => w.key);
  console.log(keys.slice(0, 40).join(' '));
  const heard = [...keys.slice(0, 12), ...keys.slice(24)];
  for (const h of [heard.slice(0, 19).join(' '), [...heard.slice(0, 16), 'thyme', 'clinician', 'loose'].join(' '), heard.slice(0, 20).join(' ')]) { const r = run(t, h); console.log('HEARD: ' + h.split(' ').slice(10).join(' ') + `\n next=${r.a.next} ` + r.show.split(' ').slice(0, 40).join(' ')); }
});
