import { run, preparePassage, tokenise, align } from './h';
import { legacyAlign } from './legacy';
const T = 'Not often, she said, but often enough that we know what to do. By midnight the lights were back and the monitors were humming.';
const show = (p: any, a: any) => p.map((w: any, i: number) => (a.status[i] === 'read' ? w.display.toUpperCase() : a.status[i] === 'skipped' ? `[${w.display}]` : `_${w.display}`)).join(' ');
test('x', () => {
  for (const s of [
    'not often she said but often enough that we we know like what to zzdo by midnight lights were back back the monitors were humming',
    'not often she said but often enough that we we know like what to zzdo by midnight the lights were back',
    'not often she said but often enough that we know like what to zzdo by midnight the lights were back',
    'not often she said but often enough that we we know what to zzdo by midnight the lights were back',
    'not often she said but often enough that we know what to doo by midnight the lights were back',
  ]) { const p = preparePassage(T); const h = tokenise(s); console.log('HEARD: ' + s + '\n NEW: ' + show(p, align(p, h)) + '\n OLD: ' + show(p, legacyAlign(p, h))); }
});
