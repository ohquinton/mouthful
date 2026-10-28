import { run, preparePassage, tokenise } from './h';
import { legacyAlign } from './legacy';
const T = 'Thank you all for coming in today. This quarter we moved the billing system to the new platform and cut support tickets by a third. Next quarter we will finish the migration for the last two regions. Thank you all for coming in today.';
test('refrain', () => {
  for (const s of [
    'thank you all for coming in today this quarter we moved the billing system to the new platform sorry let me start again thank you all for coming in today',
    'thank you all for coming in today this quarter we moved the billing system to the new platform sorry let me start again thank you all for coming in today this quarter',
  ]) { const r = run(T, s); const l = legacyAlign(r.p, tokenise(s)); console.log(`NEW done=${r.a.done} next=${r.a.next}/${r.p.length} | OLD done=${l.done} next=${l.next}\n  ` + r.show); }
});
