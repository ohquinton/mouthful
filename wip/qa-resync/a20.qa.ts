import { preparePassage, tokenise } from './h'; import { legacyAlign } from './legacy'; const run = (t: string, s: string) => { const p = preparePassage(t); const a = legacyAlign(p, tokenise(s)); return { p, a, show: '' }; };
const cases: [string, string, string][] = [
 ['early done via final 3', 'We cut costs by ten percent this year. The board asked for more detail on hiring and the new office plan. That is the update for today.',
  'we cut costs by ten percent this year the board asked um is that the update for today'],
 ['early done short tail', 'We cut costs by ten percent this year. The board asked for more detail on hiring. Thanks for listening.',
  'we cut costs by ten percent this year the board asked for more detail sorry thanks for listening'],
 ['done after aside quoting end', 'I want this job because it combines health and software. I spent four years as a nurse. That is why I want this job.',
  'i want this job because it combines health and software i spent four years oh and why i want this job'],
 ['restart from top, then pause', 'I want this job because it combines health and software. I spent four years as a nurse. That is why I want this job.',
  'i want this job because it combines health and software i spent four years as a i want this job'],
];
test('done', () => { for (const [l, t, s] of cases) { const r = run(t, s); console.log(l + `  done=${r.a.done} next=${r.a.next}/${r.p.length}\n  ` + r.show); } });
