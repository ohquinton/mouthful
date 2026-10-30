// Habit-word classifier (DECISIONS.md 2026-10-29). Per-rule tests first, then the labelled corpus,
// then speed. Tables print with `npx jest habits`.

import { classifyHabits, habitSummary, type HabitWord, type HeardToken } from '../habits';
import { tokenise } from '../align';
import { PASSAGES } from '../../content/passages';
import { WORD_PACKS } from '../../content/wordpacks';
import { MOMENTS } from '../../content/moments';
import { BASELINE } from '../../content/resolve';

const label = (text: string, word: HabitWord, nth = 0) => {
  const hits = classifyHabits(tokenise(text)).filter((r) => r.word === word);
  const hit = hits[nth];
  if (!hit) throw new Error(`no "${word}" #${nth} in "${text}"`);
  return hit;
};
const is = (text: string, word: HabitWord, expected: 'filler' | 'real' | 'unsure', nth = 0) =>
  expect([text, label(text, word, nth).label]).toEqual([text, expected]);

/** Steady speech: a word every 300 ms, 700 ms more wherever the text has "|". */
function timed(text: string): HeardToken[] {
  const out: HeardToken[] = [];
  let t = 0;
  for (const raw of text.split(/\s+/)) {
    if (raw === '|') {
      t += 700;
      continue;
    }
    for (const word of tokenise(raw)) {
      out.push({ word, start: t, end: t + 250 });
      t += 300;
    }
  }
  return out;
}

describe('like', () => {
  it('is a real verb after a subject, modal or "to"', () => {
    is('i like it', 'like', 'real');
    is('i would like to add one thing', 'like', 'real');
    is("i'd like to walk you through it", 'like', 'real');
    is('they really like the new design', 'like', 'real');
    is('you will like it here', 'like', 'real');
    is('i used to like spreadsheets', 'like', 'real');
    is('i very like this company', 'like', 'real'); // Mandarin-L1 word order
    is('she like the job', 'like', 'real'); // dropped -s
    is('i like um pizza', 'like', 'real'); // judged as "i like pizza": the um is counted on its own
  });

  it('is a real comparison or "such as"', () => {
    is('it looks like rain', 'like', 'real');
    is('it feels like we are behind', 'like', 'real');
    is('something like a thousand dollars', 'like', 'real');
    is('tools like jira and slack', 'like', 'real');
    is("it's like that every monday", 'like', 'real');
    is('it went like this', 'like', 'real');
    is('what is it like to work here', 'like', 'real');
    is('like i said the budget is fixed', 'like', 'real');
    is('and like we discussed', 'like', 'real');
  });

  it('is a filler inside a clause', () => {
    is('it was like huge', 'like', 'filler');
    is("it's like really hard", 'like', 'filler');
    is('the meeting like went for two hours', 'like', 'filler');
    is('they like said no', 'like', 'filler'); // a subject, but a past-tense verb follows
    is('and like the client said no', 'like', 'filler');
    is('but like nobody told us', 'like', 'filler');
  });

  it('is a filler next to a hesitation, another habit word or itself', () => {
    // An um next to it never decides: "um like the numbers" could be a stall before a comparison,
    // and align.ts already counts the um. (Recall cost, accepted: these fall back to unsure.)
    is('like um i do not know', 'like', 'unsure');
    is('um like the numbers were off', 'like', 'unsure');
    is('it was like um crazy', 'like', 'filler'); // judged as "it was like crazy"
    is('you know like it was a mess', 'like', 'filler');
    is('it was like like insane', 'like', 'filler');
  });

  it('stays unsure for approximations, quotatives and "be like a"', () => {
    is('we had like fifty people', 'like', 'unsure');
    is('it took like 10 minutes', 'like', 'unsure'); // digits from the recogniser
    is('she was like no way', 'like', 'unsure');
    is('it is like a puzzle', 'like', 'unsure');
    is('it was like a mess', 'like', 'unsure');
  });

  it('does not let a burst accuse real verbs', () => {
    const r = classifyHabits(tokenise('i like it and they like it and we like it'));
    expect(r.map((x) => x.label)).toEqual(['real', 'real', 'real']);
  });

  it('turns unsure uses into fillers inside a burst, never the real ones', () => {
    const r = classifyHabits(tokenise('it was like crazy and like everyone was like screaming'));
    expect(r.map((x) => [x.label, x.reason])).toEqual([
      ['filler', 'be-like-adj'],
      ['filler', 'after-conj'],
      ['filler', 'burst'],
    ]);
    const mixed = classifyHabits(tokenise('i like it like a lot like seriously like'));
    expect(mixed[0].label).toBe('real');
  });

  it('a burst needs three non-real uses inside 15 tokens', () => {
    const near = 'it was like a mess and like a b c d e f g h like a';
    expect(classifyHabits(tokenise(near)).every((x) => x.label === 'filler')).toBe(true);
    const far = 'it was like a mess and like a b c d e f g h i j k l m n like a';
    expect(classifyHabits(tokenise(far))[0].label).toBe('unsure');
  });
});

