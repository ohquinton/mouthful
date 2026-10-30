// Habit-word classifier: is this "like" / "so" / "you know" a filler, a real word, or can't we tell?
//
// Pure, no dependencies, no network. Explicit rules only, so every label can be explained with a
// short reason code. Standalone for now (DECISIONS.md 2026-10-29): align.ts still reports habit
// words without scoring them, and nothing here reaches the score until the corpus and the beta
// hand tally agree that "filler" is right at least ~90% of the time.
//
// Precision over recall. Only 'filler' would ever count against someone, so every rule that says
// 'filler' must be near-certain from the words alone. When signals are thin or disagree the
// answer is 'unsure', which is shown (if at all) but never scored. A grammatical use (a verb, a
// comparison, a degree word, a tag question, a hedge, a quotative) is never pushed to 'filler' by
// a burst or a pause.
//
// How a label is reached, per occurrence:
//   1. Context rules for that word (left and right neighbours, hesitations skipped where noted)
//      give 'real', 'filler' or 'unsure' plus a reason. Rules run in order; the first that fires wins.
//   2. An 'unsure' label can be promoted to 'filler' by weak cues, if its reason allows those cues:
//        burst       2   3+ non-real uses of the same habit word within 15 tokens
//        pause       1   gap > pauseMs on the side(s) the reason listens to; both sides if it listens
//                        to both. Only when the times look like audio timestamps. Never enough alone.
//        stackHes    1   an um / uh right next to it
//        rule hint   1   the context rule itself leans filler (e.g. "like" before an adjective);
//                        doesn't combine with stackHes (an um there is often a stall before a verb)
//      Rules read the transcript with um/uh removed, so a hesitation never decides a label by
//      itself: align.ts already counts it as the filler.
//      Promotion needs 2 points. Discourse openers ("so", "actually" starting a clause) and tags
//      only listen to bursts, because a pause after a discourse word is normal speech, and opening
//      with "actually" is ordinary in Indian English. Some reasons are locked: never promoted.
//
// Tokens come from tokenise() in align.ts (lowercase, apostrophes kept: "it's", "i'd"). Times are
// optional and may be bursty (server recognition delivers words in batches): they are only used
// when they look like real audio timestamps, and bursts are counted in tokens, not seconds, so
// on-device and server readers are judged the same way.

export type HabitWord =
  | 'like'
  | 'so'
  | 'you know'
  | 'actually'
  | 'basically'
  | 'literally'
  | 'i mean'
  | 'kind of'
  | 'sort of'
  | 'right';

export type HabitLabel = 'filler' | 'real' | 'unsure';

/** A recogniser word: a bare token from tokenise(), or one with audio times in ms. */
export type HeardToken = string | { word: string; start?: number; end?: number };

export type HabitResult = {
  index: number; // token index of the (first) word
  span: 1 | 2; // tokens covered: 2 for "you know", "i mean", "kind of", "sort of"
  word: HabitWord;
  label: HabitLabel;
  reason: string; // short code, safe for analytics allowlists
};

export type HabitOptions = {
  /** A gap longer than this around a word counts as a pause. Default 350. */
  pauseMs?: number;
  /** Token window for a burst. Default 15. */
  burstWindow?: number;
  /** Non-real uses of one word inside the window that make a burst. Default 3. */
  burstMin?: number;
  /** 'auto' (default) uses times only when they look like audio timestamps; 'ignore' never does. */
  times?: 'auto' | 'ignore';
};

// ---------------------------------------------------------------------------------------------
// Word lists. Kept small and explicit; each list says what it's for.

const set = (s: string) => new Set(s.split(/\s+/).filter(Boolean));

/** Same list as align.ts HESITATIONS (unify at integration). */
const HES = set('um umm uh uhh uhm erm er ah hmm mm');
const HABIT_PAIRS = set('you|know i|mean kind|of sort|of');

