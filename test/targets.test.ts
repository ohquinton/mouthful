// Target length lights: the zones, the clock and how each part of a script gets its target.
import { clock, LENGTH_LABEL, lengthZone, partTargetSeconds, spokenClock, targetForPassage, targetForScriptPart } from '../src/content/targets';
import { getMoment } from '../src/content/moments';

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ') + '.';

describe('lengthZone: neutral, then amber, then soft red', () => {
  it('is neutral under 80% of the target', () => {
    expect(lengthZone(0, 120)).toBe('under');
    expect(lengthZone(95.9, 120)).toBe('under');
  });

  it('is amber ("wrap up") from 80% to 110%', () => {
    expect(lengthZone(96, 120)).toBe('near');
    expect(lengthZone(120, 120)).toBe('near');
    expect(lengthZone(132, 120)).toBe('near');
    expect(LENGTH_LABEL.near).toBe('wrap up');
  });

  it('is soft red ("over time") past 110%', () => {
    expect(lengthZone(132.5, 120)).toBe('over');
    expect(LENGTH_LABEL.over).toBe('over time');
  });

  it('a zero target never lights up', () => {
    expect(lengthZone(500, 0)).toBe('under');
  });
});

describe('clock', () => {
  it('shows m:ss, rounding down', () => {
    expect(clock(134)).toBe('2:14');
    expect(clock(120)).toBe('2:00');
    expect(clock(59.9)).toBe('0:59');
    expect(clock(0)).toBe('0:00');
    expect(clock(-3)).toBe('0:00');
  });

  it('reads aloud with singulars', () => {
    expect(spokenClock(134)).toBe('2 minutes 14 seconds');
    expect(spokenClock(61)).toBe('1 minute 1 second');
    expect(spokenClock(120)).toBe('2 minutes');
    expect(spokenClock(0)).toBe('0 seconds');
  });
});

describe('partTargetSeconds', () => {
  it('without a slot: the part at the middle of the pace band', () => {
    // presenting 120–155, middle 137.5 wpm: 275 words is 2 minutes.
    expect(partTargetSeconds({ partWords: 275, scriptWords: 275, pace: 'presenting' })).toBe(120);
    // talking 120–170, middle 145.
    expect(partTargetSeconds({ partWords: 145, scriptWords: 145, pace: 'talking' })).toBe(60);
  });

  it('with a slot (interview: 2 min): shared out by each part’s words', () => {
    expect(partTargetSeconds({ partWords: 150, scriptWords: 300, momentSeconds: 120, pace: 'talking' })).toBe(60);
    expect(partTargetSeconds({ partWords: 300, scriptWords: 300, momentSeconds: 120, pace: 'talking' })).toBe(120);
  });

  it('no words, no target', () => {
    expect(partTargetSeconds({ partWords: 0, scriptWords: 0, pace: 'talking' })).toBeUndefined();
  });
});

describe('targetForScriptPart', () => {
  const interview = getMoment('interview')!;
  const script = { id: '42', chunks: [words(150), words(150)] };

  it('the interview’s 2 minutes apply to the moment’s own script', () => {
    expect(interview.targetSeconds).toBe(120);
    expect(targetForScriptPart(script, 0, { def: interview, scriptId: '42' }, 'talking')).toBe(60);
  });

  it('another script falls back to its words at the band’s middle', () => {
    expect(targetForScriptPart(script, 1, { def: interview, scriptId: '7' }, 'talking')).toBe(Math.round((150 / 145) * 60));
  });

  it('a presentation has no slot: from the words at the presenting middle', () => {
    expect(getMoment('presentation')!.targetSeconds).toBeUndefined();
    expect(targetForScriptPart(script, 0, { def: getMoment('presentation'), scriptId: '42' }, 'presenting')).toBe(Math.round((150 / 137.5) * 60));
  });

  it('a part that doesn’t exist has none', () => {
    expect(targetForScriptPart(script, 5, undefined, 'talking')).toBeUndefined();
    expect(targetForScriptPart(undefined, 0, undefined, 'talking')).toBeUndefined();
  });
});

describe('targetForPassage: off for everything but your own scripts', () => {
  it.each(['baseline', 'night-shift', 'w.interview.0', 'w.interview.1', 'talk', 's.abc.0', ''])('"%s" has no target', async (id) => {
    expect(await targetForPassage(id, undefined, 'reading')).toBeUndefined();
  });

  it('a saved script part has one', async () => {
    const { saveScript } = await import('../src/content/scripts');
    const s = await saveScript('Mine', words(100));
    expect(await targetForPassage(`s.${s.id}.0`, undefined, 'talking')).toBe(Math.round((100 / 145) * 60));
  });
});