describe('pauses', () => {
  it('push a leaning-filler like to filler only when both sides pause', () => {
    expect(classifyHabits(timed('we need | like | faster builds'))[0]).toMatchObject({ label: 'filler', reason: 'pause' });
    expect(classifyHabits(timed('we need like | faster builds'))[0].label).toBe('unsure');
    expect(classifyHabits(tokenise('we need like faster builds'))[0].label).toBe('unsure'); // no times, no pause signal
  });

  it('are never enough on their own', () => {
    expect(classifyHabits(timed("it's | like | a puzzle"))[0].label).toBe('unsure');
    expect(classifyHabits(timed('so | we started with the data'))[0].label).toBe('unsure');
    expect(classifyHabits(timed('actually | i think we are fine'))[0].label).toBe('unsure');
  });

  it('never turn a real use into a filler', () => {
    expect(classifyHabits(timed('i would like | to add one thing'))[0].label).toBe('real');
    expect(classifyHabits(timed('it looks | like | rain'))[0].label).toBe('real');
  });

  it('are ignored when the times look like arrival times, not audio', () => {
    // Server recognition: a batch of words arrives with one stamp.
    const bursty: HeardToken[] = ['we', 'need', 'like', 'faster', 'builds'].map((word, i) => ({ word, start: i < 3 ? 0 : 2000 }));
    expect(classifyHabits(bursty)[0].label).toBe('unsure');
    // And a caller can switch them off.
    expect(classifyHabits(timed('we need | like | faster builds'), { times: 'ignore' })[0].label).toBe('unsure');
  });

  it('work with start times only (no end times)', () => {
    const t: HeardToken[] = [
      { word: 'we', start: 0 },
      { word: 'need', start: 300 },
      { word: 'like', start: 1400 },
      { word: 'faster', start: 2400 },
      { word: 'builds', start: 2800 },
    ];
    expect(classifyHabits(t)[0].label).toBe('filler');
  });
});

describe('you know', () => {
  it('is a real verb with a question, "let", "as" or an object', () => {
    is('do you know the answer', 'you know', 'real');
    is("i'll let you know by friday", 'you know', 'real');
    is('as you know the budget is fixed', 'you know', 'real');
    is('you know him from the last job', 'you know', 'real');
    is('you know where is the station', 'you know', 'real'); // ESL inversion
  });
  it('is a filler inside a phrase or clause', () => {
    is('the you know budget meeting', 'you know', 'filler');
    is('it was you know pretty bad', 'you know', 'filler');
    is('you know you know the thing is', 'you know', 'filler');
  });
  it('stays unsure as a single tag or opener', () => {
    is('it was hard you know', 'you know', 'unsure');
    is('you know i think we should wait', 'you know', 'unsure');
    is('it was a long day you know we had no budget', 'you know', 'unsure');
  });
});

describe('so', () => {
  it('is real for degree, purpose, result and pro-forms', () => {
    is('thank you so much', 'so', 'real');
    is('it was so good', 'so', 'real');
    is('so that we can ship on time', 'so', 'real');
    is('we were late so we cancelled', 'so', 'real');
    is('i think so', 'so', 'real');
    is('ten or so people', 'so', 'real');
    is('and so on', 'so', 'real');
  });
  it('stays unsure as a discourse opener, even before a pause or um', () => {
    is('so today i will talk about our results', 'so', 'unsure');
    is('so um the numbers are down', 'so', 'unsure');
    is('so that was the plan', 'so', 'unsure');
  });
  it('is a filler as a stutter or a tic', () => {
    is('so so what we did was', 'so', 'filler');
    expect(classifyHabits(tokenise('so um so the thing is so yeah')).map((x) => x.label)).toEqual(['filler', 'filler', 'filler']);
  });
});

