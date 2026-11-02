// Topic talk as the front door (remodel step 5): the route's talk length, the 30-second tag that keeps
// onboarding's first talk out of 60-second trends, what a talk saves (repeated words, variety record),
// the one finding, "your usual", the week's variety, the stop strip, and the prompt synonyms.
import { sanitise } from '../src/analytics';
import { tokenise } from '../src/engine/align';
import { FLOW_VERSION, minuteSummary, type MinuteSummary } from '../src/engine/minute';
import { MINUTE_PROMPTS, promptAfter, promptById } from '../src/content/prompts';
import type { SavedSession } from '../src/store/sessions';
import {
  forLength,
  isShortTalk,
  mainFinding,
  minuteCompleteProps,
  minuteRecord,
  pastMinutes,
  REPEATED_FINDING_AT,
  stopNumber,
  stoppedEarly,
  stripText,
  talkLength,
  usualFor,
  usualText,
  varietyText,
  versionFor,
  weeklyVariety,
  type MinuteRecord,
} from '../src/store/minute';

const PLAIN = 'we should keep the plan simple and test it with real people before the end of the month'.split(' ');

/** n words, one every stepMs from `from` ms, from a cycling plain sentence (or the given words). */
function said(n: number, from = 1500, stepMs = 450, words = PLAIN) {
  const tokens = Array.from({ length: n }, (_, k) => words[k % words.length]);
  return { tokens, times: tokens.map((_, k) => from + k * stepMs) };
}

function summary(n: number, opts: { from?: number; stepMs?: number; words?: string[]; prompt?: string; related?: string[] } = {}): MinuteSummary {
  const t = said(n, opts.from, opts.stepMs, opts.words);
  return minuteSummary({ tokens: t.tokens, heardTimes: t.times, startedAt: 0, prompt: opts.prompt, related: opts.related })!;
}

function session(m: MinuteSummary, over: Partial<SavedSession> = {}, limit: 30 | 60 = 60): SavedSession {
  return {
    id: 'x',
    passageId: 'talk',
    title: 'Topic talk',
    at: 1_000_000_000_000,
    wpm: m.wpm,
    fillers: m.umCount,
    fillersPerMin: m.umPerMin,
    accuracy: null,
    pauses: m.longPauses,
    seconds: limit,
    score: 70,
    stumbled: [],
    context: 'talking',
    kind: 'minute',
    flow: m.flow,
    flowVersion: m.flowVersion,
    promptId: 'p01',
    level: 1,
    overruled: [],
    minute: minuteRecord(m, limit),
    ...over,
  };
}

describe('talk length from the route', () => {
  it("'30' gives 30 seconds; anything else, or nothing, a minute", () => {
    expect(talkLength('30')).toBe(30);
    expect(talkLength('60')).toBe(60);
    expect(talkLength(undefined)).toBe(60);
    expect(talkLength('45')).toBe(60);
    expect(talkLength(['30'])).toBe(60);
  });
});

