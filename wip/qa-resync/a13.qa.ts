import { align, preparePassage } from './h';
import { legacyAlign } from './legacy';
import { PASSAGES } from 'C:/Users/ohqui/Downloads/mouthful-app/mouthful-app/src/content/passages';
let seed = 5; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const time = (f: () => void, n = 10) => { for (let i=0;i<3;i++) f(); const t = process.hrtime.bigint(); for (let i = 0; i < n; i++) f(); return +(Number(process.hrtime.bigint() - t) / 1e6 / n).toFixed(2); };
test('perf2', () => {
  const big = PASSAGES.map((x: any) => x.text).join(' '); const all = preparePassage(big).map(w => w.key);
  for (const N of [300, 500]) {
    const p = preparePassage(all.slice(0, N).join(' ')); const k = p.map(w => w.key); const vocab=[...new Set(k)];
    const shapes: Record<string, string[]> = {
      verbatim: k,
      'ramble 100 at 50': [...k.slice(0, 50), ...Array.from({ length: 100 }, () => vocab[Math.floor(rnd() * vocab.length)]), ...k.slice(50)],
      'ramble 100 at end': [...k.slice(0, N-20), ...Array.from({ length: 100 }, () => vocab[Math.floor(rnd() * vocab.length)])],
      'read twice': [...k, ...k],
      'every sentence re-read': (() => { const o: string[] = []; let s = 0; p.forEach((w, i) => { if (w.sentenceEnd) { o.push(...k.slice(s, i + 1), ...k.slice(s, i + 1)); s = i + 1; } }); return o; })(),
      'off-script from word 10 (wrong passage)': [...k.slice(0, 10), ...Array.from({ length: 200 }, () => vocab[Math.floor(rnd() * vocab.length)])],
    };
    for (const [nm, h] of Object.entries(shapes)) console.log(N, nm, 'heard', h.length, 'new ms', time(() => align(p, h)), 'legacy ms', time(() => legacyAlign(p, h)));
  }
});
