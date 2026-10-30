import { align, preparePassage, tokenise } from './h';
import { PASSAGES } from 'C:/Users/ohqui/Downloads/mouthful-app/mouthful-app/src/content/passages';
const MEM = require('C:/Users/ohqui/Downloads/mouthful-app/mouthful-app/src/engine/__tests__/fixtures/memory-scripts.json').scripts;
const texts: {id:string,text:string}[] = [...PASSAGES.map((p:any)=>({id:p.id,text:p.text})), ...MEM.map((m:any)=>({id:m.id,text:m.text}))];
const STOP = new Set('a an the and or but if so of to in on at by for with from is are was were we i you it this that our my be have has had'.split(' '));
test('aside with a later 3-word chunk, then resume where you were', () => {
  let cases=0, fg=0, leap=0, nudgeRisk=0; const ex: string[] = [];
  for (const t of texts) {
    const p = preparePassage(t.text); const keys = p.map(w=>w.key); const n = p.length;
    for (let pos = 5; pos < n - 30; pos += 3) for (const d of [8, 15, 25]) {
      const c = pos + d; if (c + 3 > n) continue;
      const chunk = keys.slice(c, c + 3); if (chunk.every(w=>STOP.has(w))) continue;
      const stopAt = Math.min(pos + 6, c); // reader resumes and reads 6 words, then Finish
      const heard = [...keys.slice(0,pos), 'sorry', 'wait', ...chunk, 'no', ...keys.slice(pos, stopAt)];
      cases++;
      let maxNext = 0;
      for (let i=1;i<=heard.length;i++){ const a=align(p,heard.slice(0,i)); maxNext=Math.max(maxNext,a.next); }
      const a = align(p, heard);
      const falseG = [c,c+1,c+2].filter(k=>a.status[k]==='read' && k>=stopAt).length;
      if (falseG) { fg++; if (ex.length<4) ex.push(`${t.id} pos=${pos} d=${d} chunk="${chunk.join(' ')}" next=${a.next} (reader at ${stopAt}) green-not-read=${falseG}`); }
      if (maxNext > stopAt + 2) leap++;
      if (a.next - stopAt >= 10) nudgeRisk++;
    }
  }
  console.log({cases, casesWithFalseGreen: fg, cursorLeapAhead: leap, pointerAtLeast10Ahead: nudgeRisk}, ex.join('\n'));
});
