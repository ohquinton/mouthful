import { align, preparePassage } from './h';
import { legacyAlign } from './legacy';
import { PASSAGES } from 'C:/Users/ohqui/Downloads/mouthful-app/mouthful-app/src/content/passages';
import { WORD_PACKS } from 'C:/Users/ohqui/Downloads/mouthful-app/mouthful-app/src/content/wordpacks';
const MEM = require('C:/Users/ohqui/Downloads/mouthful-app/mouthful-app/src/engine/__tests__/fixtures/memory-scripts.json').scripts;
const texts: any[] = [...PASSAGES, ...WORD_PACKS.flatMap((w: any) => w.passages), ...MEM];
let seed = 9; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const OFFW = ['banana','sorry','wait','um','like','actually','hmm','okay','well','right'];
test('light noise, no real skips', () => {
  let cases = 0, worseRed = 0, worseFG = 0, betterRed = 0, newFG = 0, legFG = 0; const ex: string[] = [];
  for (const t of texts) {
    const p = preparePassage(t.text); const keys = p.map((w: any) => w.key);
    for (let rep = 0; rep < 150; rep++) {
      const heard: string[] = []; const said = keys.map(() => false);
      for (let k = 0; k < keys.length; k++) {
        const r = rnd();
        if (r < 0.04) continue; // dropped word
        if (r < 0.08) { heard.push('zz' + keys[k]); continue; } // misheard
        heard.push(keys[k]); said[k] = true;
        const r2 = rnd();
        if (r2 < 0.05) heard.push(keys[k]); // stutter
        else if (r2 < 0.12) heard.push(OFFW[Math.floor(rnd() * OFFW.length)]);
        else if (r2 < 0.15 && k > 2) { heard.push(keys[k - 2], keys[k - 1], keys[k]); } // restart phrase
      }
      cases++;
      const n = align(p, heard), l = legacyAlign(p, heard);
      const red = (a: any) => a.status.filter((s: string, k: number) => s !== 'read' && said[k]).length;
      const fg = (a: any) => a.status.filter((s: string, k: number) => s === 'read' && !said[k]).length;
      newFG += fg(n); legFG += fg(l);
      if (red(n) > red(l)) { worseRed++; if (ex.length < 3) ex.push(`${t.id ?? ''} new red-but-said ${red(n)} vs legacy ${red(l)}; new ${n.status.map((s:string,k:number)=>s!=='read'&&said[k]?keys[k]+'@'+k:'').filter(Boolean).join(',')} | legacy ${l.status.map((s:string,k:number)=>s!=='read'&&said[k]?keys[k]+'@'+k:'').filter(Boolean).join(',')}\n  heard: ${heard.join(' ')}`); }
      if (red(n) < red(l)) betterRed++;
      if (fg(n) > fg(l)) worseFG++;
    }
  }
  console.log({ cases, newWorseRed: worseRed, newBetterRed: betterRed, newMoreFG: worseFG, newFG, legFG }); console.log(ex.join('\n'));
});
