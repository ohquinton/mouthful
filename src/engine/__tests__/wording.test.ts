// Topic talk wording (remodel step 3, docs/briefs/remodel-2026-11.md scorecard): repeated content
// words and vocabulary variety. Shown, never scored (DECISIONS 2026-11-01), so these tests check
// what is counted and that nothing is counted twice or blamed on the speaker unfairly.
//
// Fixtures are written the way a recogniser gives them: lower case, no punctuation. They are our
// own, not tester transcripts.

import { HABIT_PHRASES, HABIT_WORDS, tokenise } from '../align';
import { HABIT_PAIR_FORMS, HABIT_SINGLE_FORMS } from '../habits';
import { FLOW_VERSION, minuteSummary } from '../minute';
import { MINUTE_PROMPTS } from '../../content/prompts';
import {
  MIN_REPEATS,
  VARIETY_POOL_MIN_TALKS,
  VARIETY_POOL_MIN_WORDS,
  VARIETY_WINDOW,
  contentKey,
  movingTypeTokenRatio,
  pooledVariety,
  promptFamily,
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

/** Prompt "Your kitchen". Simple, correct, everyday words (near-fluent; not how most learners talk). */
const SIMPLE = tokenise(
  'my kitchen is small but i like it very much it has a big window so in the morning the sun comes in and it ' +
    'is very bright i cook there every day mostly rice and vegetables and sometimes chicken my mother taught me ' +
    'how to cook when i was young so now i can make many dishes from my country in the kitchen there is a table ' +
    'with two chairs and a small fridge i keep the kitchen clean because i do not like a dirty place when my ' +
    'friends visit we sit at the table and eat together and talk for a long time it is my favourite room in my home',
);

/**
 * Realistic learner speech, three topics (our own, modelled on common patterns: the same simple
 * verb again and again, "is" for "are", dropped articles and plurals, "my mother she"). One minute
 * at a learner's pace: 93–116 words.
 */
const LEARNER = tokenise(
  'my kitchen is not so big it is small kitchen but i like it in my kitchen i have one table and two chair and ' +
    'one fridge the fridge is old but it is working good i cook every day i cook rice and i cook vegetable and ' +
    'sometimes i cook chicken my mother she teach me to cook when i was young so now i can cook many food from my ' +
    'country in the morning i make tea and i drink the tea in the kitchen because the kitchen have a big window and ' +
    'it is very bright i like my kitchen very much because it is clean and i can cook what i want',
);
const LEARNER_RAIN = tokenise(
  'in my country rain is very strong in summer when the rain is coming the street is full of water and the bus is ' +
    "very slow i don't like it because my shoes is wet and my clothes is wet but my children they like the rain " +
    'very much they want to play outside in the rain and i say no no is too cold you will be sick after the rain ' +
    'the air is fresh and is nice to walk i think rain is good for the trees and for the farmers because they need ' +
    'the water for the rice',
);
const LEARNER_BUS = tokenise(
  'every day i go to work by bus the bus stop is near my house i wait for the bus five or ten minutes in the bus ' +
    'there is many people and sometimes i cannot sit so i stand the bus is slow because there is many car in the ' +
    'road but it is cheap and i can read my book or listen music in the bus when i go home in the evening the bus ' +
    'is very full and i am tired but i like to look the city from the window',
);

/** Prompt "Your kitchen". Fluent, varied: the same topic as LEARNER. */
const FLUENT_KITCHEN = tokenise(
  'our kitchen is the warmest room in the flat mostly because the oven never really gets a rest my partner bakes ' +
    'on sundays so the whole place smells of cinnamon and burnt sugar by noon the counters are a mess of flour jars ' +
    "and cookbooks we keep meaning to tidy and there's a radio on the windowsill that only picks up one station " +
    'which plays old jazz all afternoon i do most of the weekday cooking quick things like stir fries or a pot of ' +
    'lentil soup that lasts three days we eat at a narrow table pushed against the wall and when friends come over ' +
    'everyone ends up standing around the stove instead of sitting in the living room honestly i think that says ' +
    'something about what a kitchen is for',
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
    expect(repeatedWords(SIMPLE, { prompt: 'Your kitchen' })).toEqual([]);
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

  it('never counts number words: "two sisters, two brothers" is the story, not a word choice', () => {
    // normalise() writes a heard "2" as "two", so digits and spoken numbers both land here.
    const t = tokenise(
      'i have 2 sisters and two brothers we live in two houses three streets apart and we meet two times a week ' +
        'on two days for dinner with three dogs and three cats',
    );
    expect(repeatedWords(t)).toEqual([]);
  });

  it('never counts "well" (an opener or "as well"), but keeps vague words a sharper word could replace', () => {
    const base = 'we went to the new place near the station on friday and ';
    const well = tokenise(base + 'well the food was fine and the staff did well and the music was nice as well well i would go back and well that was it');
    expect(repeatedWords(well)).toEqual([]);
    // "good", "thing", "people", "really", "very": shown at 4 uses, as before.
    for (const w of ['good', 'thing', 'people', 'really', 'very']) {
      const t = tokenise(`${base}the ${w} part was the ${w} bit and then a ${w} moment came and the last ${w} one was late`);
      expect([w, repeatedWords(t)[0]?.word]).toEqual([w, w]);
    }
  });

  it('counts a name like any word (known limit: tokens are lower case, and a name list would be unfair)', () => {
    const t = tokenise(
      'my friend priya came over on sunday and priya brought a cake then priya and i walked to the lake and priya ' +
        'told me about her new job',
    );
    expect(repeatedWords(t)[0]).toMatchObject({ word: 'priya', count: 4 });
  });

  it('does not merge "news" into "new"', () => {
    const t = tokenise(
      'i watched the news on my new phone this morning the news said a new road will open soon near the new bridge ' +
        'by the river',
    );
    expect(contentKey('news')).not.toBe(contentKey('new'));
    expect(repeatedWords(t)).toEqual([]); // new ×3, news ×2: neither reaches 4
  });
});

