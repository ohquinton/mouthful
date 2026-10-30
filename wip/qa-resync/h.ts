import { align, preparePassage, tokenise, withCorrections, type WordStatus } from 'C:/Users/ohqui/Downloads/mouthful-app/mouthful-app/src/engine/align';
export { align, preparePassage, tokenise, withCorrections };
export const code = (s: WordStatus[]) => s.map((x) => (x === 'read' ? 'r' : x === 'skipped' ? 's' : '.')).join('');
export function run(text: string, said: string) {
  const p = preparePassage(text);
  const h = tokenise(said);
  const a = align(p, h);
  return { p, h, a, show: p.map((w, i) => (a.status[i] === 'read' ? w.display.toUpperCase() : a.status[i] === 'skipped' ? `[${w.display}]` : `_${w.display}`)).join(' ') };
}
/** Word by word, returns statuses at every prefix and flip counts per passage word. */
export function trace(text: string, said: string) {
  const p = preparePassage(text);
  const h = tokenise(said);
  const hist: string[] = [];
  const nexts: number[] = [];
  for (let i = 1; i <= h.length; i++) { const a = align(p, h.slice(0, i)); hist.push(code(a.status)); nexts.push(a.next); }
  return { p, h, hist, nexts };
}
