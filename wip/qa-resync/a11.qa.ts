import { align, preparePassage } from './h';
import { paceSegments, paceSteadiness } from 'C:/Users/ohqui/Downloads/mouthful-app/mouthful-app/src/engine/steadiness';
import { PASSAGES } from 'C:/Users/ohqui/Downloads/mouthful-app/mouthful-app/src/content/passages';
function session(p: any, heard: string[], msPerWord = 400) {
  const reachedAt: (number|undefined)[] = []; let prevNext = 0; let pauses = 0; let last = 0; let nudge = 0;
  for (let i = 1; i <= heard.length; i++) {
    const t = i * msPerWord; const a = align(p, heard.slice(0, i));
    if (t - last > 6000) nudge++;
    if (a.next !== prevNext) { for (let k = prevNext; k < a.next; k++) reachedAt[k] ??= t; prevNext = a.next; last = t; }
  }
  const raw = align(p, heard).status;
  const seg = paceSegments(p, reachedAt, raw); return { seg, st: paceSteadiness(seg), raw, nudge };
}
test('backfill timing', () => {
  const p0 = PASSAGES.find((x: any) => x.id === 'night-shift')!; const p = preparePassage(p0.text); const keys = p.map(w => w.key);
  const S = [] as [number, number][]; let s = 0; p.forEach((w, i) => { if (w.sentenceEnd) { S.push([s, i + 1]); s = i + 1; } });
  console.log(S.map(([a,b])=>keys.slice(a,b).join(' ')).join(' | '));
  const clean = session(p, keys);
  // skip sentence 2, say 5 words of sentence 3, realise, go back and read sentence 2, then on from sentence 3
  const [a2, b2] = S[1]; const heard = [...keys.slice(0, b2 - (b2 - a2)), ...keys.slice(b2, b2 + 5), ...keys.slice(a2, b2), ...keys.slice(b2)];
  const r = session(p, heard);
  console.log('clean', JSON.stringify(clean.seg), clean.st?.score);
  console.log('backfill', JSON.stringify(r.seg), r.st?.score, 'redLeft', r.raw.filter(x=>x==='skipped').length, 'nudgeTicks', r.nudge);
});