describe('repeatedWords: a doubled phrase at a recogniser restart', () => {
  it('counts a phrase said twice in a row once (qa-critic market example)', () => {
    const doubled = tokenise(
      'on saturday we bought bread at the market we bought bread at the market and some cheese and then we walked ' +
        'home through the park and had lunch at the market cafe near the market square with friends',
    );
    expect(repeatedWords(doubled)).toEqual([]);
    // Both directions: "market" said a fourth time, not as a doubled phrase, is still flagged.
    const four = tokenise(
      'on saturday we bought bread at the market and some cheese at the market stall and then we walked home ' +
        'through the park and had lunch at the market cafe near the market square with friends',
    );
    expect(repeatedWords(four)[0]).toMatchObject({ word: 'market', count: 4 });
  });

  it('still counts a word the speaker says again later in the talk', () => {
    const base =
      'i really love the market in our town it is really the best place to shop the fish is really fresh and the ' +
      'people who work there are really kind';
    expect(repeatedWords(tokenise(base))[0]).toMatchObject({ word: 'really', count: 4 });
    // A seam doubling "the fish is really fresh" doesn't make it 5.
    const seam = base.replace('the fish is really fresh', 'the fish is really fresh the fish is really fresh');
    expect(repeatedWords(tokenise(seam))[0]).toMatchObject({ word: 'really', count: 4 });
  });

  it('compares runs as heard: "really busy, really really busy" is two uses, not one', () => {
    // Collapsing "really really" first would leave "really busy really busy", a false doubled phrase.
    const t = tokenise('it was really busy really really busy and then really loud and really hot at the party last night');
    expect(repeatedWords(t)[0]).toMatchObject({ word: 'really', count: 4 });
  });

  it('collapses runs of 2 to 8 words, not a longer stretch said again', () => {
    const run = (n: number) => Array.from({ length: n }, (_, k) => `w${String.fromCharCode(97 + k)}`).join(' ');
    const filler = 'and then we went home after that for a quiet evening with some tea';
    for (let n = 2; n <= 8; n++) {
      const once = vocabularyVariety(tokenise(`${filler} ${run(n)} ${filler} ${filler} ${filler}`))!;
      const twice = vocabularyVariety(tokenise(`${filler} ${run(n)} ${run(n)} ${filler} ${filler} ${filler}`))!;
      expect([n, twice.words]).toEqual([n, once.words]);
    }
    const nine = run(9);
    const once9 = vocabularyVariety(tokenise(`${filler} ${nine} ${filler} ${filler} ${filler}`))!;
    expect(vocabularyVariety(tokenise(`${filler} ${nine} ${nine} ${filler} ${filler} ${filler}`))!.words).toBe(once9.words + 9);
  });
});