const BE = set(
  "is was were are am be been being it's that's he's she's there's what's here's who's i'm we're they're you're isn't wasn't weren't aren't",
);
/** Subjects that make the next "like" a verb: "i like", "they like", "people like". */
const SUBJ = set('i you we they he she who people everyone everybody nobody somebody someone anyone anybody ya y\'all');
/** Words before "like" that make it a verb: modals, do-support, "to", adverbs between subject and verb. */
const VERB_LEFT = set(
  "would could should might will may must do does did don't doesn't didn't won't wouldn't can can't i'd we'd you'd they'd he'd she'd i'll we'll you'll they'll to really also still always genuinely truly very quite never both all particularly especially definitely",
);
/** Words before "like" that make it a comparison or "such as". */
const COMPARE_LEFT = set(
  'look looks looked looking sound sounds sounded sounding feel feels felt feeling seem seems seemed smell smells smelled taste tastes tasted something anything nothing everything more less much just exactly not act acts acted acting behave behaved treat treated dressed someone somebody anyone people things stuff ones places companies tools apps cities countries teams products words skills languages',
);
/** "like I said" style: like = as. */
const AS_RIGHT2 = set(
  'said mentioned told explained discussed agreed promised planned expected thought noted asked showed wrote say mention suggested',
);
const CLAUSE_SUBJ = set(
  "i we they he she you it there i'm we're they're it's there's he's she's you're that's i've we've they've i'd we'd i'll we'll they'll",
);
/** Subjects (or be-contractions) that make "was like" a possible quotative. */
const PERSON = set("i he she we they you i'm he's she's we're they're you're");
const DET = set('a an the');
const DEMO = set('this that these those');
const CONJ = set('and but or because cause cuz plus then');
const PAST = set(
  'went said was were got had came told made took saw thought knew felt did left ran sat stood kept found gave brought began spent ended started decided asked called looked walked turned tried realised realized stopped finished freaked showed changed moved',
);
const INTENS = set(
  'really totally so super very literally actually just completely absolutely extremely honestly basically pretty insanely crazy',
);
const ADJ = set(
  'good bad great huge big small tiny hard easy fast slow crazy insane amazing awesome terrible awful weird nice cool fine late early long short high low busy tired stressed scared nervous excited happy sad angry upset worried ready sure wrong done full empty expensive cheap free simple complex complicated difficult important perfect clear quiet loud hot cold wild massive intense boring fun funny strange rough tough messy chaotic packed broken stuck lost confused close far quick heavy serious better worse bigger faster slower harder easier cheaper longer higher lower smaller older newer best worst bigger crowded stressful frustrating annoying exhausting overwhelming confusing embarrassing exciting interesting surprising shocking unreal awkward random brutal chill dead mad glad sorry proud',
);
const NUM = set(
  'one two three four five six seven eight nine ten eleven twelve fifteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million billion half dozen few couple',
);

/** Words ending in -s that aren't plural nouns. */
const PLURAL_NOT = set('this does always says goes gets takes makes was has is its perhaps sometimes plus thus yes less unless across seems looks sounds feels thanks');

const isNum = (w: string) => NUM.has(w) || (w.length > 0 && w.charCodeAt(0) >= 48 && w.charCodeAt(0) <= 57);
/** Adjective or adverb, by list or by a conservative suffix. */
function isAdj(w: string): boolean {
  if (ADJ.has(w)) return true;
  if (w.length < 5) return false;
  return /(?:ful|ous|ive|able|ible|less|ic|ish|est|ly)$/.test(w) && !/(?:only|early|family|reply|supply|apply|italy|july|daily)$/.test(w);
}

// ---------------------------------------------------------------------------------------------
// Which weak cues each 'unsure' reason listens to. Missing = locked (never promoted).

const B = 1; // burst
const PB = 2; // pause before
const PA = 4; // pause after
const SH = 8; // hesitation next to it
const ALL = B | PB | PA | SH;