describe('actually, basically, literally', () => {
  it('keeps a single opener unsure (normal in Indian English)', () => {
    is('actually i wanted to ask about the leave policy', 'actually', 'unsure');
    is('actually the client called today itself', 'actually', 'unsure');
    is('he only told me actually', 'actually', 'unsure');
    is('basically the server ran out of memory', 'basically', 'unsure');
  });
  it('is real as contrast or in its literal sense', () => {
    is('did it actually work', 'actually', 'real');
    is('what actually happened', 'actually', 'real');
    is("don't take it literally", 'literally', 'real');
    is('the file is literally called final', 'literally', 'real');
    is("it's literally the title of the book", 'literally', 'real');
  });
  it('is a filler stacked, repeated or in a burst', () => {
    is('actually like basically we lost the deal', 'actually', 'filler');
    is('actually like basically we lost the deal', 'basically', 'filler');
    is('basically basically what we do is', 'basically', 'filler');
    expect(classifyHabits(tokenise('actually we tried that actually and actually it failed')).every((x) => x.label === 'filler')).toBe(true);
  });
});

describe('right', () => {
  it('is real as an adverb or adjective', () => {
    is('right now we are on track', 'right', 'real');
    is('we need the right people', 'right', 'real');
    is("you're right", 'right', 'real');
    is('all right let us start', 'right', 'real');
    is('we got it right', 'right', 'real');
    is('it sits right where my two interests meet', 'right', 'real'); // found in a built-in passage
    is('right when the call started', 'right', 'real');
  });
  it('stays unsure as a single tag question or opener', () => {
    is('we ship on friday right', 'right', 'unsure');
    is('right so let us begin', 'right', 'unsure');
    is('right right i see', 'right', 'unsure');
  });
  it('is a filler when the tag is a tic', () => {
    const r = classifyHabits(tokenise("it's due monday right and qa signs off right and the budget is fixed right"));
    expect(r.map((x) => x.label)).toEqual(['filler', 'filler', 'filler']);
  });
});

describe('i mean', () => {
  it('is real as a verb', () => {
    is('i mean it', 'i mean', 'real');
    is("that's what i mean", 'i mean', 'real');
    is('i mean to finish this today', 'i mean', 'real');
  });
  it('stays unsure as a self-repair', () => {
    is('i mean the second slide not the first', 'i mean', 'unsure');
  });
  it('is a filler stacked or repeated', () => {
    is('i mean like it was fine', 'i mean', 'filler');
    is("i mean i mean it's complicated", 'i mean', 'filler');
  });
});

describe('kind of, sort of', () => {
  it('is real as a noun', () => {
    is('a kind of tool for teams', 'kind of', 'real');
    is('what sort of role is it', 'sort of', 'real');
    is('these kind of issues', 'kind of', 'real');
  });
  it('stays unsure as a hedge, even in a burst', () => {
    is("it's kind of slow", 'kind of', 'unsure');
    is('we sort of agreed', 'sort of', 'unsure');
    is("it's kinda slow", 'kind of', 'unsure');
    expect(classifyHabits(tokenise("it's kind of slow and kind of buggy and kind of expensive")).every((x) => x.label === 'unsure')).toBe(true);
  });
  it('is a filler stacked or repeated', () => {
    is('kind of you know messy', 'kind of', 'filler');
    is('kind of kind of weird', 'kind of', 'filler');
  });
});

describe('output', () => {
  it('reports index and span against the token list', () => {
    const r = classifyHabits(tokenise('well you know the you know budget'));
    expect(r.map((x) => [x.index, x.span, x.word])).toEqual([
      [1, 2, 'you know'],
      [4, 2, 'you know'],
    ]);
  });
  it('ignores words that are not habit words, and empty input', () => {
    expect(classifyHabits([])).toEqual([]);
    expect(classifyHabits(tokenise('the plan is ready only'))).toEqual([]);
  });
  it('summarises counts per word', () => {
    const s = habitSummary(classifyHabits(tokenise('it was like huge and i like it so so')));
    expect(s.filler).toBe(3);
    expect(s.real).toBe(1);
    expect(s.byWord.like).toEqual({ filler: 1, unsure: 0, real: 1 });
  });
});