describe('a 30-second talk never mixes with full minutes', () => {
  // 30 s of steady talk: 60 words, one every 450 ms from 1.5 s (last word at ~28 s).
  const raw = summary(60);
  const short = forLength(raw, 30);

  it('has its own Flow version, still a short analytics code', () => {
    expect(versionFor(60)).toBe(FLOW_VERSION);
    expect(short.flowVersion).toBe(`${FLOW_VERSION}-s30`);
    expect(sanitise({ flow_version: short.flowVersion })).toEqual({ flow_version: short.flowVersion });
  });

  it('scores kept going out of 30, so a full 30 seconds is not marked down as half a minute', () => {
    expect(raw.talkSeconds).toBeLessThan(30);
    expect(short.flow).toBeGreaterThan(raw.flow);
    // Every other number is the engine's.
    expect(short.wpm).toBe(raw.wpm);
    expect(short.longPauses).toBe(raw.longPauses);
    expect(short.input).toEqual(raw.input);
  });

  it('never says "You stopped at 28 s" for a 30-second talk that went the distance', () => {
    expect(raw.line).toMatch(/^You stopped at/);
    expect(short.line).toBe('You kept going the whole 30 seconds.');
    expect(forLength(raw, 60)).toBe(raw);
  });

  it('a 30-second talk that stopped early keeps its real seconds', () => {
    const early = forLength(summary(30), 30); // last word at ~15 s
    expect(early.line).toMatch(/^You stopped at 1[45] s\./);
    expect(stoppedEarly(session(early, {}, 30))).toBe(true);
    expect(stoppedEarly(session(short, {}, 30))).toBe(false);
  });

  it('is tagged on the record and by version; left out of a full minute’s past talks and vice versa', () => {
    const s30 = session(short, { id: 's' }, 30);
    expect((s30.minute as MinuteRecord).limitSeconds).toBe(30);
    expect(isShortTalk(s30)).toBe(true);
    expect(isShortTalk({ minute: undefined, flowVersion: `${FLOW_VERSION}-s30` })).toBe(true);
    const full = summary(130);
    const m = (id: string) => session(full, { id });
    const all = [s30, m('a'), m('b'), m('c'), m('now')];
    expect(pastMinutes(all, 4, FLOW_VERSION).map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(pastMinutes(all, 4, versionFor(30)).map((x) => x.id)).toEqual(['s']);
    // A mislabelled one (60 s version, 30 s record) is still kept out.
    const odd = session(full, { id: 'odd', minute: { ...minuteRecord(full), limitSeconds: 30 } as MinuteRecord });
    expect(pastMinutes([odd, m('now')], 1, FLOW_VERSION)).toEqual([]);
  });

  it('session_complete keeps exactly its keys and carries no words', () => {
    const p = minuteCompleteProps(short, MINUTE_PROMPTS[0], 30.2);
    expect(sanitise(p)).toEqual(p);
    expect(p.flow_version).toBe(`${FLOW_VERSION}-s30`);
    expect(JSON.stringify(p)).not.toContain('Coffee');
  });
});

describe('what a talk saves', () => {
  const talk = 'i really like the market because it is really busy and really loud and the food is really good and really cheap and the people are really kind so i really go there every week with my sister and it is really fun'.split(' ');
  const m = summary(talk.length, { words: talk });

  it('the repeated words, as word and count only', () => {
    const r = minuteRecord(m);
    expect(r.repeated?.[0]).toEqual({ word: 'really', count: expect.any(Number) });
    expect(r.repeated?.[0]).not.toHaveProperty('forms');
    expect(r.limitSeconds).toBe(60);
  });

  it('the variety record {mattr, windows, words}, never its precise words', () => {
    const long = summary(130);
    const r = minuteRecord(long);
    expect(r.variety).toEqual({ mattr: long.variety!.mattr, windows: long.variety!.windows, words: long.variety!.words });
    expect(Object.keys(r.variety!).sort()).toEqual(['mattr', 'windows', 'words']);
    // Under 50 words there's no record, and nothing is saved for it.
    expect(minuteRecord(summary(20)).variety).toBeUndefined();
  });

  it('none of it reaches analytics', () => {
    const sent = JSON.stringify(sanitise(minuteCompleteProps(m, MINUTE_PROMPTS[0], 60)));
    expect(sent).not.toContain('really');
  });

  it('older records without the new fields still read', () => {
    const old = session(m);
    const bare = { ...old.minute! } as MinuteRecord;
    delete bare.repeated;
    delete bare.variety;
    delete bare.limitSeconds;
    const s = { ...old, minute: bare };
    expect(isShortTalk(s)).toBe(false);
    expect(mainFinding(s)).toBeTruthy();
    expect(weeklyVariety([s], s.at)).toBeUndefined();
  });
});

describe('the one finding', () => {
  // A full, steady minute: 130 words, one every 450 ms, so the engine's line is "kept going".
  // (The plain sentence repeats "keep" etc.; the base has no repeated words, so each case sets its own.)
  const steady = summary(130);
  const base = { ...session(steady), minute: { ...session(steady).minute!, repeated: [] } as MinuteRecord };

  it('is the engine line when something matters more', () => {
    const early = session(summary(60)); // stopped at ~28 s
    const withWord = { ...early, minute: { ...early.minute!, repeated: [{ word: 'really', count: 9 }] } as MinuteRecord };
    expect(mainFinding(withWord)).toMatch(/^You stopped at/);
  });

  it(`names a word said ${REPEATED_FINDING_AT}+ times only when nothing else fired`, () => {
    expect(mainFinding(base)).toBe('You kept going the whole minute.');
    const nine = { ...base, minute: { ...base.minute!, repeated: [{ word: 'really', count: 9 }] } as MinuteRecord };
    expect(mainFinding(nine)).toBe('You said “really” 9 times. Tomorrow, try a different word, or leave it out.');
    const five = { ...base, minute: { ...base.minute!, repeated: [{ word: 'really', count: 5 }] } as MinuteRecord };
    expect(mainFinding(five)).toBe('You kept going the whole minute.');
  });

  it('a slow start is the line when it cost the most (the saved line now has the first-word time)', () => {
    const late = summary(110, { from: 15_000 }); // first word at 15 s
    expect(mainFinding(session(late))).toBe('Start within 5 seconds: say the word back, then one thing it reminds you of.');
  });
});

describe('your usual', () => {
  const full = summary(130);
  const at = (id: string, flow: number) => session(full, { id, flow });

  it('counts down to a usual under 3 earlier talks', () => {
    const all = [at('a', 60), at('now', 70)];
    const u = usualFor(all[1], all);
    expect(usualText(u, false)).toEqual({ text: '2 more talks and you’ll see your usual.', good: false });
    expect(usualText(usualFor(all[0], all), false).text).toBe('3 more talks and you’ll see your usual.');
    const three = [at('a', 60), at('b', 60), at('now', 70)];
    expect(usualText(usualFor(three[2], three), false).text).toBe('1 more talk and you’ll see your usual.');
  });

  it('up: "↑ 6 on your usual 72"; a best says so; down or same is quiet, never a down arrow', () => {
    const up = [at('a', 72), at('b', 70), at('c', 80), at('now', 78)];
    expect(usualText(usualFor(up[3], up), false)).toEqual({ text: '↑ 6 on your usual 72', good: true });
    const best = [at('a', 72), at('b', 70), at('c', 74), at('now', 90)];
    expect(usualText(usualFor(best[3], best), false)).toEqual({ text: '↑ Your best so far', good: true });
    const down = [at('a', 72), at('b', 70), at('c', 74), at('now', 50)];
    expect(usualText(usualFor(down[3], down), false)).toEqual({ text: 'Your usual is 72', good: false });
  });

  it('stopped early: just "Your usual is 64", even if it went up', () => {
    const all = [at('a', 64), at('b', 60), at('c', 70), at('now', 80)];
    expect(usualText(usualFor(all[3], all), true)).toEqual({ text: 'Your usual is 64', good: false });
  });
});

describe('vocabulary variety: weekly, never per talk', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = 1_000_000_000_000;
  const rec = (id: string, at: number, words = 100, limit: 30 | 60 = 60): SavedSession => {
    const m = summary(130);
    const s = session(m, { id, at }, limit);
    return { ...s, minute: { ...s.minute!, variety: { mattr: 0.82, windows: words - 49, words } } as MinuteRecord };
  };

  it('needs 3 talks and 250 words in the last 7 days', () => {
    expect(weeklyVariety([rec('a', now - DAY), rec('b', now)], now)).toBeUndefined();
    expect(weeklyVariety([rec('a', now - DAY, 80), rec('b', now - 2 * DAY, 80), rec('c', now, 80)], now)).toBeUndefined();
    expect(weeklyVariety([rec('a', now - DAY), rec('b', now - 2 * DAY), rec('c', now)], now)).toBe(41);
    expect(varietyText(41)).toBe('Different words this week: about 41 in every 50');
  });

  it('leaves out talks older than a week, after this one, and 30-second ones', () => {
    const old = [rec('a', now - 8 * DAY), rec('b', now - 2 * DAY), rec('c', now)];
    expect(weeklyVariety(old, now)).toBeUndefined();
    const later = [rec('a', now - DAY), rec('b', now), rec('c', now + DAY)];
    expect(weeklyVariety(later, now)).toBeUndefined();
    const short = [rec('a', now - DAY, 100, 30), rec('b', now - 2 * DAY), rec('c', now)];
    expect(weeklyVariety(short, now)).toBeUndefined();
  });
});

