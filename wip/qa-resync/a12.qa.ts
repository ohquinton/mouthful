import { align, preparePassage } from './h';
import { legacyAlign } from './legacy';
import { PASSAGES } from 'C:/Users/ohqui/Downloads/mouthful-app/mouthful-app/src/content/passages';
let seed = 3; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
function bench(label: string, p: any, heard: string[]) {
  let worst = 0, worstLegacy = 0, sum = 0;
  for (let i = 1; i <= heard.length; i++) {
    const h = heard.slice(0, i);
    let t = process.hrtime.bigint(); align(p, h); const d = Number(process.hrtime.bigint() - t) / 1e6;
    t = process.hrtime.bigint(); legacyAlign(p, h); const dl = Number(process.hrtime.bigint() - t) / 1e6;
    worst = Math.max(worst, d); worstLegacy = Math.max(worstLegacy, dl); sum += d;
  }
  // repeat the worst-length call (cache warm) 20 times
  let t = process.hrtime.bigint(); for (let r = 0; r < 20; r++) align(p, heard); const last = Number(process.hrtime.bigint() - t) / 1e6 / 20;
  console.log(label, { words: p.length, heard: heard.length, worstMs: +worst.toFixed(2), meanMs: +(sum / heard.length).toFixed(3), fullTranscriptMs: +last.toFixed(2), legacyWorstMs: +worstLegacy.toFixed(2) });
}
test('perf', () => {
  const big = PASSAGES.map((x: any) => x.text).join(' '); const p = preparePassage(big); const keys = p.map(w => w.key);
  const p300 = preparePassage(keys.slice(0, 300).join(' ')); const k300 = p300.map(w => w.key);
  const vocab = [...new Set(k300)];
  const ramble = Array.from({ length: 100 }, () => vocab[Math.floor(rnd() * vocab.length)]);
  const commons = Array.from({ length: 100 }, (_, i) => ['the','and','we','to','of','i','a','it','that','so'][i % 10]);
  bench('300 verbatim', p300, k300);
  bench('300: 150 read + 100 random passage words + rest', p300, [...k300.slice(0, 150), ...ramble, ...k300.slice(150)]);
  bench('300: 100 stopwords ramble', p300, [...k300.slice(0, 50), ...commons, ...k300.slice(50)]);
  bench('300: read with skip/back every 8 words', p300, (() => { const o: string[] = []; let pos = 0; while (pos < 300) { o.push(...k300.slice(pos, pos + 8)); pos += rnd() < 0.5 ? 14 : 2; } return o; })());
  bench('all passages ' + p.length + ' words + 100 ramble at 50', p, [...keys.slice(0, 50), ...Array.from({ length: 100 }, () => keys[Math.floor(rnd() * keys.length)]), ...keys.slice(50, 400)]);
});
