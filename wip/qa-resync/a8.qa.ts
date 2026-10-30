import { align, preparePassage, code } from './h';
import { legacyAlign } from './legacy';
import { PASSAGES } from 'C:/Users/ohqui/Downloads/mouthful-app/mouthful-app/src/content/passages';
const MEM = require('C:/Users/ohqui/Downloads/mouthful-app/mouthful-app/src/engine/__tests__/fixtures/memory-scripts.json').scripts;
const texts: {id:string,text:string}[] = [...PASSAGES, ...MEM].map((m:any)=>({id:m.id,text:m.text}));
const garble = (w: string) => w.length > 3 ? w.slice(0, -2) + 'zq' : 'zz';
test('retreat size when the last k words are briefly garbled, after a 12-word skip', () => {
  for (const [nm, fn] of [['new', align], ['old', legacyAlign]] as any) {
    let worst = 0, big = 0, total = 0, ex = '';
    for (const t of texts) {
      const p = preparePassage(t.text); const keys = p.map(w => w.key);
      for (const at of [12, 30]) {
        if (keys.length < at + 40) continue;
        const heard = [...keys.slice(0, at), ...keys.slice(at + 12)];
        for (let i = at + 1; i < at + 10; i++) for (let k = 1; k <= 3; k++) {
          const good = fn(p, heard.slice(0, i)); const bad = fn(p, heard.slice(0, i).map((w, j) => j >= i - k ? garble(w) : w));
          // words shown read or skipped in good but pending in the garbled interim
          let lost = 0; for (let x = 0; x < p.length; x++) if (good.status[x] !== 'pending' && bad.status[x] === 'pending') lost++;
          total++; if (lost > 4) big++;
          if (lost > worst) { worst = lost; ex = `${t.id} at=${at} i=${i} k=${k}: good next=${good.next} garbled next=${bad.next} | heard tail: ${heard.slice(i-k-2,i).join(' ')} -> ${heard.slice(i-k-2,i).map((w,j)=>j>=2?garble(w):w).join(' ')}`; }
        }
      }
    }
    console.log(nm, { total, retreatsOver4Words: big, worst }, ex);
  }
});
