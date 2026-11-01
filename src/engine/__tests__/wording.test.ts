// Topic talk wording (remodel step 3, docs/briefs/remodel-2026-11.md scorecard): repeated content
// words and vocabulary variety. Shown, never scored (DECISIONS 2026-11-01), so these tests check
// what is counted and that nothing is counted twice or blamed on the speaker unfairly.
//
// Fixtures are written the way a recogniser gives them: lower case, no punctuation. They are our
// own, not tester transcripts.

import { tokenise } from '../align';
import { FLOW_VERSION, minuteSummary } from '../minute';
import {
  MIN_REPEATS,
  VARIETY_WINDOW,
  contentKey,
  movingTypeTokenRatio,
  repeatedWords,
  vocabularyVariety,
} from '../wording';

/** Leans on "really" (and "basically", which the habit-word line already reports). */
const REPEATER = tokenise(
  'so this weekend i went to the market with my sister and it was really busy really really busy basically ' +
    'everyone in town was there and the food was really good we had these really nice dumplings and basically we ' +
    'just walked around for hours the weather was really warm which was really nice because last week it was ' +
    'basically raining the whole time my sister bought some flowers and i got a really cheap jacket that i really ' +
    'like and then we went home and basically just relaxed for the rest of the day it was really a good day ' +
    'honestly i really want to go back next weekend',
);

/** Prompt "Rain". Varied, fluent. */
const VARIED = tokenise(
  "rain always makes me think of my grandmother's garden she grew tomatoes beans and tall sunflowers along the " +
    'fence and whenever a storm rolled in she would sit on the porch with a cup of tea and watch the clouds move ' +
    'over the hills i used to complain because rain meant no football but she taught me to listen to it the ' +
    'drumming on the tin roof the gutters overflowing the smell of wet soil afterwards now when it rains in the ' +
    'city i notice how differently people behave some rush for shelter others open umbrellas and keep walking and ' +
    'a few just stand there getting soaked as if they had forgotten what weather feels like',
);

/** A second varied talk (prompt "A bicycle"), to make a longer talk out of two. */
const VARIED_2 = tokenise(
  'my first bicycle was a heavy red thing with a bent bell and tyres that went flat every other week my uncle ' +
    'showed me how to patch an inner tube using soapy water to find the leak and since then i have fixed dozens ' +
    'of punctures for friends these days i ride a second hand road bike to the office it saves money keeps me ' +
    'fit and honestly clears my head before meetings the worst part is winter when the paths turn to slush and ' +
    'drivers forget that cyclists exist',
);

/** Prompt "Coffee": says "coffee" (and "coffees") eight times, as anyone would. */
const COFFEE = tokenise(
  'i drink coffee every morning before work i make the coffee at home with a small machine my brother gave me ' +
    'the coffee there is strong and dark i like it black with no sugar at work the coffee is terrible so i bring ' +
    'my own in a flask some people drink three or four coffees a day but for me two cups is enough if i have ' +
    'coffee after lunch i cannot sleep at night my favourite coffee shop is near the station they roast their ' +
    'own beans and the coffee smells amazing when you walk past',
);

/** Prompt "Your kitchen". ESL style: simple, correct, everyday words. */
const ESL = tokenise(
  'my kitchen is small but i like it very much it has a big window so in the morning the sun comes in and it ' +
    'is very bright i cook there every day mostly rice and vegetables and sometimes chicken my mother taught me ' +
    'how to cook when i was young so now i can make many dishes from my country in the kitchen there is a table ' +
    'with two chairs and a small fridge i keep the kitchen clean because i do not like a dirty place when my ' +
    'friends visit we sit at the table and eat together and talk for a long time it is my favourite room in my home',
);

/** Under 15 words. */
const SHORT = tokenise('coffee is nice i drink it every morning with milk');

const BAD_WORDS = /pronounc|accent|correct|grade|wrong|poor|bad/i;