const CUES: Record<string, number> = {
  // like
  'phrase-start': B | PA | SH,
  'be-like-det': B | PB | PA | SH,
  'be-like': ALL,
  'before-adj': ALL,
  'like-det': ALL,
  end: B | PB,
  unclear: ALL,
  // so
  discourse: B | SH,
  'so-unclear': B | SH,
  // actually / basically / literally
  opener: B | SH,
  'mid-clause': B | SH,
  'sentence-end': B,
  intensifier: B | SH,
  // right
  'tag-question': B,
  // i mean
  repair: B | SH,
  // you know
  tag: B | SH,
  'new-clause': B | PA | SH,
  'you-know-det': B | PB | PA,
  'prep-before': B | PB | PA,
  'you-know-what': B,
  'opener-yk': B | PA | SH,
  // kind of / sort of
  trailing: B | PB,
  // Locked: approx, quotative, hedge, backchannel, subj-unclear, and-like-it, yk-object
};

type Verdict = { label: HabitLabel; reason: string; hint?: 1 };
const real = (reason: string): Verdict => ({ label: 'real', reason });
const filler = (reason: string): Verdict => ({ label: 'filler', reason });
const unsure = (reason: string, hint?: 1): Verdict => ({ label: 'unsure', reason, hint });

// ---------------------------------------------------------------------------------------------
// Per-word rules. They read the transcript with hesitations taken out: "i would um like to" is
// judged as "i would like to". align.ts already counts the um; letting it also condemn the word
// next to it would punish nervous speakers twice, and wrongly (the verb is still a verb). Where a
// hesitation was matters only as a boundary hint (hb: one came just before this word) and as the
// weak 'stackHes' cue.

type Ctx = { w: string[]; n: number; hb: Uint8Array };
const at = (c: Ctx, k: number) => (k >= 0 && k < c.n ? c.w[k] : '');

function ruleLike(c: Ctx, i: number): Verdict {
  const l = at(c, i - 1);
  const l2 = at(c, i - 2);
  const r = at(c, i + 1);
  const r2 = at(c, i + 2);

  // Verb: "would like", "i'd like", "to like", "really like", "not like".
  if (VERB_LEFT.has(l)) return real('verb');
  // "kind of like", "sort of like", "a lot like": comparison.
  if (l === 'of' && (l2 === 'kind' || l2 === 'sort')) return real('comparison');
  if (l === 'lot' && l2 === 'a') return real('comparison');
  // "like I said", "like we discussed": like = as.
  if (CLAUSE_SUBJ.has(r) && AS_RIGHT2.has(r2)) return real('as-conj');
  // "what is it like", "what was that like".
  if ((l === 'it' || l === 'that') && (BE.has(l2) || l2 === 'what')) return real('what-like');
  // Subject + like: a verb unless a past-tense verb follows ("they like went").
  if (SUBJ.has(l)) {
    if (PAST.has(r)) return filler('before-verb');
    if (INTENS.has(r)) return unsure('subj-unclear'); // "i like really spicy food" or "i like really want it"
    return real('verb');
  }
  // A stuttered verb is still the verb: "i like like three things".
  if (l === 'like' && (SUBJ.has(l2) || VERB_LEFT.has(l2))) return real('verb');
  // "it just like stopped": before a finite verb is never a comparison.
  if (l === 'just' && (PAST.has(r) || BE.has(r))) return filler('before-verb');
  if (COMPARE_LEFT.has(l)) return real('comparison');
  // Stutters: "like like".
  if (r === 'like' || l === 'like') return filler('repeat');
  // Another habit word right next to it: "you know like", "like basically".
  if (r === 'basically' || r === 'literally' || (r === 'you' && r2 === 'know') || (r === 'i' && r2 === 'mean')) return filler('stacked');
  if ((l === 'know' && l2 === 'you') || (l === 'mean' && l2 === 'i') || l === 'basically' || l === 'literally' || l === 'actually')
    return filler('stacked');
  // After a conjunction: "and like the client", "so like we".
  if (CONJ.has(l) || l === 'so') {
    if ((r === 'it' || r === 'them') && !BE.has(r2) && !PAST.has(r2)) return unsure('and-like-it'); // "and like it"
    return filler('after-conj');
  }
  // After a be-verb.
  if (BE.has(l)) {
    if (DEMO.has(r)) return real('comparison'); // "it's like that"
    if (isNum(r)) return unsure('approx'); // "it was like 50 people": means "about"
    if (DET.has(r)) return unsure('be-like-det'); // "it's like a puzzle" or "it was, like, a mess"
    // Quotative: "she was like we need it friday", "my boss was like you're ready".
    if (CLAUSE_SUBJ.has(r) || r === 'oh' || r === 'no' || r === 'yes' || r === 'what' || r === 'wow' || r === 'okay')
      return unsure('quotative');
    if (INTENS.has(r) || isAdj(r)) {
      // A person reacting in one word is a quote: "i was like sure", "he was like really".
      // "she was like really upset" and "it was like huge" are fillers.
      const person = PERSON.has(l) || PERSON.has(l2);
      if (person && (!r2 || CLAUSE_SUBJ.has(r2) || CONJ.has(r2))) return unsure('quotative');
      return filler('be-like-adj');
    }
    if (PAST.has(r) || BE.has(r)) return filler('before-verb');
    return unsure(r ? 'be-like' : 'end');
  }
  // Before a finite verb: "the meeting like went long".
  if (PAST.has(r) || BE.has(r)) return filler('before-verb');
  // Before an intensifier: "like really", "like super".
  if (INTENS.has(r)) return filler('before-intensifier');
  if (isNum(r)) return unsure('approx');
  // After a plural noun: "tools like jira", "clients like you".
  if (r && l.length >= 4 && l.endsWith('s') && !PLURAL_NOT.has(l) && !isAdj(r)) return real('such-as');
  if (DEMO.has(r)) return real('comparison'); // "it went like this"
  if (DET.has(r)) return unsure('like-det'); // "someone like the boss" or "we need like a week"
  if (isAdj(r)) return unsure('before-adj', 1);
  if (!l) return unsure('phrase-start', 1);
  if (!r) return unsure('end');
  return unsure('unclear');
}

