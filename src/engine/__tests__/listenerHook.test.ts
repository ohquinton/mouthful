// useListener's event wiring: errors, restarts, unmounts and consent. React and the native
// recogniser are faked so the real hook runs in node. The fake renders the hook like React
// does: hooks are matched by call order, and refs and state survive re-renders.
import type { ListenerState } from '../../speech/useListener';

type Handler = (e?: unknown) => void;
const handlers: Record<string, Handler> = {};

const fakeReact = {
  slots: [] as unknown[],
  i: 0,
  effects: [] as (() => void | (() => void))[],
  cleanups: [] as (() => void)[],
  firstRender: true,
};

jest.mock('react', () => {
  const slot = <T,>(init: () => T): { value: T; index: number } => {
    const index = fakeReact.i++;
    if (!(index in fakeReact.slots)) fakeReact.slots[index] = init();
    return { value: fakeReact.slots[index] as T, index };
  };
  return {
    useRef: (v: unknown) => slot(() => ({ current: v })).value,
    useState: (v: unknown) => {
      const { value, index } = slot(() => v);
      const set = (next: unknown) => {
        fakeReact.slots[index] = typeof next === 'function' ? (next as (p: unknown) => unknown)(fakeReact.slots[index]) : next;
      };
      return [value, set];
    },
    useCallback: (fn: unknown) => fn,
    useLayoutEffect: (fn: () => void) => fn(),
    useEffect: (fn: () => void | (() => void)) => {
      if (fakeReact.firstRender) fakeReact.effects.push(fn);
    },
  };
});