// ---------------------------------------------------------------------------------------------
// Corpus.

type Mark = { word: HabitWord; truth: 'filler' | 'real'; confident: boolean };
type Item = { tokens: HeardToken[]; marks: Map<number, Mark>; text: string; l1: string };

const PHRASE: Record<string, HabitWord> = {
  you_know: 'you know',
  i_mean: 'i mean',
  kind_of: 'kind of',
  sort_of: 'sort of',
  kinda: 'kind of',
  sorta: 'sort of',
};

/** Parses the fixture markup (see habits-corpus.json "_markup"). */
function parse(text: string, timing: 'none' | 'steady' | 'bursty'): Item & { pauses: boolean } {
  const words: string[] = [];
  const pauseBefore: boolean[] = [];
  const marks = new Map<number, Mark>();
  let pause = false;
  for (const raw of text.split(/\s+/)) {
    if (raw === '|') {
      pause = true;
      continue;
    }
    const m = /^(.+)\/([FfRr])$/.exec(raw);
    const body = m ? m[1] : raw;
    const parts = body.split('_');
    if (m) {
      const word = (PHRASE[body] ?? body) as HabitWord;
      marks.set(words.length, { word, truth: /f/i.test(m[2]) ? 'filler' : 'real', confident: m[2] === m[2].toUpperCase() });
    }
    parts.forEach((p, i) => {
      words.push(p);
      pauseBefore.push(i === 0 && pause);
    });
    pause = false;
  }
  const hasPauses = pauseBefore.some(Boolean);
  let tokens: HeardToken[] = words;
  if (timing === 'steady' || (timing === 'none' && hasPauses)) {
    let t = 0;
    tokens = words.map((word, i) => {
      if (pauseBefore[i]) t += 700;
      const tok = { word, start: t, end: t + 250 };
      t += 300;
      return tok;
    });
  } else if (timing === 'bursty') {
    tokens = words.map((word, i) => ({ word, start: Math.floor(i / 4) * 1500 }));
  }
  return { tokens, marks, text, l1: '', pauses: hasPauses };
}

type Fixture = { groups: { ctx: string; l1: string; timing?: 'bursty'; items: string[] }[] };
function load(file: string): Item[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- JSON fixture by path, as in resync.test.ts
  const f: Fixture = require(file);
  return f.groups.flatMap((g) =>
    g.items.map((t) => ({ ...parse(t, g.timing === 'bursty' ? 'bursty' : 'none'), l1: g.l1 })),
  );
}

type Row = {
  word: string;
  n: number;
  fillers: number; // truly filler
  reals: number;
  called: number; // classifier said filler
  tp: number;
  accused: number; // real called filler
  unsure: number;
  confidentAgree: number; // confident marks the classifier answered (not unsure) correctly
  confident: number;
};

function score(items: Item[]) {
  const rows = new Map<string, Row>();
  const problems: string[] = [];
  const accusations: string[] = [];
  const row = (w: string) => {
    let r = rows.get(w);
    if (!r) rows.set(w, (r = { word: w, n: 0, fillers: 0, reals: 0, called: 0, tp: 0, accused: 0, unsure: 0, confidentAgree: 0, confident: 0 }));
    return r;
  };
  for (const it of items) {
    const out = classifyHabits(it.tokens);
    const seen = new Set<number>();
    for (const o of out) {
      const m = it.marks.get(o.index);
      if (!m || m.word !== o.word) {
        problems.push(`unmarked ${o.word}@${o.index}: "${it.text}"`);
        continue;
      }
      seen.add(o.index);
      for (const key of [o.word, 'ALL', `l1:${it.l1}`]) {
        const r = row(key);
        r.n++;
        if (m.truth === 'filler') r.fillers++;
        else r.reals++;
        if (o.label === 'filler') {
          r.called++;
          if (m.truth === 'filler') r.tp++;
          else r.accused++;
        }
        if (o.label === 'unsure') r.unsure++;
        if (m.confident) {
          r.confident++;
          if (o.label === m.truth) r.confidentAgree++;
        }
      }
      if (o.label === 'filler' && m.truth === 'real') accusations.push(`${o.word} [${o.reason}] "${it.text}"`);
    }
    for (const [idx, m] of it.marks) if (!seen.has(idx)) problems.push(`mark not found ${m.word}@${idx}: "${it.text}"`);
  }
  return { rows, problems, accusations };
}

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '–');
function table(title: string, rows: Map<string, Row>) {
  const order = ['like', 'so', 'you know', 'actually', 'basically', 'literally', 'i mean', 'kind of', 'sort of', 'right', 'ALL'];
  const keys = [...order.filter((k) => rows.has(k)), ...[...rows.keys()].filter((k) => k.startsWith('l1:')).sort()];
  const lines = [
    title,
    'word        n  fill  real  called  precision  recall  unsure  accused/real  confident-agree',
    ...keys.map((k) => {
      const r = rows.get(k)!;
      return [
        k.padEnd(10),
        String(r.n).padStart(3),
        String(r.fillers).padStart(5),
        String(r.reals).padStart(5),
        String(r.called).padStart(7),
        pct(r.tp, r.called).padStart(10),
        pct(r.tp, r.fillers).padStart(7),
        pct(r.unsure, r.n).padStart(7),
        `${r.accused}/${r.reals} ${pct(r.accused, r.reals)}`.padStart(13),
        pct(r.confidentAgree, r.confident).padStart(16),
      ].join(' ');
    }),
  ];
  console.log(lines.join('\n'));
}