function ruleSo(c: Ctx, i: number): Verdict {
  const l = at(c, i - 1);
  const r = at(c, i + 1);
  const r2 = at(c, i + 2);
  // Pro-form and fixed phrases: "i think so", "if so", "or so", "and so on", "even so".
  if (/^(think|thought|hope|guess|believe|suppose|if|do|did|does|done|doing|said|say|says|told|even|not|or|why)$/.test(l))
    return real('pro-form');
  if (r === 'on' || r === 'forth' || r === 'called' || r === 'as' || (r === 'to' && r2 === 'speak')) return real('fixed-phrase');
  // Degree: "so much", "so many", "so good", "so quickly". A stuttered degree word is still one:
  // "so so much happened".
  const degree = (x: string) => /^(much|many|far|long|little|few|well|often|soon)$/.test(x) || isAdj(x);
  if (degree(r) || (r === 'so' && degree(r2))) return real('degree');
  // Purpose: "so that we can".
  if (r === 'that') {
    if (BE.has(r2) || !r2) return unsure('discourse'); // "so that was the plan"
    return real('so-that');
  }
  // Stutter: "so so".
  if (r === 'so' && !BE.has(l)) return filler('repeat');
  if (l === 'so' && !BE.has(at(c, i - 2))) return filler('repeat');
  // Stacked with another habit word: "so like", "so basically", "so you know".
  if (r === 'like' || r === 'basically' || r === 'literally' || (r === 'you' && r2 === 'know') || (r === 'i' && r2 === 'mean'))
    return unsure('discourse');
  // Opening a turn or a clause: "so today i'll", "and so we".
  if (!l || c.hb[i] || CONJ.has(l) || l === 'okay' || l === 'right' || l === 'yeah' || l === 'well') return unsure('discourse');
  // Between two clauses: result conjunction, "we were late so we cancelled".
  if (CLAUSE_SUBJ.has(r) || DET.has(r) || r === 'our' || r === 'my' || r === 'now' || r === 'then') return real('result');
  return unsure('so-unclear');
}

