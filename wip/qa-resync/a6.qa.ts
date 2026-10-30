import { align, preparePassage } from './h';
import { PASSAGES } from 'C:/Users/ohqui/Downloads/mouthful-app/mouthful-app/src/content/passages';
const MEM = require('C:/Users/ohqui/Downloads/mouthful-app/mouthful-app/src/engine/__tests__/fixtures/memory-scripts.json').scripts;
const texts: {id:string,text:string}[] = [...PASSAGES, ...MEM].map((m:any)=>({id:m.id,text:m.text}));
test('overshoot from one wrong interim word (shifted lookahead word)', () => {
  const found: any[] = [];
  for (const t of texts) {
    const p = preparePassage(t.text); const keys = p.map(w => w.key);
    for (const skip of [0, 12]) {
      const heard = skip ? [...keys.slice(0, 12), ...keys.slice(24)] : keys;
      for (let i = 3; i < heard.length; i++) for (let k = 1; k <= 4; k++) for (const sh of [3, 6, 10]) {
        const base = heard.slice(0, i);
        const h = base.map((w, j) => j >= i - k ? heard[Math.min(heard.length - 1, j + sh)] : w);
        const truth = align(p, base).next; const a = align(p, h);
        const over = a.next - truth;
        // words behind the true pointer that were read but turn red in the interim
        const t0 = align(p, base).status; let lostGreen = 0; for (let x = 0; x < truth - k; x++) if (t0[x]==='read' && a.status[x]!=='read') lostGreen++;
        if (over >= 8 || lostGreen >= 3) found.push({ id: t.id, skip, i, k, sh, over, lostGreen, tail: base.slice(-k-3).join(' ') + '  =>  ' + h.slice(-k-3).join(' ') });
      }
    }
  }
  found.sort((a, b) => (b.over + b.lostGreen) - (a.over + a.lostGreen));
  console.log(found.length, JSON.stringify(found.slice(0, 6), null, 1));
  const v = found.filter(f=>f.skip===0); console.log('verbatim-only', v.length, JSON.stringify(v.slice(0,4),null,1));
});
