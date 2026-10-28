import { preparePassage, tokenise, align } from './h';
import { legacyAlign } from './legacy';
import { PASSAGES } from 'C:/Users/ohqui/Downloads/mouthful-app/mouthful-app/src/content/passages';
const show = (p: any, a: any, from: number, to: number) => p.slice(from, to).map((w: any, j: number) => { const i = j + from; return a.status[i] === 'read' ? w.display.toUpperCase() : a.status[i] === 'skipped' ? `[${w.display}]` : `_${w.display}`; }).join(' ');
test('diag', () => {
  const p = preparePassage(PASSAGES.find((x: any) => x.id === 'night-shift')!.text);
  const full = tokenise('yesterday yesterday the ward was quiet until the storm knocked the power um out mara steadied the lantern particularly careful with the new generator and walked wait zzthe hallway room by room nobody okay panicked a patient in bed four asked if this happened often not often she said but often enough that we we know like what to zzdo by midnight lights were back back the monitors were humming monitors were humming and the coffee in the coffee in the break room was unfortunately still terrible');
  const st = full.indexOf('enough');
  for (let i = st; i <= full.length; i++) { const a = align(p, full.slice(0, i)); console.log(i, full[i - 1], a.next, show(p, a, 44, 64)); }
  const sub = full.slice(st - 6);
  console.log('SUB from "she": ' + sub.join(' ') + '\n NEW ' + show(p, align(p, [...full.slice(0, st - 6), ...sub]), 40, 75));
});
