import { align, preparePassage } from './h';
import { PASSAGES } from 'C:/Users/ohqui/Downloads/mouthful-app/mouthful-app/src/content/passages';
const MEM = require('C:/Users/ohqui/Downloads/mouthful-app/mouthful-app/src/engine/__tests__/fixtures/memory-scripts.json').scripts;
const REP = require('C:/Users/ohqui/Downloads/mouthful-app/mouthful-app/src/engine/__tests__/fixtures/repeated-phrases.json').scripts;
const texts: {id:string,text:string}[] = [...PASSAGES, ...MEM, ...REP].map((m:any)=>({id:m.id,text:m.text}));
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const FILL = ['sorry','where','was','i','hang','on','um','okay','let','me','see','oops','again','sorry','no'];
test('random rambles of passage vocabulary + skips + re-reads', () => {
  let cases = 0, bad = 0, badFinal = 0; const ex: string[] = [];
  for (const t of texts) {
    const p = preparePassage(t.text); const keys = p.map(w => w.key); const n = p.length;
    for (let rep = 0; rep < 300; rep++) {
      const heard: string[] = []; const said = new Array(n).fill(false); let pos = 0; let reach = 0;
      while (pos < n) {
        const len = 3 + Math.floor(rnd() * 12);
        for (let k = pos; k < Math.min(n, pos + len); k++) { heard.push(keys[k]); said[k] = true; }
        pos = Math.min(n, pos + len); reach = Math.max(reach, pos);
        const r = rnd();
        if (r < 0.35) { const m = 2 + Math.floor(rnd() * 6); for (let j = 0; j < m; j++) heard.push(rnd() < 0.5 ? pick(FILL) : pick(keys)); }
        else if (r < 0.55) pos += 1 + Math.floor(rnd() * 15);
        else if (r < 0.7) pos = Math.max(0, pos - 1 - Math.floor(rnd() * 8));
      }
      cases++;
      let worst = 0, wi = -1, worstAt = -1;
      for (let i = 1; i <= heard.length; i++) {
        const a = align(p, heard.slice(0, i));
        const fg = a.status.filter((s, k) => s === 'read' && !said[k]).length;
        if (fg > worst) { worst = fg; wi = i; }
      }
      const fin = align(p, heard); const ffg = fin.status.map((s,k)=> s==='read'&&!said[k]?k:-1).filter(k=>k>=0);
      if (worst) bad++;
      if (ffg.length) { badFinal++; if (ex.length < 6) ex.push(`${t.id}: final false greens ${ffg.map(k=>keys[k]+'@'+k).join(',')} | heard: ${heard.join(' ')}`); }
    }
  }
  console.log({ cases, anyInterimFalseGreen: bad, finalFalseGreen: badFinal }); console.log(ex.join('\n\n'));
});
