import { preparePassage, tokenise, align } from './h';
import { legacyAlign } from './legacy';
import { PASSAGES } from 'C:/Users/ohqui/Downloads/mouthful-app/mouthful-app/src/content/passages';
const show = (p: any, a: any) => p.map((w: any, i: number) => (a.status[i] === 'read' ? w.display.toUpperCase() : a.status[i] === 'skipped' ? `[${w.display}]` : `_${w.display}`)).join(' ');
test('min', () => {
  const p = preparePassage(PASSAGES.find((x: any) => x.id === 'night-shift')!.text);
  let h = tokenise('yesterday yesterday the ward was quiet until the storm knocked the power um out mara steadied the lantern particularly careful with the new generator and walked wait zzthe hallway room by room nobody okay panicked a patient in bed four asked if this happened often not often she said but often enough that we we know like what to zzdo by midnight lights were back back the monitors were humming monitors were humming and the coffee in the coffee in the break room was unfortunately still terrible');
  const reds = (hh: string[]) => align(p, hh).read; const lreds = (hh: string[]) => legacyAlign(p, hh).read;
  const bad = (hh: string[]) => lreds(hh) - reds(hh) >= 5;
  console.log('start', reds(h), lreds(h));
  let changed = true; while (changed) { changed = false; for (let i = 0; i < h.length; i++) { const c = [...h.slice(0, i), ...h.slice(i + 1)]; if (bad(c)) { h = c; changed = true; } } }
  console.log('HEARD: ' + h.join(' ') + '\nNEW: ' + show(p, align(p, h)) + '\nOLD: ' + show(p, legacyAlign(p, h)));
  for (let i = 1; i <= h.length; i++) { const a = align(p, h.slice(0, i)); if (i > h.length - 12) console.log(i, h[i-1], 'next', a.next, 'read', a.read, 'skipped', a.skipped); }
});