describe('labelled corpus', () => {
  const dev = load('./fixtures/habits-corpus.json');
  const holdout = load('./fixtures/habits-holdout.json');

  it('labels every habit word in the fixtures (dev ≥ 400 occurrences)', () => {
    const d = score(dev);
    const h = score(holdout);
    expect([...d.problems, ...h.problems]).toEqual([]);
    expect(d.rows.get('ALL')!.n).toBeGreaterThanOrEqual(400);
  });

  it('dev set: filler precision ≥ 0.90, false accusations ≤ 3% of real uses', () => {
    const { rows, accusations } = score(dev);
    table('DEV (tuned on)', rows);
    if (accusations.length) console.log(`False accusations (dev):\n  ${accusations.join('\n  ')}`);
    const all = rows.get('ALL')!;
    expect(all.tp / all.called).toBeGreaterThanOrEqual(0.9);
    expect(all.accused / all.reals).toBeLessThanOrEqual(0.03);
  });

  it('holdout set (never tuned on): same bar', () => {
    const { rows, accusations } = score(holdout);
    table('HOLDOUT (not tuned on)', rows);
    if (accusations.length) console.log(`False accusations (holdout):\n  ${accusations.join('\n  ')}`);
    const all = rows.get('ALL')!;
    expect(all.tp / all.called).toBeGreaterThanOrEqual(0.9);
    expect(all.accused / all.reals).toBeLessThanOrEqual(0.03);
  });
});

describe('text that was written, not spoken', () => {
  // Every text the app ships (and the test scripts) is edited prose: a "filler" found in one is a
  // false accusation by construction. A reader reading it verbatim must never be told off.
  const texts: { id: string; text: string }[] = [
    ...PASSAGES.map((p) => ({ id: p.id, text: p.text })),
    { id: BASELINE.id, text: BASELINE.text },
    ...WORD_PACKS.flatMap((pack) => pack.passages.map((p, i) => ({ id: `w.${pack.id}.${i}`, text: p.text }))),
    ...MOMENTS.map((m) => ({ id: `moment.${m.id}`, text: m.scriptPlaceholder })),
    ...require('./fixtures/memory-scripts.json').scripts,
    ...require('./fixtures/repeated-phrases.json').scripts,
  ];

  it('finds no fillers in any built-in passage or script read verbatim', () => {
    let seen = 0;
    const fillers: string[] = [];
    for (const t of texts) {
      const w = tokenise(t.text);
      for (const r of classifyHabits(w)) {
        seen++;
        if (r.label === 'filler') fillers.push(`${t.id}: ${r.word} [${r.reason}] ${w.slice(Math.max(0, r.index - 4), r.index + 6).join(' ')}`);
      }
    }
    console.log(`Built-in texts: ${texts.length}, habit-word occurrences: ${seen}, fillers: ${fillers.length}`);
    expect(seen).toBeGreaterThan(15);
    expect(fillers).toEqual([]);
  });
});

