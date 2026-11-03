import { experiencePromptAfter } from '../src/content/experiences';
import { EXPERIENCES, experienceTopic } from '../src/content/experiences';
import { MINUTE_PROMPTS } from '../src/content/prompts';
import { WORD_PACKS } from '../src/content/wordpacks';

describe('the two practice experiences', () => {
  it('keeps every existing topic reachable, with everyday English separate from ideas and explanations', () => {
    expect(EXPERIENCES.english.levels).toEqual([1]);
    expect(EXPERIENCES.articulation.levels).toEqual([2, 3]);
    const levels = new Set([...EXPERIENCES.english.levels, ...EXPERIENCES.articulation.levels]);
    expect(MINUTE_PROMPTS.every((p) => levels.has(p.level))).toBe(true);
  });

  it('keeps every pack reachable and only links to real packs', () => {
    const configured = new Set([...EXPERIENCES.english.packs, ...EXPERIENCES.articulation.packs]);
    expect([...configured].sort()).toEqual(WORD_PACKS.map((p) => p.id).sort());
  });

  it('offers free vocabulary in both experiences', () => {
    for (const experience of Object.values(EXPERIENCES)) {
      const ids: readonly string[] = experience.packs;
      expect(WORD_PACKS.some((p) => ids.includes(p.id) && p.free)).toBe(true);
    }
  });

  it('suggests stable, mode-appropriate topics across local dates', () => {
    for (let day = 1; day <= 31; day++) {
      const morning = new Date(2026, 10, day, 8);
      const evening = new Date(2026, 10, day, 23);
      expect(experienceTopic('english', morning).level).toBe(1);
      expect([2, 3]).toContain(experienceTopic('articulation', morning).level);
      expect(experienceTopic('english', morning)).toEqual(experienceTopic('english', evening));
      expect(experienceTopic('articulation', morning)).toEqual(experienceTopic('articulation', evening));
    }
  });
});

test('topic shuffling remains in each experience through a full rotation', () => {
  for (const mode of ['english', 'articulation'] as const) {
    const base = experienceTopic(mode, new Date(2026, 10, 3));
    for (let step = 0; step < 40; step++) {
      expect((EXPERIENCES[mode].levels as readonly number[]).includes(experiencePromptAfter(mode, base, step).level)).toBe(true);
    }
  }
});
