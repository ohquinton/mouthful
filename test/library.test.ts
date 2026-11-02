// The Library tab (src/app/(tabs)/library.tsx): topic talks by level with your best Flow on each,
// word packs tinted by the line that uses them, the shelf rows' copy, and the cold read's pick.
// The helpers are src/components/library/libraryData.ts.
import { FLOW_VERSION } from '../src/engine/minute';
import { MINUTE_PROMPTS } from '../src/content/prompts';
import { PASSAGES } from '../src/content/passages';
import { WORD_PACKS } from '../src/content/wordpacks';
import { versionFor } from '../src/store/minute';
import type { SavedSession } from '../src/store/sessions';
import type { WordBook } from '../src/engine/vocab';
import {
  coldReadPick,
  defaultLevel,
  packDone,
  packLine,
  packMeta,
  scriptsMeta,
  topicLabel,
  topicMeta,
  topicRecords,
  topicRoute,
  topicsAt,
  TOPIC_LEVELS,
  triedText,
  wordsMeta,
} from '../src/components/library/libraryData';

let n = 0;
function minute(promptId: string, flow: number, extra: Partial<SavedSession> = {}): SavedSession {
  n++;
  return {
    id: `m${n}`,
    passageId: 'talk',
    title: 'Topic talk',
    at: 1_700_000_000_000 + n * 86_400_000,
    wpm: 140,
    fillers: 0,
    fillersPerMin: 0,
    accuracy: null,
    pauses: 0,
    seconds: 60,
    score: 0,
    stumbled: [],
    kind: 'minute',
    flow,
    flowVersion: FLOW_VERSION,
    promptId,
    ...extra,
  };
}

describe('topic levels', () => {
  it('covers all 36 prompts, 12 per level, in three named groups', () => {
    expect(TOPIC_LEVELS.map((l) => l.name)).toEqual(['Everyday', 'Ideas', 'Bigger topics']);
    const all = TOPIC_LEVELS.flatMap((l) => topicsAt(l.level));
    expect(all).toHaveLength(MINUTE_PROMPTS.length);
    expect(new Set(all.map((p) => p.id)).size).toBe(36);
    for (const l of TOPIC_LEVELS) expect(topicsAt(l.level)).toHaveLength(12);
  });

  it('opens on Everyday for Clear English and on Ideas for Sharp Talk (and before a line is picked)', () => {
    expect(defaultLevel('clear')).toBe(1);
    expect(defaultLevel('sharp')).toBe(2);
    expect(defaultLevel(undefined)).toBe(2);
  });

  it('opens a full, free minute with no stop, from the library', () => {
    expect(topicRoute('p13')).toEqual({ pathname: '/talk', params: { prompt: 'p13', seconds: '60', from: 'library' } });
  });
});

describe('best Flow per topic', () => {
  it('keeps the best Flow and counts the talks on each topic', () => {
    const r = topicRecords([minute('p01', 60), minute('p01', 74), minute('p01', 70), minute('p13', 55)]);
    expect(r.get('p01')).toEqual({ best: 74, talks: 3 });
    expect(r.get('p13')).toEqual({ best: 55, talks: 1 });
    expect(r.has('p02')).toBe(false);
  });

  it('leaves out 30-second talks, other Flow versions, and anything that is not a scored minute', () => {
    const r = topicRecords([
      minute('p01', 90, { minute: { limitSeconds: 30 } as unknown as SavedSession['minute'] }), // onboarding's first talk, by its record
      minute('p01', 91, { flowVersion: versionFor(30) }), // ... or by its version alone
      minute('p01', 92, { flowVersion: '1' }), // an older Flow formula
      minute('p01', 93, { flow: undefined }), // no Flow
      minute('p01', 94, { kind: undefined }), // not a minute
      minute('p01', 95, { promptId: undefined }), // no topic
      minute('p01', 40),
    ]);
    expect(r.get('p01')).toEqual({ best: 40, talks: 1 });
  });

  it('is empty with no sessions (the empty state)', () => {
    expect(topicRecords([]).size).toBe(0);
  });

  it('says what a tile shows and what VoiceOver reads, with plurals', () => {
    const coffee = MINUTE_PROMPTS[0];
    expect(topicMeta(undefined)).toBe('1 min');
    expect(topicMeta({ best: 76, talks: 2 })).toBe('Best 76');
    expect(topicLabel(coffee, undefined)).toBe('Coffee One minute topic talk. Not tried yet.');
    expect(topicLabel(coffee, { best: 76, talks: 1 })).toContain('from 1 talk.');
    expect(topicLabel(coffee, { best: 76, talks: 2 })).toContain('from 2 talks.');
  });

  it('counts the topics tried at a level', () => {
    const r = topicRecords([minute('p01', 60), minute('p02', 60), minute('p13', 60)]);
    expect(triedText(1, r)).toBe('2 of 12 tried');
    expect(triedText(2, r)).toBe('1 of 12 tried');
    expect(triedText(3, r)).toBe('12 topics');
  });
});