describe('repeatedWords', () => {
  it('finds the content word a speaker leans on and says how many times', () => {
    const r = repeatedWords(REPEATER);
    expect(r[0]).toMatchObject({ word: 'really', count: 10 });
    // Only "really" is clearly over-used; "sister", "weekend", "day" (2 each) are ordinary.
    expect(r.map((x) => x.word)).toEqual(['really']);
  });

  it('counts "really really" once, so a restart seam that doubles a word never adds to the count', () => {
    const once = repeatedWords(tokenise('it was really busy really busy really busy really busy and loud and hot today there'));
    const doubled = repeatedWords(tokenise('it was really really busy really busy really busy really busy and loud and hot today there'));
    expect(doubled.find((x) => x.word === 'really')?.count).toBe(once.find((x) => x.word === 'really')?.count);
  });

  it('never counts habit words or hesitations, which the habit line and the um count already report', () => {
    expect(repeatedWords(REPEATER).some((x) => x.word === 'basically')).toBe(false);
    const habity = tokenise(
      'like i was like you know at the shop and um like you know they had um you know the thing and like ' +
        'uh you know i mean i was kind of tired and kind of hungry and kind of done um like you know',
    );
    const words = repeatedWords(habity).map((x) => x.word);
    for (const w of ['like', 'know', 'you', 'mean', 'kind', 'um', 'uh']) expect(words).not.toContain(w);
  });

  it('never flags stop words, however often they come', () => {
    const t = tokenise(
      'the dog and the cat and the bird and the fish were in the house and the garden and the shed and the car ' +
        'and they were all there with them in it for the day',
    );
    expect(repeatedWords(t)).toEqual([]);
  });

  it('does not flag the topic word: talking about coffee means saying "coffee"', () => {
    expect(repeatedWords(COFFEE, { prompt: 'Coffee' })).toEqual([]);
    // Both directions: without the prompt the same talk does flag it, so the prompt is what stops it.
    expect(repeatedWords(COFFEE)[0]).toMatchObject({ word: 'coffee', count: 8 });
  });

  it('leaves out every content word of a longer prompt', () => {
    const t = tokenise(
      'my project is a new website for a bakery the project started in march and the project team is three people ' +
        'we meet every monday to review the project and plan the week the project is going well',
    );
    expect(repeatedWords(t, { prompt: 'Give a short update on a project you’re working on.' })).toEqual([]);
    expect(repeatedWords(t)[0]?.word).toBe('project');
  });

  it('counts "thing" and "things" as one word and keeps the forms heard', () => {
    const t = tokenise(
      'there are things i like about the city one thing is the parks another thing is the food and the last ' +
        'thing is the people there are so many things to do on a weekend in summer',
    );
    const r = repeatedWords(t);
    expect(r[0]).toMatchObject({ word: 'thing', count: 5 });
    expect(r[0].forms.sort()).toEqual(['thing', 'things']);
  });

  it('does not flag a talk that repeats nothing much', () => {
    expect(repeatedWords(VARIED, { prompt: 'Rain' })).toEqual([]);
    expect(repeatedWords(ESL, { prompt: 'Your kitchen' })).toEqual([]);
  });

  it(`needs at least ${MIN_REPEATS} uses: 3 is ordinary, 4 is flagged`, () => {
    const base =
      'we drove up the coast on saturday and stopped at a small fishing village for lunch the harbour was full ' +
      'of boats and the market sold fresh crab and smoked salmon ';
    const three = tokenise(base + 'it was lovely the view was lovely and the walk back was lovely too');
    const four = tokenise(base + 'it was lovely the view was lovely the food was lovely and the walk back was lovely too');
    expect(repeatedWords(three)).toEqual([]);
    expect(repeatedWords(four)[0]).toMatchObject({ word: 'lovely', count: 4 });
  });

  it('asks more of a long talk: 4 uses in a long talk is not over-use', () => {
    // Three varied talks back to back (~200 content words) with "lovely" said 4 times.
    const lovely = tokenise('it was lovely the view was lovely the walk was lovely and the day was lovely');
    const long = [...VARIED, ...VARIED_2, ...lovely, ...COFFEE];
    expect(repeatedWords([...VARIED_2, ...lovely])[0]).toMatchObject({ word: 'lovely', count: 4 }); // flagged when short
    expect(repeatedWords(long, { prompt: 'Coffee' }).some((x) => x.word === 'lovely')).toBe(false);
  });

  it('returns at most three, most used first', () => {
    const t = tokenise(
      'good food good music good people great view great weather great price nice room nice staff nice pool ' +
        'cool bar cool club cool beach good wine great beer nice coffee cool tea good bread great cheese nice ' +
        'fruit cool juice',
    );
    const r = repeatedWords(t);
    expect(r.length).toBe(3);
    for (let k = 1; k < r.length; k++) expect(r[k - 1].count).toBeGreaterThanOrEqual(r[k].count);
  });

  it('returns nothing for a talk under 15 words', () => {
    expect(repeatedWords(SHORT)).toEqual([]);
    expect(repeatedWords(tokenise('really really nice really good really fun really great really'))).toEqual([]);
  });

  it('ignores digits, symbols and single letters the recogniser may write', () => {
    const t = tokenise('k p i k p i k p i 2026 2026 2026 2026 $40 $40 $40 $40 the report is late and we need to send it soon');
    expect(repeatedWords(t)).toEqual([]);
  });
});