describe('repeatedWords: the prompt’s word family', () => {
  // qa-critic's repros: each word is the prompt's own family, said 4 times. Staying on topic is the task.
  const CASES: [string, string, string][] = [
    ['Luck', 'lucky', 'i think luck is real i was lucky when i found my job i was lucky to meet my wife and i was lucky with my health but some people are not lucky at all and that is not fair'],
    ['Rain', 'raining', 'i love the sound when it is raining outside yesterday it was raining all day and the streets were wet when it is raining i stay home and read because raining days are slow and calm'],
    ['Patience', 'patient', 'my father is a very patient man he was patient with me when i learned to drive he is patient with my mother too and he says being patient is the best thing you can learn'],
    ['Success', 'successful', 'for me a successful life is a quiet one my brother is successful at work but he is tired a successful person sleeps well and a successful week ends with a free sunday afternoon'],
    ['The bus', 'buses', 'i take the bus every day there are many buses in my city the buses come every ten minutes but in the evening the buses are slow and crowded and sometimes two buses come together'],
  ];

  it.each(CASES)('never flags the family of "%s" ("%s")', (prompt, word, talk) => {
    const t = tokenise(talk);
    expect(repeatedWords(t, { prompt })).toEqual([]);
    // Both directions: without the prompt the same word is flagged, so the prompt is what stops it.
    expect(repeatedWords(t)[0]?.word).toBe(word);
  });

  it('folds "buses" with "bus" (and "houses" with "house")', () => {
    expect(contentKey('buses')).toBe(contentKey('bus'));
    expect(contentKey('houses')).toBe(contentKey('house'));
    expect(contentKey('gases')).toBe(contentKey('gas'));
    expect(contentKey('glasses')).toBe(contentKey('glass'));
    expect(contentKey('busy')).not.toBe(contentKey('bus'));
  });

  it('still flags a word that only looks close: busy for "The bus", truth for "Trust", lunch for "Luck"', () => {
    const near: [string, string][] = [['The bus', 'busy'], ['Trust', 'truth'], ['Luck', 'lunch'], ['Rain', 'train'], ['Patience', 'patio'], ['A new job', 'news']];
    for (const [prompt, word] of near) expect([prompt, word, promptFamily(prompt)(word)]).toEqual([prompt, word, false]);
    const busy = tokenise('the bus was busy and the station was busy and the road was busy so my day was busy from the start');
    expect(repeatedWords(busy, { prompt: 'The bus' })[0]).toMatchObject({ word: 'busy', count: 4 });
  });

  it('bans each prompt’s family, checked over all 36 prompts', () => {
    // Every content word of every prompt is in its own family (the rule can't miss the prompt itself)...
    for (const p of MINUTE_PROMPTS) {
      const fam = promptFamily(p.text);
      for (const t of tokenise(p.text)) if (contentKey(t)) expect([p.id, t, fam(t)]).toEqual([p.id, t, true]);
    }
    // ...and a sample of derived forms, one or more per level-1 and level-2 prompt.
    const forms: Record<string, string[]> = {
      Coffee: ['coffees'], Rain: ['rains', 'raining', 'rainy'], 'Your phone': ['phones', 'phoning'], Bread: ['breads'],
      'The bus': ['buses', 'bused'], Shoes: ['shoe', 'shoelace'], 'A window': ['windows', 'windowsill'],
      'Your kitchen': ['kitchens'], 'A clock': ['clocks', 'clockwise'], 'A bicycle': ['bicycles', 'bicycling'],
      Keys: ['key', 'keyed'], 'A river': ['rivers', 'riverbank'], Trust: ['trusted', 'trustworthy', 'distrust'],
      Time: ['times', 'timing', 'timer'], Risk: ['risky', 'risked'], Luck: ['lucky', 'luckily', 'unlucky'],
      Patience: ['patient', 'patiently', 'impatient'], Change: ['changing', 'changed', 'unchanged'],
      Home: ['homes', 'homework', 'homeless'], Success: ['successful', 'succeed', 'unsuccessful'],
      Kindness: ['kind', 'kindly', 'unkind'], Freedom: ['free', 'freely'], Habits: ['habit', 'habitual'],
      Silence: ['silent', 'silently'],
    };
    for (const [prompt, list] of Object.entries(forms)) {
      const fam = promptFamily(prompt);
      for (const w of list) expect([prompt, w, fam(w)]).toEqual([prompt, w, true]);
    }
    // Level 3: the family of the topic words, not just the words themselves.
    const fam31 = promptFamily('Give a short update on a project you’re working on.');
    for (const w of ['work', 'worked', 'projects', 'updated', 'giving']) expect([w, fam31(w)]).toEqual([w, true]);
  });

  it('adds related words from content to the family (bike for "A bicycle")', () => {
    const t = tokenise(
      'my first bicycle was a red bike from my uncle i rode the bike to school every day and later i bought a ' +
        'faster bike for the hills now my bike sits in the hall because i walk to work',
    );
    expect(repeatedWords(t, { prompt: 'A bicycle' })[0]).toMatchObject({ word: 'bike', count: 4 }); // known limit without a list
    expect(repeatedWords(t, { prompt: 'A bicycle', related: ['bike', 'cycle'] })).toEqual([]);
    expect(promptFamily('A bicycle', ['bike', 'cycle'])('cycling')).toBe(true);
    expect(promptFamily('A bicycle', ['bike', 'cycle'])('cyclist')).toBe(true);
  });
});