describe('the stop strip', () => {
  it('reads the stop number from the end of its id', () => {
    expect(stopNumber('sharp-6')).toBe(6);
    expect(stopNumber('clear.12')).toBe(12);
    expect(stopNumber('sharp-talk')).toBeUndefined();
    expect(stopNumber(undefined)).toBeUndefined();
  });

  it('"Stop 6 done · Stop 7 tomorrow: beat 78"; stopped early has no "beat"; no stop still moves on', () => {
    expect(stripText(6, 78, false)).toEqual({ done: 'Stop 6 done', next: 'Stop 7 tomorrow: beat 78' });
    expect(stripText(6, 55, true)).toEqual({ done: 'Stop 6 done', next: 'Stop 7 tomorrow' });
    expect(stripText(undefined, 78, false)).toEqual({ done: 'Today’s talk done', next: 'Tomorrow: beat 78' });
    expect(stripText(undefined, 55, true)).toEqual({ done: 'Today’s talk done', next: 'Talk again tomorrow' });
  });
});

describe('prompt synonyms and lookups', () => {
  const related: Record<string, string[]> = {
    p10: ['bike', 'cycle'],
    p03: ['mobile', 'smartphone', 'cellphone'],
    p05: ['coach'],
    p11: ['keyring'],
    p17: ['wait'],
    p21: ['nice', 'kind-hearted'],
    p22: ['liberty'],
    p23: ['routine'],
  };

  it('the eight prompts carry the agreed related words, and no others do', () => {
    for (const p of MINUTE_PROMPTS) expect(p.related ? [...p.related] : undefined).toEqual(related[p.id]);
    expect(promptById('p10')!.text).toBe('A bicycle');
  });

  it('a synonym of the topic is never a repeated word', () => {
    const words = 'i ride my bike to work and my bike is old but my bike is fast and i love my bike because the bike is light'.split(' ');
    const p = promptById('p10')!;
    const t = said(words.length, 1500, 450, words);
    const without = minuteSummary({ tokens: t.tokens, heardTimes: t.times, startedAt: 0, prompt: p.text })!;
    const withRelated = minuteSummary({ tokens: t.tokens, heardTimes: t.times, startedAt: 0, prompt: p.text, related: p.related })!;
    expect(without.repeated?.map((r) => r.word)).toContain('bike');
    expect(withRelated.repeated?.map((r) => r.word) ?? []).not.toContain('bike');
  });

  it('promptById is undefined for unknown ids; promptAfter walks the rotation and wraps', () => {
    expect(promptById('p99')).toBeUndefined();
    expect(promptById(undefined)).toBeUndefined();
    const p = promptById('p01')!;
    expect(promptAfter(p, 0)).toBe(p);
    expect(promptAfter(p, 1).id).not.toBe('p01');
    expect(promptAfter(p, MINUTE_PROMPTS.length)).toBe(p);
    expect(promptAfter(p, -1)).toBe(promptAfter(p, MINUTE_PROMPTS.length - 1));
  });

  it('tokenise keeps a hyphenated synonym usable', () => {
    expect(tokenise('kind-hearted').length).toBeGreaterThan(0);
  });
});