describe('contentKey', () => {
  it('folds simple plurals and possessives, and drops function words', () => {
    expect(contentKey('things')).toBe('thing');
    expect(contentKey('stories')).toBe('story');
    expect(contentKey('boxes')).toBe('box');
    expect(contentKey('dishes')).toBe('dish');
    expect(contentKey("grandmother's")).toBe('grandmother');
    expect(contentKey('glass')).toBe('glass');
    expect(contentKey('bus')).toBe('bus');
    expect(contentKey('the')).toBeNull();
    expect(contentKey("don't")).toBeNull();
    expect(contentKey('um')).toBeNull();
    expect(contentKey('basically')).toBeNull();
    expect(contentKey('2026')).toBeNull();
  });
});

describe('vocabularyVariety (MATTR)', () => {
  it('needs a full window of words; shorter talks get nothing rather than a shaky number', () => {
    expect(vocabularyVariety(SHORT)).toBeUndefined();
    expect(vocabularyVariety(VARIED.slice(0, VARIETY_WINDOW - 1))).toBeUndefined();
    expect(vocabularyVariety(VARIED.slice(0, VARIETY_WINDOW + 10))).toBeDefined();
  });

  it('is higher for a varied talk than for one that leans on the same words', () => {
    const varied = vocabularyVariety(VARIED)!;
    const repeater = vocabularyVariety(REPEATER)!;
    expect(varied.per50).toBeGreaterThan(repeater.per50);
  });

  it('is not biased by talk length the way a plain type-token ratio is', () => {
    // The same speaker (one Zipf-shaped vocabulary of 400 words, seeded) talking for 80 words and
    // for 240: only the length differs, so any change is length bias.
    let seed = 7;
    const rand = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
    const vocab = Array.from({ length: 400 }, (_, k) => `w${k}`);
    const weights = vocab.map((_, k) => 1 / (k + 1));
    const total = weights.reduce((a, b) => a + b, 0);
    const draw = () => {
      let r = rand() * total;
      for (let k = 0; k < vocab.length; k++) if ((r -= weights[k]) <= 0) return vocab[k];
      return vocab[vocab.length - 1];
    };
    const talk = Array.from({ length: 240 }, draw);
    const short = talk.slice(0, 80);
    const ttr = (t: string[]) => new Set(t).size / t.length;
    expect(ttr(short) - ttr(talk)).toBeGreaterThan(0.1); // plain TTR falls just because the talk got longer
    expect(Math.abs(movingTypeTokenRatio(short) - movingTypeTokenRatio(talk))).toBeLessThan(0.04); // MATTR barely moves
  });

  it('a longer talk in the same style reads about the same', () => {
    // Real fixtures: the rain talk alone, and the rain talk followed by the bicycle talk. Both are
    // varied, so the number stays within a couple of points (it may rise: the second talk is more varied).
    expect(Math.abs(vocabularyVariety([...VARIED, ...VARIED_2])!.per50 - vocabularyVariety(VARIED)!.per50)).toBeLessThanOrEqual(3);
  });

  it('does not punish an ESL speaker for simple, correct vocabulary', () => {
    const esl = vocabularyVariety(ESL)!;
    const varied = vocabularyVariety(VARIED)!;
    // Simple words are not repeated words: within a few points of a fluent, varied talk.
    expect(varied.per50 - esl.per50).toBeLessThanOrEqual(6);
    // And clearly above a talk that leans on one word.
    expect(esl.per50).toBeGreaterThan(vocabularyVariety(REPEATER)!.per50);
  });

  it('leaves hesitations and habit words out, so "um" and "like" are never counted twice', () => {
    const clean = vocabularyVariety(VARIED)!;
    const withHabits = vocabularyVariety(
      VARIED.flatMap((w, k) => (k % 6 === 0 ? ['um', w] : k % 7 === 0 ? ['like', w] : k % 9 === 0 ? ['you', 'know', w] : [w])),
    )!;
    expect(withHabits.mattr).toBe(clean.mattr);
  });

  it('is a plain number the screen can explain: different words in each 50 in a row', () => {
    const v = vocabularyVariety(VARIED)!;
    expect(v.window).toBe(50);
    expect(v.per50).toBe(Math.round(v.mattr * 50));
    expect(v.per50).toBeGreaterThan(0);
    expect(v.per50).toBeLessThanOrEqual(50);
  });

  it('a talk of all different words reads 50 of 50, one word over and over reads 1', () => {
    const all = Array.from({ length: 60 }, (_, k) => `w${String.fromCharCode(97 + (k % 26))}${String.fromCharCode(97 + Math.floor(k / 26))}`);
    expect(vocabularyVariety(all)!.per50).toBe(50);
    expect(vocabularyVariety(Array.from({ length: 60 }, (_, k) => (k % 2 ? 'tea' : 'hot')))!.per50).toBe(2);
  });
});

