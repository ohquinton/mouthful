import { preparePassage, tokenise, align } from './h';
import { legacyAlign } from './legacy';
const show = (p: any, a: any) => p.map((w: any, i: number) => (a.status[i] === 'read' ? w.display.toUpperCase() : a.status[i] === 'skipped' ? `[${w.display}]` : `_${w.display}`)).join(' ');
const T = 'Not often, she said, but often enough that we know what to do. By midnight the lights were back, the monitors were humming, and the coffee in the break room was, unfortunately, still terrible.';
test('m', () => {
  const p = preparePassage(T);
  for (const s of [
    'not often she said but often enough that we know what to do by midnight lights were back back the monitors were humming',
    'not often she said but often enough that we know what to zzdo by midnight lights were back back the monitors were humming',
    'not often she said but often enough that we know what to zzdo by midnight lights were back the monitors were humming',
    'not often she said but often enough that we know what to zzdo by midnight the lights were back back the monitors were humming',
    'not often she said but often enough that we know what to do by midnight lights were back the monitors were humming',
  ]) { const h = tokenise(s); console.log('HEARD: ' + s + '\n NEW: ' + show(p, align(p, h)) + '\n OLD: ' + show(p, legacyAlign(p, h))); }
});