function ruleAdverb(c: Ctx, i: number, word: 'actually' | 'basically' | 'literally'): Verdict {
  const l = at(c, i - 1);
  const r = at(c, i + 1);
  const r2 = at(c, i + 2);
  // Stutter.
  if (r === word || l === word) return filler('repeat');
  if (word === 'literally') {
    // The literal sense: "take it literally", "it's literally called", "literally the title".
    if (/^(take|took|taken|taking|mean|means|meant|translate|translated|translates|interpret|interpreted|quote|quoted|read)$/.test(l) || (l === 'it' && /^(take|took|taking|mean|read)$/.test(at(c, i - 2))))
      return real('literal-sense');
    if (/^(called|named|means|meant|translates|says|reads|written|spelled)$/.test(r)) return real('literal-sense');
    if (r === 'the' && /^(title|word|name|same|quote|phrase|text|definition)$/.test(r2)) return real('literal-sense');
    if (r === 'word' && r2 === 'for') return real('literal-sense');
  }
  if (word === 'actually') {
    // Contrast or reality check: "did it actually work", "what actually happened", "not actually".
    if (/^(did|does|do|didn't|don't|doesn't|isn't|wasn't|not|never|what|how|who|where|when|whether|if|ever)$/.test(l)) return real('contrast');
    if (l === 'it' && /^(did|does|will|would|can|could)$/.test(at(c, i - 2))) return real('contrast');
  }
  // Stacked with another habit word: "actually like", "basically you know".
  const stackR = r === 'like' || r === 'so' || r === 'basically' || r === 'literally' || r === 'actually' || (r === 'you' && r2 === 'know') || (r === 'i' && r2 === 'mean');
  const stackL = l === 'like' || l === 'basically' || l === 'literally' || l === 'actually';
  // Mid-clause after a subject, modal or be-verb: "i actually think", "it's basically free".
  const mid = SUBJ.has(l) || BE.has(l) || VERB_LEFT.has(l) || l === 'it' || l === 'this' || l === 'that';
  if (mid) return unsure(word === 'literally' ? 'intensifier' : 'mid-clause');
  // After a filler but before an adjective or participle it may be the degree word it looks like:
  // "we were like basically done" (= practically done). The "like" is the filler there.
  if (stackL && !stackR && (isAdj(r) || PAST.has(r))) return unsure('intensifier');
  if (stackR || stackL) return filler('stacked');
  if (!l || c.hb[i] || CONJ.has(l) || l === 'so' || l === 'okay' || l === 'well' || l === 'yeah' || l === 'no') return unsure('opener');
  if (!r) return unsure('sentence-end'); // "it works actually"
  return unsure(word === 'literally' ? 'intensifier' : 'mid-clause');
}

const RIGHT_NEXT = set(
  'now away here there where when as around after before back on up in into at to from through next off down over behind side answer answers way person people thing things time call decision decisions choice choices fit track direction hand move question questions tool tools place moment team one words approach level amount balance price mix data skills reasons idea ideas spot',
);
function ruleRight(c: Ctx, i: number): Verdict {
  const l = at(c, i - 1);
  const r = at(c, i + 1);
  if (RIGHT_NEXT.has(r)) return real('adverb-or-adj'); // "right now", "the right way"
  if (/^(the|a|that's|is|was|are|were|you're|it's|i'm|we're|they're|all|turn|turned|left|exactly|quite|not|isn't|absolutely|totally|be|been|got|get|it|that|he's|she's|sounds|seems|feels|looks|sound|seem|feel|look)$/.test(l))
    return real('adverb-or-adj'); // "you're right", "all right", "turn right", "got it right"
  if (r === 'right' || l === 'right') return unsure('backchannel');
  if (!l || c.hb[i] || CONJ.has(l) || l === 'okay' || l === 'yeah') return unsure('opener'); // "right so"
  if (isAdj(r)) return real('adverb-or-adj'); // "right good" is rare; keep safe
  // After content, at the end or before a new clause: a tag question, "we ship friday right".
  return unsure('tag-question');
}

function ruleIMean(c: Ctx, i: number): Verdict {
  const l = at(c, i - 1);
  const r = at(c, i + 2);
  const r2 = at(c, i + 3);
  if (/^(what|which|if|do|did|don't|didn't|whatever|you|that's|how|exactly)$/.test(l)) return real('verb'); // "what i mean"
  if (/^(it|to|well|business|no|anything|nothing|every)$/.test(r)) return real('verb'); // "i mean it", "i mean to"
  if (r === 'that' && !BE.has(r2)) return real('verb'); // "i mean that we should"
  if (r === 'i' && r2 === 'mean') return filler('repeat');
  if (l === 'mean' && at(c, i - 2) === 'i') return filler('repeat');
  if (r === 'like' || r === 'basically' || r === 'literally' || (r === 'you' && r2 === 'know')) return filler('stacked');
  if (l === 'like' || l === 'basically' || (l === 'know' && at(c, i - 2) === 'you')) return filler('stacked');
  return unsure('repair'); // "i mean the second one": a self-repair, often meaningful
}

/** Words after "you know" that carry on talking rather than name its object. */
const HABIT_NEXT = set('like so basically literally actually i mean kind sort kinda sorta right well oh yeah okay just um uh');
const YK_REAL_LEFT = set(
  "do did does don't didn't doesn't if would will could should might as what which how now all everyone people who whom whether someone anyone everything let that i'd we'd won't can can't",
);
const YK_REAL_RIGHT = set(
  'it him her them me us this about how why where when who whether if each everyone everybody someone anyone everything anything nothing something more better best exactly your his my our their its any some all much that',
);
function ruleYouKnow(c: Ctx, i: number): Verdict {
  const l = at(c, i - 1);
  const l2 = at(c, i - 2);
  const r = at(c, i + 2);
  const r2 = at(c, i + 3);
  if (YK_REAL_LEFT.has(l)) return real('verb'); // "do you know", "let you know", "as you know"
  if (r === 'you' && r2 === 'know') return filler('repeat');
  if (l === 'know' && l2 === 'you') return filler('repeat');
  if (r === 'what') return unsure('you-know-what'); // "you know what i mean", "you know what, let's"
  if (YK_REAL_RIGHT.has(r)) return real('verb-object'); // "you know him", "you know how"
  // Inside a noun phrase: "the you know budget".
  if (DET.has(l) || /^(my|our|your|their|his|her)$/.test(l)) return filler('interrupts-phrase');
  // Inside a clause before its complement: "it was you know pretty bad".
  if (BE.has(l) && (isAdj(r) || INTENS.has(r) || DET.has(r) || isNum(r))) return filler('mid-clause');
  if (r === 'like' || r === 'basically' || r === 'literally' || r === 'actually' || r === 'so' || (r === 'i' && r2 === 'mean')) return filler('stacked');
  if (l === 'like' || l === 'basically' || l === 'literally' || l === 'actually' || (l === 'of' && (l2 === 'kind' || l2 === 'sort')) || l === 'kinda')
    return filler('stacked');
  if (/^(with|to|for|of|in|on|at|from|about|into)$/.test(l) && r) return unsure('prep-before', 1); // "talked to you know the client"
  // Before a word that can't start a clause or a complement, it's most likely the verb and its
  // object: "you know python, you know java". Locked: a burst of those is a list, not a tic.
  if (r && !CLAUSE_SUBJ.has(r) && !DET.has(r) && !DEMO.has(r) && !CONJ.has(r) && !INTENS.has(r) && !isAdj(r) && !PAST.has(r) && !BE.has(r) && !isNum(r) && !HABIT_NEXT.has(r))
    return unsure('yk-object');
  if (!l || c.hb[i] || CONJ.has(l) || l === 'so' || l === 'okay' || l === 'well') return unsure('opener-yk'); // "you know i think"
  if (!r) return unsure('tag'); // "it was hard you know"
  if (CLAUSE_SUBJ.has(r)) return unsure('new-clause', 1); // "it was hard you know we had no budget"
  if (DET.has(r)) return unsure('you-know-det');
  return unsure('tag');
}

const KIND_REAL_LEFT = set(
  'a an the this that what which any some every each one same different other another new our my your their his her its no certain particular specific special right wrong best first only main whatever these those all',
);
function ruleKindOf(c: Ctx, i: number): Verdict {
  const l = at(c, i - 1);
  const r = at(c, i + 2);
  const r2 = at(c, i + 3);
  const first = c.w[i];
  if (KIND_REAL_LEFT.has(l)) return real('noun'); // "a kind of tool", "what sort of"
  if (r === first && r2 === 'of') return filler('repeat');
  if (l === 'of' && at(c, i - 2) === first) return filler('repeat');
  if (r === 'you' && r2 === 'know') return filler('stacked');
  if (r === 'i' && r2 === 'mean') return filler('stacked');
  if (r === 'basically' || r === 'literally') return filler('stacked');
  if (!r) return unsure('trailing'); // "it was kind of"
  return unsure('hedge'); // "it's kind of slow", "we sort of agreed": changes the meaning, never scored
}

function ruleKinda(c: Ctx, i: number): Verdict {
  const r = at(c, i + 1);
  if (r === 'you' && at(c, i + 2) === 'know') return filler('stacked');
  if (r === 'basically' || r === 'literally') return filler('stacked');
  if (!r) return unsure('trailing');
  return unsure('hedge');
}

// ---------------------------------------------------------------------------------------------
// Times.

function timesUsable(toks: readonly HeardToken[], n: number): boolean {
  if (n < 2) return false;
  let defined = 0;
  let flat = 0;
  let pairs = 0;
  let prev: number | undefined;
  for (let k = 0; k < n; k++) {
    const t = toks[k];
    const s = typeof t === 'string' ? undefined : t.start;
    if (s !== undefined) {
      defined++;
      if (prev !== undefined) {
        pairs++;
        if (s - prev <= 20) flat++; // identical or backwards stamps: arrival times, not audio times
      }
    }
    prev = s;
  }
  return defined >= n * 0.9 && pairs > 0 && flat <= pairs * 0.3;
}

function estDuration(w: string): number {
  return 80 + 55 * w.length;
}

/** Silence between token a and token a+1, or -1 if unknown. */
function gapAfterToken(toks: readonly HeardToken[], w: string[], a: number): number {
  if (a < 0 || a + 1 >= w.length) return -1;
  const x = toks[a];
  const y = toks[a + 1];
  if (typeof x === 'string' || typeof y === 'string' || x.start === undefined || y.start === undefined) return -1;
  const end = x.end ?? x.start + estDuration(w[a]);
  return y.start - end;
}

// ---------------------------------------------------------------------------------------------

/**
 * Labels every habit-word occurrence in a transcript as filler, real or unsure, with a reason.
 * Only 'filler' is ever meant to count. Pure and allocation-light: runs on every recogniser update.
 */
export function classifyHabits(tokens: readonly HeardToken[], opts: HabitOptions = {}): HabitResult[] {
  const n = tokens.length;
  const raw: string[] = new Array(n);
  let hes = 0;
  for (let k = 0; k < n; k++) {
    const t = tokens[k];
    raw[k] = typeof t === 'string' ? t : t.word;
    if (HES.has(raw[k])) hes++;
  }
  // The rules' view: hesitations removed, each word remembering where it was.
  let w = raw;
  let rawOf: Int32Array | undefined;
  const hb = new Uint8Array(n - hes); // a hesitation came right before this word
  const ha = new Uint8Array(n - hes); // a hesitation came right after it
  if (hes) {
    w = new Array(n - hes);
    rawOf = new Int32Array(n - hes);
    let m = 0;
    for (let k = 0; k < n; k++) {
      if (HES.has(raw[k])) {
        if (m > 0) ha[m - 1] = 1;
        if (m < hb.length) hb[m] = 1;
        continue;
      }
      w[m] = raw[k];
      rawOf[m++] = k;
    }
  }
  const sn = w.length;
  const c: Ctx = { w, n: sn, hb };
  const out: HabitResult[] = [];
  const hints: number[] = [];
  const stackHes: number[] = [];

  for (let k = 0; k < sn; k++) {
    const x = w[k];
    let word: HabitWord | undefined;
    let span: 1 | 2 = 1;
    let v: Verdict | undefined;
    switch (x) {
      case 'like':
        word = 'like';
        v = ruleLike(c, k);
        break;
      case 'so':
        word = 'so';
        v = ruleSo(c, k);
        break;
      case 'actually':
      case 'basically':
      case 'literally':
        word = x;
        v = ruleAdverb(c, k, x);
        break;
      case 'right':
        word = 'right';
        v = ruleRight(c, k);
        break;
      case 'kinda':
      case 'sorta':
        word = x === 'kinda' ? 'kind of' : 'sort of';
        v = ruleKinda(c, k);
        break;
      default:
        // Two-word habits must be said together: "you um know" is not "you know".
        if (k + 1 < sn && !ha[k] && HABIT_PAIRS.has(`${x}|${w[k + 1]}`)) {
          span = 2;
          if (x === 'you') {
            word = 'you know';
            v = ruleYouKnow(c, k);
          } else if (x === 'i') {
            word = 'i mean';
            v = ruleIMean(c, k);
          } else {
            word = x === 'kind' ? 'kind of' : 'sort of';
            v = ruleKindOf(c, k);
          }
        }
    }
    if (!word || !v) continue;
    out.push({ index: rawOf ? rawOf[k] : k, span, word, label: v.label, reason: v.reason });
    hints.push(v.hint ?? 0);
    stackHes.push(hb[k] || ha[k + span - 1]);
  }
  if (!out.length) return out;

  // Weak cues for 'unsure' labels.
  const burstWindow = opts.burstWindow ?? 15;
  const burstMin = opts.burstMin ?? 3;
  const pauseMs = opts.pauseMs ?? 350;
  const useTimes = opts.times !== 'ignore' && timesUsable(tokens, n);

  // Bursts: non-real uses of the same word, burstMin of them inside burstWindow tokens.
  const burst = new Uint8Array(out.length);
  const byWord = new Map<HabitWord, number[]>();
  for (let q = 0; q < out.length; q++) {
    if (out[q].label === 'real') continue;
    let list = byWord.get(out[q].word);
    if (!list) byWord.set(out[q].word, (list = []));
    list.push(q);
  }
  for (const list of byWord.values()) {
    for (let a = 0; a + burstMin - 1 < list.length; a++) {
      const b = a + burstMin - 1;
      if (out[list[b]].index - out[list[a]].index < burstWindow) for (let q = a; q <= b; q++) burst[list[q]] = 1;
    }
  }

  for (let q = 0; q < out.length; q++) {
    const o = out[q];
    if (o.label !== 'unsure') continue;
    const cues = CUES[o.reason];
    if (!cues) continue; // locked
    let points = hints[q];
    let why = '';
    if (cues & B && burst[q]) {
      points += 2;
      why = 'burst';
    }
    // Pauses are a tie-breaker worth one point at most: "it's... like... a puzzle" (thinking of a
    // comparison) and "it was, like, a mess" sound the same around the word. Where a reason listens
    // to both sides, both must be pauses.
    if (useTimes && cues & (PB | PA)) {
      const before = !(cues & PB) || gapAfterToken(tokens, raw, o.index - 1) > pauseMs;
      const after = !(cues & PA) || gapAfterToken(tokens, raw, o.index + o.span - 1) > pauseMs;
      if (before && after) {
        points++;
        why ||= 'pause';
      }
    }
    // An um next to a word that already leans filler doesn't add up: "customers um like fast
    // answers" is a stall before a verb. A leaning word needs a pause or a burst instead.
    if (cues & SH && stackHes[q] && !hints[q]) {
      points++;
      why ||= 'stacked';
    }
    if (points >= 2) {
      o.label = 'filler';
      o.reason = why || o.reason;
    }
  }
  return out;
}

/** Counts per word and label, for the Tape and for analytics (numbers only). */
export function habitSummary(results: readonly HabitResult[]): {
  filler: number;
  unsure: number;
  real: number;
  byWord: Partial<Record<HabitWord, { filler: number; unsure: number; real: number }>>;
} {
  const s = { filler: 0, unsure: 0, real: 0, byWord: {} as Partial<Record<HabitWord, { filler: number; unsure: number; real: number }>> };
  for (const r of results) {
    s[r.label]++;
    const b = (s.byWord[r.word] ??= { filler: 0, unsure: 0, real: 0 });
    b[r.label]++;
  }
  return s;
}
