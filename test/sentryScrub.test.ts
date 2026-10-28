import type { ErrorEvent } from '@sentry/react-native';
import { MAX_VALUE_LENGTH, scrubEvent, sentryOptions } from '../src/sentry';

// Crash reports must never carry the reader's words, who they are, or where they're from
// (CLAUDE.md principle 3). scrubEvent is the last thing that runs before an event leaves.

function event(partial: Partial<ErrorEvent>): ErrorEvent {
  return { type: undefined, ...partial } as ErrorEvent;
}

function exception(value: string): ErrorEvent {
  return event({
    exception: {
      values: [
        {
          type: 'TypeError',
          value,
          stacktrace: { frames: [{ filename: 'app:///index.bundle', function: 'align', lineno: 120, colno: 14 }] },
        },
      ],
    },
  });
}

describe('scrubEvent', () => {
  it('keeps a normal stack-trace error as it is', () => {
    const e = exception("undefined is not an object (evaluating 'words.length')");
    const out = scrubEvent(e)!;
    expect(out).not.toBeNull();
    expect(out.exception!.values![0].value).toBe("undefined is not an object (evaluating 'words.length')");
    expect(out.exception!.values![0].type).toBe('TypeError');
    expect(out.exception!.values![0].stacktrace!.frames![0].function).toBe('align');
  });

  it('drops an exception whose message looks like a transcript (more than 8 words)', () => {
    expect(scrubEvent(exception('so I think the main thing I bring to the team is'))).toBeNull();
  });

  it('keeps an exception of exactly 8 words', () => {
    expect(scrubEvent(exception('one two three four five six seven eight'))).not.toBeNull();
  });

  it('drops the event if any one of several exceptions is transcript-like', () => {
    const e = event({
      exception: {
        values: [
          { type: 'Error', value: 'Render failed' },
          { type: 'Error', value: 'thank you all for coming today I wanted to walk you through' },
        ],
      },
    });
    expect(scrubEvent(e)).toBeNull();
  });

  it('drops a transcript-like message, from captureMessage or a logentry', () => {
    expect(scrubEvent(event({ message: 'I have been leading the design team for three years now' }))).toBeNull();
    expect(scrubEvent(event({ logentry: { message: 'we shipped the new onboarding flow and retention went up a lot' } }))).toBeNull();
    expect(scrubEvent(event({ message: 'Short code-like message' }))).not.toBeNull();
  });

  it('counts words across any whitespace, so newlines and tabs do not hide a transcript', () => {
    expect(scrubEvent(exception('one\ntwo\tthree  four\n\nfive six seven eight nine'))).toBeNull();
  });

  it('caps a long exception value at 200 characters', () => {
    const long = `Invariant:${'x'.repeat(400)}`;
    const out = scrubEvent(exception(long))!;
    expect(out.exception!.values![0].value).toHaveLength(MAX_VALUE_LENGTH);
    expect(MAX_VALUE_LENGTH).toBe(200);
  });

  it('removes the user, breadcrumbs, extra and request', () => {
    const e = event({
      ...exception('Boom'),
      user: { id: 'abc', ip_address: '1.2.3.4' },
      breadcrumbs: [{ message: 'navigated to /fixit?words=quarterly,leverage' }],
      extra: { transcript: 'hello there' },
      request: { url: 'https://example.com/?q=hello' },
    });
    const out = scrubEvent(e)!;
    expect(out.user).toBeUndefined();
    expect(out.breadcrumbs).toBeUndefined();
    expect(out.extra).toBeUndefined();
    expect(out.request).toBeUndefined();
  });

  it('removes culture and the device locale, and keeps the rest of the device', () => {
    const e = event({
      ...exception('Boom'),
      contexts: {
        culture: { locale: 'en-IN', timezone: 'Asia/Kolkata', calendar: 'gregorian' },
        device: { model: 'iPhone16,1', locale: 'en_IN', family: 'iOS' },
        os: { name: 'iOS', version: '26.1' },
      },
    });
    const out = scrubEvent(e)!;
    expect(out.contexts!.culture).toBeUndefined();
    expect(out.contexts!.device!.locale).toBeUndefined();
    expect(out.contexts!.device!.model).toBe('iPhone16,1');
    expect(out.contexts!.os!.name).toBe('iOS');
    expect(JSON.stringify(out)).not.toMatch(/en[-_]IN|Kolkata/);
  });

  it('does not change the event it was given', () => {
    const e = event({ ...exception('x'.repeat(300)), user: { id: 'abc' }, contexts: { device: { locale: 'en_CA' } } });
    scrubEvent(e);
    expect(e.user).toEqual({ id: 'abc' });
    expect(e.contexts!.device!.locale).toBe('en_CA');
    expect(e.exception!.values![0].value).toHaveLength(300);
  });

  it('handles an event with no exception, contexts or message', () => {
    expect(scrubEvent(event({}))).toEqual({ type: undefined });
  });
});

describe('sentryOptions', () => {
  it('switches off everything that could carry more than the crash itself', () => {
    const o = sentryOptions();
    expect(o.sendDefaultPii).toBe(false);
    expect(o.attachScreenshot).toBe(false);
    expect(o.attachViewHierarchy).toBe(false);
    expect(o.tracesSampleRate).toBe(0);
    expect(o.enableLogs).toBe(false);
    expect(o.enableAutoSessionTracking).toBe(false);
    expect(o.maxBreadcrumbs).toBe(0);
    expect(o.beforeBreadcrumb!({ message: 'tap' })).toBeNull();
    expect(o.integrations).toBeUndefined(); // no replay or feedback added
    expect('replaysSessionSampleRate' in o || 'replaysOnErrorSampleRate' in o).toBe(false);
  });

  it('runs every event through scrubEvent', () => {
    const o = sentryOptions();
    const out = o.beforeSend!(event({ ...exception('Boom'), user: { id: 'abc' } }), {}) as ErrorEvent;
    expect(out.user).toBeUndefined();
    expect(o.beforeSend!(exception('a b c d e f g h i j'), {})).toBeNull();
  });
});