describe('repeatedWords and variety: habit words are never counted twice', () => {
  // Every form any counter reports: align.ts (Glide and Free talk habit line) and habits.ts (classifier).
  const ONE = [...new Set([...HABIT_WORDS, ...HABIT_SINGLE_FORMS])];
  const TWO = [...new Set([...HABIT_PHRASES, ...HABIT_PAIR_FORMS])];

  it('kinda, sorta and ya know (qa-critic) are left out', () => {
    const t = tokenise(
      'the film was kinda long and the story was kinda slow but the music was kinda nice and the ending was kinda ' +
        'sad so i was sorta happy and sorta tired and sorta bored ya know and sorta hungry ya know ya know at the ' +
        'end ya know of the night',
    );
    const words = repeatedWords(t).flatMap((r) => r.forms);
    for (const w of ['kinda', 'sorta', 'ya', 'know']) expect(words).not.toContain(w);
  });

  it.each([...ONE, ...TWO])('leaves out "%s" from repeated words and from variety', (form) => {
    const base = VARIED.slice(0, 80);
    const withForm = base.flatMap((w, k) => (k % 12 === 5 ? [...form.split(' '), w] : [w]));
    const words = repeatedWords(withForm).flatMap((r) => r.forms);
    for (const w of form.split(' ')) expect(words).not.toContain(w);
    expect(vocabularyVariety(withForm)!.mattr).toBe(vocabularyVariety(base)!.mattr);
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
    expect(varied.mattr).toBeGreaterThan(repeater.mattr);
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
    const per50 = (t: string[]) => vocabularyVariety(t)!.mattr * 50;
    expect(Math.abs(per50([...VARIED, ...VARIED_2]) - per50(VARIED))).toBeLessThanOrEqual(3);
  });

  it('reads realistic learner speech lower than fluent speech: a real difference, so never a per-talk verdict', () => {
    // Measured: fluent 43.6, simple and correct 39.5, realistic learner 33.0 different words in 50
    // (same topic, prompt family left out). The learner really does use fewer different words, and
    // pretending otherwise would make the number meaningless. So the engine gives no per-talk display
    // number to compare people with: only a pooled one, compared with the same person's earlier weeks.
    const opts = { prompt: 'Your kitchen' };
    const fluent = vocabularyVariety(FLUENT_KITCHEN, opts)!;
    const simple = vocabularyVariety(SIMPLE, opts)!;
    const learner = vocabularyVariety(LEARNER, opts)!;
    expect(fluent.mattr * 50 - learner.mattr * 50).toBeGreaterThan(8);
    expect(simple.mattr).toBeGreaterThan(learner.mattr);
    expect(fluent.mattr).toBeGreaterThan(simple.mattr);
    expect(learner).not.toHaveProperty('per50');
  });

  it('leaves the prompt’s family out of the windows: saying "bus" in a talk about the bus is on topic', () => {
    const on = vocabularyVariety(LEARNER_BUS, { prompt: 'The bus' })!;
    const off = vocabularyVariety(LEARNER_BUS)!;
    expect(on.words).toBe(off.words - 7); // "bus" ×7 left out
    expect(on.mattr).toBeGreaterThan(off.mattr);
  });

  it('leaves hesitations and habit words out, so "um" and "like" are never counted twice', () => {
    const clean = vocabularyVariety(VARIED)!;
    const withHabits = vocabularyVariety(
      VARIED.flatMap((w, k) => (k % 6 === 0 ? ['um', w] : k % 7 === 0 ? ['like', w] : k % 9 === 0 ? ['you', 'know', w] : [w])),
    )!;
    expect(withHabits.mattr).toBe(clean.mattr);
  });

  it('MATTR itself: all different words reads 1, two words taking turns reads 2 in 50', () => {
    const all = Array.from({ length: 60 }, (_, k) => `w${String.fromCharCode(97 + (k % 26))}${String.fromCharCode(97 + Math.floor(k / 26))}`);
    expect(movingTypeTokenRatio(all)).toBe(1);
    expect(movingTypeTokenRatio(Array.from({ length: 60 }, (_, k) => (k % 2 ? 'tea' : 'hot')))).toBeCloseTo(0.04, 10);
    // A talk's record also says how many windows it averaged: its weight in a pool.
    expect(vocabularyVariety(all)).toMatchObject({ mattr: 1, windows: 11, window: 50, words: 60 });
  });
});

