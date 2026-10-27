import { passageOfTheDay } from '../../content/passages';
import { promptOfTheDay } from '../../content/prompts';
import { defaultSpeechLocale, speechLocale, SPEECH_LOCALES } from '../locale';

describe('daily content follows the local calendar, not UTC', () => {
  // 00:05 and 23:55 on the same local day straddle a UTC midnight in every zone except UTC.
  const early = new Date(2026, 9, 26, 0, 5);
  const late = new Date(2026, 9, 26, 23, 55);
  const nextDay = new Date(2026, 9, 27, 0, 5);

  it('shows one warm-up passage for the whole local day', () => {
    expect(passageOfTheDay(late).id).toBe(passageOfTheDay(early).id);
  });

  it('moves to a new passage after local midnight', () => {
    expect(passageOfTheDay(nextDay).id).not.toBe(passageOfTheDay(late).id);
  });

  it('shows one Free talk prompt for the whole local day', () => {
    expect(promptOfTheDay(late)).toBe(promptOfTheDay(early));
    expect(promptOfTheDay(nextDay)).not.toBe(promptOfTheDay(late));
  });
});

describe('speech recognition locale', () => {
  it('listens for the English of the phone’s region', () => {
    expect(defaultSpeechLocale('en-IN')).toBe('en-IN');
    expect(defaultSpeechLocale('en-GB')).toBe('en-GB');
    expect(defaultSpeechLocale('en_CA')).toBe('en-CA');
  });

  it('uses English for the region even when the phone is set to another language', () => {
    // A Hindi-language phone in India still reads English passages, so listen for Indian English.
    expect(defaultSpeechLocale('hi-IN')).toBe('en-IN');
    expect(defaultSpeechLocale('fr-CA')).toBe('en-CA');
  });

  it('reads the region past a script subtag, so a Singapore or Serbia phone isn’t mistaken for no region', () => {
    expect(defaultSpeechLocale('zh-Hans-SG')).toBe('en-SG');
    expect(defaultSpeechLocale('zh_Hant_SG')).toBe('en-SG');
    expect(defaultSpeechLocale('sr-Latn-RS')).toBe('en-US'); // Serbia has no offered English, so the fallback
    expect(defaultSpeechLocale('en-Latn-IN')).toBe('en-IN');
  });

  it('ignores extensions and variants that come after the region', () => {
    expect(defaultSpeechLocale('en-IN-u-ca-gregory')).toBe('en-IN');
    expect(defaultSpeechLocale('en-GB-oxendict')).toBe('en-GB');
  });

  it('falls back to US English for unknown regions or no region', () => {
    expect(defaultSpeechLocale('zh-Hans')).toBe('en-US');
    expect(defaultSpeechLocale('pt-BR')).toBe('en-US');
    expect(defaultSpeechLocale('en')).toBe('en-US');
    expect(defaultSpeechLocale('')).toBe('en-US');
    expect(defaultSpeechLocale(undefined)).toBe('en-US');
  });

  it('prefers the reader’s own choice over the phone’s region', () => {
    expect(speechLocale('en-IN', 'en-CA')).toBe('en-IN');
  });

  it('ignores a saved choice that is no longer offered', () => {
    expect(speechLocale('en-XX', 'en-GB')).toBe('en-GB');
  });

  it('only offers English varieties', () => {
    expect(SPEECH_LOCALES.every((l) => /^en-[A-Z]{2}$/.test(l.id))).toBe(true);
  });
});
