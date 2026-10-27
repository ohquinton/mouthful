// Which English the speech recogniser listens for. A recogniser tuned to the reader's own
// variety of English marks fewer words red that they actually said, which is the number
// the beta cares most about (false red per 100 words).

export type SpeechLocale = { id: string; label: string };

/** English varieties the platform recognisers commonly support. Labels describe the English, never the person. */
export const SPEECH_LOCALES: SpeechLocale[] = [
  { id: 'en-US', label: 'American' },
  { id: 'en-CA', label: 'Canadian' },
  { id: 'en-GB', label: 'British' },
  { id: 'en-IN', label: 'Indian' },
  { id: 'en-AU', label: 'Australian' },
  { id: 'en-IE', label: 'Irish' },
  { id: 'en-NZ', label: 'New Zealand' },
  { id: 'en-SG', label: 'Singaporean' },
  { id: 'en-ZA', label: 'South African' },
  { id: 'en-PH', label: 'Filipino' },
];

const FALLBACK = 'en-US';
const offered = (id: string) => SPEECH_LOCALES.some((l) => l.id === id);

/**
 * The English variety for the phone's region, e.g. "hi-IN" → "en-IN". Passages are always
 * English, so the phone's language doesn't matter, only where it's set to.
 */
export function defaultSpeechLocale(deviceLocale: string | undefined): string {
  const region = (deviceLocale ?? '').replace('_', '-').split('-')[1]?.toUpperCase();
  const id = region ? `en-${region}` : FALLBACK;
  return offered(id) ? id : FALLBACK;
}

/** The reader's saved choice if it's still offered, otherwise the phone's region. */
export function speechLocale(chosen: string | undefined, deviceLocale: string | undefined): string {
  return chosen && offered(chosen) ? chosen : defaultSpeechLocale(deviceLocale);
}

export function speechLocaleLabel(id: string): string {
  return SPEECH_LOCALES.find((l) => l.id === id)?.label ?? 'American';
}