describe('pooledVariety (the only variety number meant for a screen)', () => {
  const rec = (t: string[], prompt?: string) => vocabularyVariety(t, { prompt });

  it(`needs ${VARIETY_POOL_MIN_TALKS} talks and ${VARIETY_POOL_MIN_WORDS} words: no number rather than a noisy one`, () => {
    expect(pooledVariety([rec(VARIED), rec(VARIED_2)])).toBeUndefined(); // two talks
    expect(pooledVariety([rec(VARIED), rec(SHORT), rec(VARIED_2)])).toBeUndefined(); // the short one has no record
    expect(pooledVariety([rec(VARIED.slice(0, 60)), rec(VARIED.slice(60)), rec(VARIED_2.slice(0, 60))])).toBeUndefined(); // < 250 words
    const p = pooledVariety([rec(VARIED, 'Rain'), rec(VARIED_2, 'A bicycle'), rec(FLUENT_KITCHEN, 'Your kitchen')])!;
    expect(p).toMatchObject({ talks: 3 });
    expect(p.words).toBeGreaterThanOrEqual(VARIETY_POOL_MIN_WORDS);
  });

  it('averages every window of every talk, never a window across two talks', () => {
    const recs = [rec(VARIED)!, rec(VARIED_2)!, rec(FLUENT_KITCHEN)!];
    const windows = recs.reduce((a, r) => a + r.windows, 0);
    const expected = recs.reduce((a, r) => a + r.mattr * r.windows, 0) / windows;
    const p = pooledVariety(recs)!;
    expect(p.mattr).toBeCloseTo(expected, 3);
    expect(p.per50).toBe(Math.round(p.mattr * 50));
    expect(p.per50).toBeGreaterThan(0);
    expect(p.per50).toBeLessThanOrEqual(50);
  });

  it('a learner’s three topics pool into one steady number: comparable week to week, with nobody else', () => {
    // Learner: kitchen 33.0, rain 33.9, bus 33.4 → pooled 33. A slower speaker's three minutes qualify.
    const recs = [rec(LEARNER, 'Your kitchen')!, rec(LEARNER_RAIN, 'Rain')!, rec(LEARNER_BUS, 'The bus')!];
    const p = pooledVariety(recs)!;
    expect(p.talks).toBe(3);
    for (const r of recs) expect(Math.abs(r.mattr * 50 - p.mattr * 50)).toBeLessThanOrEqual(1);
  });

  it('is much steadier than one talk (why no per-talk number is shown)', () => {
    // One simulated speaker (seeded Zipf vocabulary of 1500 words), 160 talks of 70 words each.
    let seed = 11;
    const rand = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
    const weights = Array.from({ length: 1500 }, (_, k) => 1 / (k + 1));
    const total = weights.reduce((a, b) => a + b, 0);
    const draw = () => {
      let r = rand() * total;
      for (let k = 0; k < weights.length; k++) if ((r -= weights[k]) <= 0) return `w${k}`;
      return 'w0';
    };
    const talks = Array.from({ length: 160 }, () => vocabularyVariety(Array.from({ length: 70 }, draw))!);
    const spread = (xs: number[]) => {
      const s = [...xs].sort((a, b) => a - b);
      return s[Math.floor(s.length * 0.95)] - s[Math.floor(s.length * 0.05)];
    };
    const single = spread(talks.map((t) => t.mattr * 50));
    const pooled = spread(Array.from({ length: 40 }, (_, k) => pooledVariety(talks.slice(k * 4, k * 4 + 4))!.mattr * 50));
    expect(single).toBeGreaterThan(7); // one 70-word talk: a 5th–95th percentile spread of 7+ points
    expect(pooled).toBeLessThan(single / 1.6); // four talks pooled: well under two thirds of that
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
    expect(r.variety?.mattr).toBeGreaterThan(0);
    expect(r.variety?.windows).toBeGreaterThan(0);
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
