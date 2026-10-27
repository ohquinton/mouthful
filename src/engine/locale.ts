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
 * The region subtag of a BCP 47 tag: "zh-Hans-SG" → "SG", "en-IN-u-ca-gregory" → "IN".
 * It comes after the language and an optional 4-letter script, and before any variants or
 * extensions (which start at a one-letter subtag, so "-u-ca-…" is never read as Canada).
 */
function regionOf(tag: string): string | undefined {
  const parts = tag.split(/[-_]/);
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    if (p.length <= 1) return undefined; // extension or private use: no region before it
    if (/^[A-Za-z]{2}$/.test(p)) return p.toUpperCase();
    if (/^[A-Za-z]{4}$/.test(p) && i === 1) continue; // script, e.g. Hans, Latn
    return undefined; // a variant or numeric region (419): nothing we offer
  }
  return undefined;
}

/**
 * The English variety for the phone's region, e.g. "hi-IN" → "en-IN". Passages are always
 * English, so the phone's language doesn't matter, only where it's set to.
 */
export function defaultSpeechLocale(deviceLocale: string | undefined): string {
  const region = regionOf(deviceLocale ?? '');
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
