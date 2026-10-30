import { align, preparePassage } from './h';
import { legacyAlign } from './legacy';
import { PASSAGES } from 'C:/Users/ohqui/Downloads/mouthful-app/mouthful-app/src/content/passages';
const MEM = require('C:/Users/ohqui/Downloads/mouthful-app/mouthful-app/src/engine/__tests__/fixtures/memory-scripts.json').scripts;
const texts: {id:string,text:string}[] = [...PASSAGES, ...MEM].map((m:any)=>({id:m.id,text:m.text}));
let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const garble = (w: string) => w.length > 3 ? w.slice(0, -2) + 'zq' : 'zz';
function sim(fn: any, p: any, finalHeard: string[], mode: 'verbatim'|'skip') {
  // iOS-like: each call the last k (1..4) words are a wrong/partial guess, fixed on the next call
  let prev: string[] | null = null; let flipsBehind = 0, redGreen = 0, back = 0, prevNext = 0, maxOver = 0;
  const truthNext = (i: number) => fn(p, finalHeard.slice(0, i)).next;
  for (let i = 1; i <= finalHeard.length; i++) {
    const k = 1 + Math.floor(rnd() * 4);
    const variants = [finalHeard.slice(0, i).map((w, j) => j >= i - k ? (rnd() < 0.6 ? garble(w) : finalHeard[Math.min(finalHeard.length-1, j + 3)]) : w), finalHeard.slice(0, i)];
    for (const h of variants) {
      const a = fn(p, h); const s = a.status as string[];
      if (prev) for (let x = 0; x < s.length; x++) {
        if ((prev[x] === 'read' && s[x] === 'skipped') || (prev[x] === 'skipped' && s[x] === 'read')) { redGreen++; if (x < Math.min(a.next, prevNext) - 4) flipsBehind++; }
      }
      if (a.next < prevNext) back++;
      maxOver = Math.max(maxOver, a.next - truthNext(i));
      prev = s; prevNext = a.next;
    }
  }
  return { redGreen, flipsBehind, back, maxOver };
}
test('interim revisions', () => {
  for (const mode of ['verbatim', 'skip'] as const) {
    const tot: any = { new: { redGreen: 0, flipsBehind: 0, back: 0, maxOver: 0 }, old: { redGreen: 0, flipsBehind: 0, back: 0, maxOver: 0 } };
    for (const t of texts) {
      const p = preparePassage(t.text); const keys = p.map(w => w.key);
      const heard = mode === 'verbatim' ? keys : [...keys.slice(0, 12), ...keys.slice(24)];
      for (const [nm, fn] of [['new', align], ['old', legacyAlign]] as const) {
        const s0 = seed; const r = sim(fn, p, heard, mode); seed = nm === 'new' ? s0 : seed;
        for (const k of ['redGreen','flipsBehind','back']) tot[nm][k] += (r as any)[k]; tot[nm].maxOver = Math.max(tot[nm].maxOver, r.maxOver);
      }
    }
    console.log(mode, JSON.stringify(tot));
  }
});
