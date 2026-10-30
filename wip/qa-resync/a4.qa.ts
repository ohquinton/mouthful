import { align, preparePassage } from './h';
import { legacyAlign } from './legacy';
import { PASSAGES } from 'C:/Users/ohqui/Downloads/mouthful-app/mouthful-app/src/content/passages';
const MEM = require('C:/Users/ohqui/Downloads/mouthful-app/mouthful-app/src/engine/__tests__/fixtures/memory-scripts.json').scripts;
const REP = require('C:/Users/ohqui/Downloads/mouthful-app/mouthful-app/src/engine/__tests__/fixtures/repeated-phrases.json').scripts;
const texts: {id:string,text:string}[] = [...PASSAGES, ...MEM, ...REP].map((m:any)=>({id:m.id,text:m.text}));
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const FILL = ['sorry','where','was','i','hang','on','um','okay','let','me','see','oops','again','sorry','no'];
const STOPS = new Set('a an the and or but of to in on at by for with is was we i it this that our'.split(' '));
test('rambles', () => {
  let cases=0,N=0,L=0,strictN=0,strictL=0,newOnlyCases=0; const sx:string[]=[];
  for (const t of texts) {
    const p = preparePassage(t.text); const keys = p.map(w => w.key); const n = p.length;
    for (let rep = 0; rep < 300; rep++) {
      const ramble = new Set<string>(); const heard: string[] = []; const said = new Array(n).fill(false); let pos = 0;
      while (pos < n) {
        const len = 3 + Math.floor(rnd() * 12);
        for (let k = pos; k < Math.min(n, pos + len); k++) { heard.push(keys[k]); said[k] = true; }
        pos = Math.min(n, pos + len);
        const r = rnd();
        if (r < 0.35) { const m = 2 + Math.floor(rnd() * 6); for (let j = 0; j < m; j++) { const w = rnd() < 0.5 ? pick(FILL) : pick(keys); ramble.add(w); heard.push(w); } }
        else if (r < 0.55) pos += 1 + Math.floor(rnd() * 15);
        else if (r < 0.7) pos = Math.max(0, pos - 1 - Math.floor(rnd() * 8));
      }
      cases++;
      const f = align(p, heard), l = legacyAlign(p, heard);
      const fg = (s:any[]) => s.map((x,k)=>x==='read'&&!said[k]?k:-1).filter(k=>k>=0);
      const a = fg(f.status), b = fg(l.status); N+=a.length; L+=b.length;
      const strict = a.filter(k=>!ramble.has(keys[k]) && !STOPS.has(keys[k])); const strictLeg = b.filter(k=>!ramble.has(keys[k]) && !STOPS.has(keys[k]));
      if (strict.length) strictN++; if (strictLeg.length) strictL++;
      const newOnly = strict.filter(k=>l.status[k]!=='read');
      if (newOnly.length) { newOnlyCases++; if (sx.length<4) sx.push(t.id+': '+newOnly.map(k=>keys[k]+'@'+k).join(',')+' | '+heard.join(' ')); }
    }
  }
  console.log({cases,newFGwords:N,legacyFGwords:L,strictCasesNew:strictN,strictCasesLegacy:strictL,newOnlyStrictCases:newOnlyCases}); console.log(sx.join('\n\n'));
});