describe('precise words', () => {
  // A tiny everyday list for the test only. The app ships no list yet (see wording.ts).
  const COMMON = new Set(
    ('rain always make makes me think grandmother garden she grow grew tomato tomatoes bean beans tall along ' +
      'whenever storm roll rolled sit cup tea watch cloud clouds move over hill hills use used complain mean meant ' +
      'football taught teach listen roof smell wet soil now city notice people some rush others open keep walking ' +
      'walk few stand getting get forgotten forget weather feels feel').split(' '),
  );

  it('counts content words that are not on the everyday list, once each', () => {
    const v = vocabularyVariety(VARIED, { common: COMMON, prompt: 'Rain' })!;
    expect(v.precise).toBeDefined();
    expect(v.precise!.words).toEqual(expect.arrayContaining(['sunflowers', 'porch', 'umbrellas', 'shelter']));
    expect(v.precise!.count).toBe(v.precise!.words.length);
    expect(new Set(v.precise!.words).size).toBe(v.precise!.words.length);
  });

  it('never counts the prompt word as precise', () => {
    const v = vocabularyVariety(VARIED, { common: new Set(), prompt: 'Rain' })!;
    expect(v.precise!.words).not.toContain('rain');
    expect(v.precise!.words).not.toContain('rains');
  });

  it('is left out, not guessed, when no everyday word list is given', () => {
    expect(vocabularyVariety(VARIED)!.precise).toBeUndefined();
  });
});

describe('minuteSummary: repeated words and variety (shown, not scored)', () => {
  const even = (n: number, from: number, to: number) =>
    Array.from({ length: n }, (_, k) => Math.round((from + ((to - from) * k) / Math.max(1, n - 1)) * 1000));
  const run = (tokens: string[], prompt?: string) => minuteSummary({ tokens, heardTimes: even(tokens.length, 1, 60), startedAt: 0, prompt });

  it('adds repeated words and variety to the summary', () => {
    const r = run(REPEATER)!;
    expect(r.repeated?.[0]).toMatchObject({ word: 'really', count: 10 });
    expect(r.variety?.per50).toBeGreaterThan(0);
  });

  it('uses the prompt so the topic word is not flagged', () => {
    expect(run(COFFEE, 'Coffee')!.repeated).toEqual([]);
  });

  it('leaves Flow and its version exactly as before', () => {
    const tokens = REPEATER;
    const withPrompt = run(tokens, 'The weekend')!;
    const without = minuteSummary({ tokens, heardTimes: even(tokens.length, 1, 60), startedAt: 0 })!;
    expect(withPrompt.flow).toBe(without.flow);
    expect(withPrompt.flowVersion).toBe(FLOW_VERSION);
    expect(withPrompt.parts.map((p) => p.slot)).toEqual(['keptGoing', 'pauses', 'pace', 'um', 'habit']);
    // A talk that repeats a lot and one that doesn't, with the same timing, get the same Flow.
    const n = Math.min(REPEATER.length, VARIED.length);
    const same = (t: string[]) => minuteSummary({ tokens: t.slice(0, n), heardTimes: even(n, 1, 60), startedAt: 0 })!;
    expect(same(VARIED).flow).toBe(same(REPEATER).flow);
  });

  it('a saved minute from before this change (no repeated, no variety) still type-checks and reads', () => {
    const old = run(VARIED)!;
    const { repeated: _r, variety: _v, ...rest } = old;
    const loaded: typeof old = rest; // optional fields: an old summary is still a MinuteSummary
    expect(loaded.repeated).toBeUndefined();
    expect(loaded.variety).toBeUndefined();
  });

  it('says nothing that grades the person', () => {
    const r = run(REPEATER)!;
    expect(JSON.stringify(r.repeated)).not.toMatch(BAD_WORDS);
    expect(r.line).not.toMatch(/really|variety|repeat/i); // the coaching line is unchanged
  });
});