describe('word packs', () => {
  it('tints a pack with the line that uses it, your own line first', () => {
    // Make your point is a lesson on both lines.
    expect(packLine('precision', 'sharp')).toBe('sharp');
    expect(packLine('precision', 'clear')).toBe('clear');
    // Run the Meeting is only on Clear English (drill and Glide passages).
    expect(packLine('meetings', 'sharp')).toBe('clear');
    expect(packLine('meetings', 'clear')).toBe('clear');
    // Raise and tech are Sharp Talk stops.
    expect(packLine('raise', 'clear')).toBe('sharp');
    expect(packLine('tech', 'clear')).toBe('sharp');
  });

  it('leaves a pack no line uses untinted', () => {
    const used = new Set(['precision', 'meetings', 'raise', 'tech']);
    for (const p of WORD_PACKS.filter((x) => !used.has(x.id))) expect(packLine(p.id, 'sharp')).toBeUndefined();
    expect(packLine('nope', 'sharp')).toBeUndefined();
  });

  it('counts comfortable words, case-insensitively, and says it with plurals', () => {
    const pack = { words: [{ word: 'Nuance' }, { word: 'concise' }, { word: 'candid' }] } as Parameters<typeof packDone>[0];
    const entry = (word: string, clean: number) => ({ word, heardDays: [], cleanDays: Array.from({ length: clean }, (_, i) => `2026-10-0${i + 1}`), stumbles: 0, firstSeen: 0, lastSeen: 0 });
    const book: WordBook = { nuance: entry('nuance', 3), concise: entry('concise', 1) };
    expect(packDone(pack, book)).toBe(1);
    expect(packDone(pack, {})).toBe(0);
    expect(packMeta(0, 8)).toBe('8 words');
    expect(packMeta(0, 1)).toBe('1 word');
    expect(packMeta(3, 8)).toBe('3 of 8 comfortable');
  });
});

describe('shelf rows', () => {
  it('your words: loading, empty, then counts', () => {
    expect(wordsMeta(false, 0, 0)).toBe('Loading your words…');
    expect(wordsMeta(true, 0, 0)).toBe('Words you practise or trip on collect here.');
    expect(wordsMeta(true, 4, 1)).toBe('4 learning · 1 comfortable');
  });

  it('your scripts: says the first one is free only to a free reader, with plurals', () => {
    expect(scriptsMeta(false, 0, false)).toBe('Loading your scripts…');
    expect(scriptsMeta(true, 0, false)).toContain('The first one is free.');
    expect(scriptsMeta(true, 0, true)).not.toContain('free');
    expect(scriptsMeta(true, 1, false)).toBe('1 script');
    expect(scriptsMeta(true, 3, true)).toBe('3 scripts');
  });
});

describe('cold read pick', () => {
  const at = (passageId: string, day: number) => ({ passageId, at: day * 86_400_000 });

  it('picks the first passage never read', () => {
    expect(coldReadPick(PASSAGES, [])?.id).toBe(PASSAGES[0].id);
    expect(coldReadPick(PASSAGES, [at(PASSAGES[0].id, 5), at('talk', 6)])?.id).toBe(PASSAGES[1].id);
  });

  it('once all are read, picks the one read longest ago (by its latest read)', () => {
    const sessions = PASSAGES.map((p, i) => at(p.id, 10 + i));
    sessions.push(at(PASSAGES[0].id, 99)); // read the first again recently
    expect(coldReadPick(PASSAGES, sessions)?.id).toBe(PASSAGES[1].id);
  });

  it('is undefined with nothing on the shelf', () => {
    expect(coldReadPick([], [])).toBeUndefined();
  });
});