const native = {
  onDevice: true,
  locales: [] as string[], // what getSupportedLocales() lists; [] means "no list" (unknown)
  permission: Promise.resolve({ granted: true }) as Promise<{ granted: boolean }>,
  start: jest.fn(),
  stop: jest.fn(),
  abort: jest.fn(),
};

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    isRecognitionAvailable: () => true,
    supportsOnDeviceRecognition: () => native.onDevice,
    supportsRecording: () => false,
    getSupportedLocales: async () => ({ locales: native.locales, installedLocales: [] }),
    requestPermissionsAsync: () => native.permission,
    start: (o: unknown) => native.start(o),
    stop: () => native.stop(),
    abort: () => native.abort(),
  },
  useSpeechRecognitionEvent: (name: string, fn: Handler) => {
    handlers[name] = fn;
  },
}));
jest.mock('../../store/recordings', () => ({ recordingsFolderUri: () => 'file:///recordings/' }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useListener } = require('../../speech/useListener') as typeof import('../../speech/useListener');

type Opts = NonNullable<Parameters<typeof useListener>[1]>;
type Listener = ReturnType<typeof useListener>;

function mount(opts: Opts = {}) {
  fakeReact.slots = [];
  fakeReact.effects = [];
  fakeReact.cleanups = [];
  fakeReact.firstRender = true;
  let current = opts;
  const hints: string[] = [];
  // A "component" to React lint: it calls the hook the way a screen would.
  const Render = (): Listener => {
    fakeReact.i = 0;
    const out = useListener(hints, current);
    if (fakeReact.firstRender) {
      fakeReact.firstRender = false;
      for (const fx of fakeReact.effects) {
        const c = fx();
        if (c) fakeReact.cleanups.push(c);
      }
    }
    return out;
  };
  Render();
  return {
    /** The hook's values as of now (re-renders, like React after a state change). */
    get l() {
      return Render();
    },
    rerender(next: Opts) {
      current = next;
      Render();
    },
    unmount() {
      fakeReact.cleanups.forEach((c) => c());
    },
  };
}

const emit = (name: string, e?: unknown) => handlers[name]?.(e);
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
const heard = (text: string) => emit('result', { isFinal: false, results: [{ transcript: text }] });

/** The contract screens rely on: the error card shows iff state === 'error'. */
function expectContract(l: Listener) {
  expect(l.error !== null).toBe(l.state === 'error');
  expect(l.errorCode !== null).toBe(l.state === 'error');
}

async function listening(opts: Opts = {}) {
  const h = mount(opts);
  await h.l.start();
  await flush();
  emit('start');
  return h;
}

beforeEach(() => {
  jest.useFakeTimers();
  native.onDevice = true;
  native.locales = [];
  native.permission = Promise.resolve({ granted: true });
  native.start.mockClear();
  native.stop.mockClear();
  native.abort.mockClear();
});
afterEach(() => jest.useRealTimers());

describe('routine recogniser glitches never show "stopped listening" over a working read', () => {
  it.each(['audio-capture', 'network', 'busy', 'client', 'speech-timeout', 'no-speech'])(
    'carries on listening after %s',
    async (code) => {
      const h = await listening();
      emit('error', { error: code, message: 'native text' });
      emit('end');
      jest.advanceTimersByTime(1000);
      expect(native.start).toHaveBeenCalledTimes(2); // restarted
      emit('start');
      heard('the night shift');
      expect(h.l.state).toBe('listening');
      expect(h.l.error).toBeNull();
      expectContract(h.l);
    },
  );

  it('gives up with a way back when glitches keep coming and nothing is heard', async () => {
    const h = await listening();
    for (let i = 0; i < 3; i++) {
      emit('error', { error: 'audio-capture', message: '' });
      emit('end');
      jest.advanceTimersByTime(1000);
    }
    expect(h.l.state).toBe('error');
    expect(h.l.errorCode).toBe('repeated-failure');
    expectContract(h.l);
    const starts = native.start.mock.calls.length;
    emit('end');
    jest.advanceTimersByTime(5000);
    expect(native.start).toHaveBeenCalledTimes(starts); // no more restarts
  });

  it('tells the reader to check the mic when glitches keep coming and nothing is heard', async () => {
    const h = await listening();
    for (let i = 0; i < 3; i++) {
      emit('error', { error: 'audio-capture', message: '' });
      emit('end');
      jest.advanceTimersByTime(1000);
    }
    expect(h.l.error).toBe('It tried 3 times and didn’t catch any words. Check nothing is covering the mic, or switch off headphones, then try again.');
  });

  it('says the speech service couldn’t be reached when the network keeps failing, with its own code', async () => {
    const h = await listening();
    for (let i = 0; i < 3; i++) {
      emit('error', { error: 'network', message: '' });
      emit('end');
      jest.advanceTimersByTime(1000);
    }
    expect(h.l.state).toBe('error');
    expect(h.l.errorCode).toBe('network');
    expect(h.l.error).toBe('The speech service couldn’t be reached. When you’re back online, tap Try again.');
    expectContract(h.l);
  });

  it('does not give up on 3 glitches spread over more than 10 seconds', async () => {
    const h = await listening();
    for (let i = 0; i < 3; i++) {
      emit('error', { error: 'audio-capture', message: '' });
      emit('end');
      jest.advanceTimersByTime(6000); // 0 s, 6 s, 12 s: never 3 inside one 10 s window
      emit('start');
    }
    expect(h.l.state).toBe('listening');
    expect(native.start).toHaveBeenCalledTimes(4);
    expectContract(h.l);
  });

  it('starts counting again after a word is heard between glitches', async () => {
    const h = await listening();
    const glitch = () => {
      emit('error', { error: 'busy', message: '' });
      emit('end');
      jest.advanceTimersByTime(1000);
      emit('start');
    };
    glitch();
    glitch();
    heard('the night');
    glitch(); // third glitch inside 10 s, but only the first since words came through
    expect(h.l.state).toBe('listening');
    expectContract(h.l);
  });

  it('does not give up while words are still coming through between glitches', async () => {
    const h = await listening();
    for (let i = 0; i < 6; i++) {
      emit('error', { error: 'network', message: '' });
      emit('end');
      jest.advanceTimersByTime(1000);
      emit('start');
      heard(`word ${i}`);
    }
    expect(h.l.state).toBe('listening');
    expectContract(h.l);
  });
});

describe('errors that really stop listening', () => {
  it('reports an unsupported language and does not restart', async () => {
    const h = await listening({ lang: 'en-PH' });
    emit('error', { error: 'language-not-supported', message: '' });
    emit('end');
    jest.advanceTimersByTime(1000);
    expect(h.l.state).toBe('error');
    expect(h.l.errorCode).toBe('language-not-supported');
    expect(h.l.error).toBe('This phone can’t listen for Filipino English. Choose a different English in the You tab.');
    expect(native.start).toHaveBeenCalledTimes(1);
    expectContract(h.l);
  });

  it('stops for a phone call or app switch instead of fighting for the mic', async () => {
    const h = await listening();
    emit('error', { error: 'interrupted', message: '' });
    emit('end');
    jest.advanceTimersByTime(1000);
    expect(h.l.state).toBe('error');
    expect(h.l.errorCode).toBe('interrupted');
    expect(native.start).toHaveBeenCalledTimes(1);
    expectContract(h.l);
  });

  it('keeps showing denied after the recogniser ends', async () => {
    const h = await listening();
    emit('error', { error: 'not-allowed', message: '' });
    emit('end');
    expect(h.l.state).toBe<ListenerState>('denied');
    expectContract(h.l);
  });

  it('clears the error when the reader tries again', async () => {
    const h = await listening();
    emit('error', { error: 'interrupted', message: '' });
    emit('end');
    await h.l.start();
    await flush();
    emit('start');
    expect(h.l.state).toBe('listening');
    expectContract(h.l);
  });
});

describe('the mic never turns on after the screen has closed', () => {
  it('does not start if the screen closes during the permission prompt', async () => {
    let grant!: (v: { granted: boolean }) => void;
    native.permission = new Promise((r) => (grant = r));
    const h = mount();
    const started = h.l.start();
    await flush();
    h.unmount();
    grant({ granted: true });
    await started;
    await flush();
    expect(native.start).not.toHaveBeenCalled();
  });

  it('does not start if the screen closes while the locale is being checked', async () => {
    native.onDevice = false;
    const h = mount({ allowServer: true });
    const started = h.l.start();
    h.unmount();
    await started;
    await flush();
    expect(native.start).not.toHaveBeenCalled();
  });

  it('does not start if the reader stops during the permission prompt', async () => {
    let grant!: (v: { granted: boolean }) => void;
    native.permission = new Promise((r) => (grant = r));
    const h = mount();
    const started = h.l.start();
    await flush();
    void h.l.stop();
    grant({ granted: true });
    await started;
    await flush();
    expect(native.start).not.toHaveBeenCalled();
  });

  it('does not restart after unmount when a glitch restart was pending', async () => {
    const h = await listening();
    emit('error', { error: 'busy', message: '' });
    emit('end');
    h.unmount();
    jest.advanceTimersByTime(5000);
    expect(native.start).toHaveBeenCalledTimes(1);
  });
});

describe('server consent follows the profile, with a one-session yes from MicGate', () => {
  it('turning server recognition off takes effect at the next restart', async () => {
    native.onDevice = false;
    const h = await listening({ allowServer: true });
    expect(native.start).toHaveBeenCalledTimes(1);
    h.rerender({ allowServer: false });
    emit('end');
    jest.advanceTimersByTime(1000);
    expect(native.start).toHaveBeenCalledTimes(1);
    expect(h.l.state).toBe('needs-consent');
  });

  it('a yes from MicGate lasts through restarts of that session', async () => {
    native.onDevice = false;
    const h = mount({ allowServer: false });
    await h.l.start({ allowServer: true });
    await flush();
    emit('start');
    emit('end');
    jest.advanceTimersByTime(1000);
    expect(native.start).toHaveBeenCalledTimes(2);
    expect(h.l.state).toBe('listening');
  });

  it('a yes from MicGate does not carry into the next session', async () => {
    native.onDevice = false;
    const h = mount({ allowServer: false });
    await h.l.start({ allowServer: true });
    await flush();
    emit('start');
    void h.l.stop();
    emit('end');
    await h.l.start();
    await flush();
    expect(h.l.state).toBe('needs-consent');
    expect(native.start).toHaveBeenCalledTimes(1);
  });
});

describe('needs-consent is never hidden by the recogniser ending', () => {
  it('stays needs-consent when an end arrives after the gate asked', async () => {
    native.onDevice = false;
    const h = mount({ allowServer: false });
    await h.l.start();
    await flush();
    expect(h.l.state).toBe('needs-consent');
    emit('end');
    expect(h.l.state).toBe('needs-consent');
    expectContract(h.l);
  });

  it('stays needs-consent when consent went away mid-read and the recogniser then ends', async () => {
    native.onDevice = false;
    const h = await listening({ allowServer: true });
    h.rerender({ allowServer: false });
    emit('end');
    jest.advanceTimersByTime(1000);
    expect(h.l.state).toBe('needs-consent');
    emit('end');
    jest.advanceTimersByTime(1000);
    expect(h.l.state).toBe('needs-consent');
    expect(native.start).toHaveBeenCalledTimes(1);
  });
});

describe('Carry on after a call, Siri or an alarm keeps the read so far', () => {
  async function interruptedAfter(text: string, opts: Opts = {}) {
    const h = await listening(opts);
    emit('result', { isFinal: true, results: [{ transcript: text }] });
    emit('error', { error: 'interrupted', message: '' });
    emit('end');
    return h;
  }

  it('offers Carry on after an interruption, and resuming keeps the transcript', async () => {
    const h = await interruptedAfter('the night shift');
    expect(h.l.canResume).toBe(true);
    await h.l.resume();
    await flush();
    emit('start');
    expect(native.start).toHaveBeenCalledTimes(2);
    expect(h.l.state).toBe('listening');
    expect(h.l.canResume).toBe(false);
    expectContract(h.l);
    expect(h.l.transcript).toBe('the night shift');
    heard('began at');
    expect(h.l.transcript).toBe('the night shift began at');
  });

  it('keeps words that were still interim when the call came in', async () => {
    const h = await listening();
    heard('the night');
    emit('error', { error: 'interrupted', message: '' }); // no end event before Carry on
    await h.l.resume();
    await flush();
    emit('start');
    heard('shift began');
    expect(h.l.transcript).toBe('the night shift began');
  });

  it.each(['network', 'repeated-failure'] as const)('offers Carry on after a %s give-up', async (code) => {
    const h = await listening();
    heard('the night');
    for (let i = 0; i < 3; i++) {
      emit('error', { error: code === 'network' ? 'network' : 'audio-capture', message: '' });
      emit('end');
      jest.advanceTimersByTime(1000);
    }
    expect(h.l.errorCode).toBe(code);
    expect(h.l.canResume).toBe(true);
    await h.l.resume();
    await flush();
    emit('start');
    expect(h.l.state).toBe('listening');
    expect(h.l.transcript).toBe('the night');
  });

  it('says Carry on picks up where you were when a restart fails', async () => {
    const h = await listening();
    native.start.mockImplementationOnce(() => {
      throw new Error('busy');
    });
    emit('end');
    jest.advanceTimersByTime(1000);
    expect(h.l.errorCode).toBe('restart-failed');
    expect(h.l.error).toBe('The phone stopped listening. Tap Carry on to pick up where you were.');
    expect(h.l.canResume).toBe(true);
  });

  it('does not offer Carry on when the phone can’t listen for that English', async () => {
    const h = await listening({ lang: 'en-PH' });
    heard('the night');
    emit('error', { error: 'language-not-supported', message: '' });
    emit('end');
    expect(h.l.canResume).toBe(false);
    await h.l.resume();
    await flush();
    expect(native.start).toHaveBeenCalledTimes(1);
    expect(h.l.state).toBe('error');
    expect(h.l.errorCode).toBe('language-not-supported');
  });

  it('does nothing while listening normally', async () => {
    const h = await listening();
    expect(h.l.canResume).toBe(false);
    await h.l.resume();
    await flush();
    expect(native.start).toHaveBeenCalledTimes(1);
  });

  it('does not turn the mic on after the screen has closed', async () => {
    const h = await interruptedAfter('the night shift');
    const resume = h.l.resume;
    h.unmount();
    await resume();
    await flush();
    expect(native.start).toHaveBeenCalledTimes(1);
  });

  it('does not turn the mic on if the screen closes during the permission prompt', async () => {
    const h = await interruptedAfter('the night shift');
    let grant!: (v: { granted: boolean }) => void;
    native.permission = new Promise((r) => (grant = r));
    const resumed = h.l.resume();
    await flush();
    h.unmount();
    grant({ granted: true });
    await resumed;
    await flush();
    expect(native.start).toHaveBeenCalledTimes(1);
  });

  it('asks for consent again instead of using the server, then still keeps the read', async () => {
    native.onDevice = false;
    const h = mount({ allowServer: false });
    await h.l.start({ allowServer: true }); // MicGate's yes, for that session only
    await flush();
    emit('start');
    emit('result', { isFinal: true, results: [{ transcript: 'the night shift' }] });
    emit('error', { error: 'interrupted', message: '' });
    emit('end');
    await h.l.resume();
    await flush();
    expect(native.start).toHaveBeenCalledTimes(1); // not the server without a yes
    expect(h.l.state).toBe('needs-consent');
    expectContract(h.l);
    await h.l.start({ allowServer: true }); // MicGate again
    await flush();
    emit('start');
    expect(native.start).toHaveBeenCalledTimes(2);
    expect(h.l.transcript).toBe('the night shift');
  });

  it('re-checks the language on resume and stops for good if the phone can’t do it', async () => {
    native.onDevice = false;
    const h = await interruptedAfter('the night shift', { allowServer: true, lang: 'en-PH' });
    native.locales = ['en-US'];
    await h.l.resume();
    await flush();
    expect(native.start).toHaveBeenCalledTimes(1);
    expect(h.l.errorCode).toBe('language-not-supported');
    expect(h.l.canResume).toBe(false);
  });

  it('Try again after an interruption still starts a fresh read', async () => {
    const h = await interruptedAfter('the night shift');
    await h.l.start();
    await flush();
    emit('start');
    expect(h.l.transcript).toBe('');
  });
});

describe('per-session diagnostics for tester mode: codes and counts only', () => {
  it('counts quiet restarts and glitches by code', async () => {
    const h = await listening();
    emit('error', { error: 'network', message: 'Error Domain=kAFAssistantErrorDomain Code=1101' });
    emit('end');
    jest.advanceTimersByTime(1000);
    emit('error', { error: 'audio-capture', message: 'route change' });
    emit('end');
    jest.advanceTimersByTime(1000);
    emit('end'); // iOS ending on its own: a restart, not a glitch
    jest.advanceTimersByTime(1000);
    expect(h.l.getDiagnostics()).toEqual({ restarts: 3, glitches: { network: 1, 'audio-capture': 1 } });
  });

  it('never keeps native message text, even if a code looks like free text', async () => {
    const h = await listening();
    emit('error', { error: 'Something odd: the night shift', message: 'the night shift' });
    expect(h.l.getDiagnostics().glitches).toEqual({ other: 1 });
  });

  it('keeps counting across Carry on, and starts at zero for a new attempt', async () => {
    const h = await listening();
    emit('error', { error: 'busy', message: '' });
    emit('end');
    jest.advanceTimersByTime(1000);
    emit('error', { error: 'interrupted', message: '' });
    await h.l.resume();
    await flush();
    expect(h.l.getDiagnostics()).toEqual({ restarts: 1, glitches: { busy: 1 } });
    h.l.reset();
    expect(h.l.getDiagnostics()).toEqual({ restarts: 0, glitches: {} });
    emit('error', { error: 'busy', message: '' });
    await h.l.start();
    await flush();
    expect(h.l.getDiagnostics()).toEqual({ restarts: 0, glitches: {} });
  });

  it('hands back a copy, so a saved snapshot doesn’t change later', async () => {
    const h = await listening();
    const before = h.l.getDiagnostics();
    emit('error', { error: 'busy', message: '' });
    expect(before).toEqual({ restarts: 0, glitches: {} });
  });
});
