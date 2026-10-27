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
    getSupportedLocales: async () => ({ locales: [], installedLocales: [] }),
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

  it('says it’s the connection when the network keeps failing', async () => {
    const h = await listening();
    for (let i = 0; i < 3; i++) {
      emit('error', { error: 'network', message: '' });
      emit('end');
      jest.advanceTimersByTime(1000);
    }
    expect(h.l.state).toBe('error');
    expect(h.l.error).toMatch(/connection/i);
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