describe('on-device transcripts (um and uh dropped)', () => {
  // On-device recognisers often write nothing for "um". A real use must not turn into a filler when
  // the hesitations next to it vanish. (Fillers may fall back to unsure: that's recall, not trust.)
  it('accuses no real use when hesitations are removed', () => {
    const HES = new Set(['um', 'umm', 'uh', 'uhh', 'uhm', 'erm', 'er', 'ah', 'hmm', 'mm']);
    const items = [...load('./fixtures/habits-corpus.json'), ...load('./fixtures/habits-holdout.json')];
    let reals = 0;
    let changed = 0;
    const accused: string[] = [];
    for (const it of items) {
      const words = it.tokens.map((t) => (typeof t === 'string' ? t : t.word));
      if (!words.some((w) => HES.has(w))) continue;
      changed++;
      const keep: number[] = [];
      words.forEach((w, i) => !HES.has(w) && keep.push(i));
      const out = classifyHabits(keep.map((i) => it.tokens[i]));
      for (const o of out) {
        const m = it.marks.get(keep[o.index]);
        if (m?.truth !== 'real') continue;
        reals++;
        if (o.label === 'filler') accused.push(it.text);
      }
    }
    console.log(`Items with hesitations: ${changed}, real uses in them: ${reals}, accused after removing um/uh: ${accused.length}`);
    expect(changed).toBeGreaterThan(10);
    expect(accused).toEqual([]);
  });
});

describe('nervous speakers (an um next to a real use)', () => {
  it('keeps the verb in "i would um like to"', () => {
    is('i would um like to add one thing', 'like', 'real');
    is('it looks uh like rain', 'like', 'real');
    // "you um know" isn't the phrase "you know": nothing to judge.
    expect(classifyHabits(tokenise('do you um know the answer'))).toEqual([]);
    is('we talked to um you know the finance team', 'you know', 'unsure');
  });

  it('accuses no real use in the corpus when an um is added before or after it', () => {
    const items = [...load('./fixtures/habits-corpus.json'), ...load('./fixtures/habits-holdout.json')];
    let tried = 0;
    const accused: string[] = [];
    for (const it of items) {
      for (const [idx, m] of it.marks) {
        if (m.truth !== 'real') continue;
        const first = it.tokens[idx];
        const single = (typeof first === 'string' ? first : first.word).endsWith('a'); // kinda, sorta
        const span = m.word.includes(' ') && !single ? 2 : 1;
        for (const pos of [idx, idx + span]) {
          const toks = [...it.tokens.slice(0, pos), 'um', ...it.tokens.slice(pos)];
          const at = pos === idx ? idx + 1 : idx;
          const hit = classifyHabits(toks).find((r) => r.index === at);
          tried++;
          if (hit?.label === 'filler') accused.push(`${m.word} [${hit.reason}] ${toks.map((t) => (typeof t === 'string' ? t : t.word)).join(' ')}`);
        }
      }
    }
    console.log(`Real uses with an um added: ${tried}, accused: ${accused.length}\n  ${accused.join('\n  ')}`);
    expect(accused).toEqual([]);
  });
});

describe('speed', () => {
  it('classifies a 200-token minute in under 0.2 ms', () => {
    const minute = tokenise(
      'so today i want to walk you through the numbers and like it was a hard quarter you know ' +
        'we basically had to rebuild the pipeline right and i mean the team was like so tired but we got it right in the end ' +
        'actually the client said they like the new dashboard and it looks like we will hit the target so that is good ' +
        'um the next part is kind of tricky because we sort of agreed to ship early and literally nobody planned for that ',
    );
    const words: HeardToken[] = [];
    while (words.length < 200) words.push(...minute.map((w, i) => ({ word: w, start: (words.length + i) * 300, end: (words.length + i) * 300 + 250 })));
    words.length = 200;
    for (let k = 0; k < 200; k++) classifyHabits(words); // warm up
    const runs = 2000;
    const t0 = performance.now();
    let sink = 0;
    for (let k = 0; k < runs; k++) sink += classifyHabits(words).length;
    const ms = (performance.now() - t0) / runs;
    console.log(`classifyHabits: ${ms.toFixed(4)} ms per 200 tokens (${sink / runs} habit words)`);
    expect(ms).toBeLessThan(0.2);
  });
});

