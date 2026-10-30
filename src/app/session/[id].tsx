import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  align,
  contextualHints,
  preparePassage,
  skippedWords,
  stumbledContexts,
  stumbledWords,
  tokenise,
  withCorrections,
} from '../../engine/align';
import { PACE_BANDS, PaceContext, pacerIndex, pacerWpm, paceZone, sessionScore, wordsPerMinute } from '../../engine/score';
import type { Passage } from '../../content/passages';
import { resolvePassage, sourceOf } from '../../content/resolve';
import { keptCorrections, loadSessions, saveSession } from '../../store/sessions';
import { loadScripts } from '../../content/scripts';
import { getMoment } from '../../content/moments';
import { canColdRead, canRehearse, isFreeRun, isScriptPassage, partReached, rehearseWall, trackFreeRunComplete } from '../../pro';
import { deleteRecordingFiles } from '../../store/recordings';
import { encodeStatuses } from '../../engine/review';
import { paceSegments, paceSteadiness } from '../../engine/steadiness';
import { recordCorrection, recordWords, resultsFromSession } from '../../store/words';
import { useProfile } from '../../store/profile';
import { markStep } from '../../plan';
import { track } from '../../analytics';
import { listenLocale, useListener } from '../../speech/useListener';
import { GlideWord, WordBox } from '../../components/GlideWord';
import { InkCursor } from '../../components/InkCursor';
import { useVoiceLevel, VoiceRibbon } from '../../components/VoiceRibbon';
import { MicGate, gateStates } from '../../components/MicGate';
import { ListenError } from '../../components/ListenError';
import { space, useColors } from '../../theme';
import { DICTIONARY, packPassageId } from '../../content/wordpacks';
import { clock, LENGTH_LABEL, lengthZone, spokenClock, targetForPassage } from '../../content/targets';
import { noteRoughPatch } from '../../rating';
import { isLost, pauseAfter, progressKind } from '../../glide';

const MIN_WORDS_TO_SCORE = 15;

function defaultPace(id: string): PaceContext {
  return id.startsWith('s.') ? 'presenting' : 'reading';
}

/** Route params come from anywhere (deep links too): only a pace band we have counts. */
function paceParam(pace: string | undefined, id: string): PaceContext {
  return pace && Object.prototype.hasOwnProperty.call(PACE_BANDS, pace) ? (pace as PaceContext) : defaultPace(id);
}

export default function GlideSession() {
  const { id, cold, step, pace: paceRaw } = useLocalSearchParams<{ id: string; cold?: string; step?: string; pace?: string }>();
  const colors = useColors();
  const { profile, ready } = useProfile();
  const [passage, setPassage] = useState<Passage | null | undefined>(undefined);
  // Whether this read is the free reader's one free script run (pro.ts). Undefined until checked.
  const [freeRun, setFreeRun] = useState<{ yes: boolean; day1At?: number; target?: number }>();

  useEffect(() => {
    resolvePassage(id ?? '').then((p) => setPassage(p ?? null));
  }, [id]);

  // The one rehearse and cold-read gate. PlanCard, scripts/[id], Today, the Tape's "Read it
  // again" and deep links all land here, so a script part never starts without canRehearse()
  // saying yes, and a cold read never starts without canColdRead(). Waits for the profile, so a
  // Pro reader opening a deep link at launch isn't walled by the default profile.
  const momentDef = getMoment(profile.moment?.id);
  const momentPackId = momentDef?.packId;
  const momentScriptId = profile.moment?.scriptId;
  const pace = passage ? paceParam(paceRaw, passage.id) : 'reading';
  useEffect(() => {
    if (!ready || !passage) return;
    let live = true;
    // Replace, not push: closing the wall goes back to where they came from, never into a
    // session that would start the mic.
    const wall = (feature: string) => router.replace({ pathname: '/paywall', params: { feature } });
    // The moment's final run-through (plan step 5) is the one free cold read.
    const retestPassageId = momentPackId ? packPassageId(momentPackId, 1) : undefined;
    if (cold === '1' && !canColdRead({ pro: profile.pro, passageId: passage.id, retestPassageId })) {
      wall('cold');
      return;
    }
    // The target length (your own scripts only) loads alongside, so the footer chip is there from the start.
    const target = targetForPassage(passage.id, { def: momentDef, scriptId: momentScriptId }, pace);
    Promise.all([loadSessions(), target]).then(([sessions, targetSeconds]) => {
      if (!live) return;
      const args = { pro: profile.pro, sessions, passageId: passage.id };
      if (!canRehearse(args)) {
        wall(rehearseWall(args));
        return;
      }
      setFreeRun({ yes: isFreeRun(args), day1At: sessions.find((s) => s.passageId === 'baseline')?.at, target: targetSeconds });
    });
    return () => {
      live = false;
    };
  }, [ready, passage, profile.pro, cold, momentPackId, momentDef, momentScriptId, pace]);

  if (passage === undefined || (passage && !freeRun)) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (passage === null) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <Text style={[styles.body, { color: colors.ink }]}>That passage doesn’t exist.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.link, { color: colors.muted }]}>Go back</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <GlideSessionView
      passage={passage}
      cold={cold === '1'}
      step={step}
      pace={pace}
      freeRun={freeRun!.yes}
      day1At={freeRun!.day1At}
      targetSeconds={freeRun!.target}
    />
  );
}

/** The free run's counts for analytics: never the script's words, only how many. */
async function trackFreeRun(passageId: string, moment: string | null, words: number, wpm: number, stumbled: number, day1At?: number) {
  const scriptId = /^s\.(\d+)\./.exec(passageId)?.[1];
  const parts = (await loadScripts()).find((s) => s.id === scriptId)?.chunks.length ?? null;
  trackFreeRunComplete({ moment, words, parts, wpm, stumbled, day1At });
}

function GlideSessionView({
  passage,
  cold,
  step,
  pace,
  freeRun,
  day1At,
  targetSeconds,
}: {
  passage: Passage;
  cold: boolean;
  step?: string;
  pace: PaceContext;
  freeRun: boolean;
  day1At?: number;
  /** Your own script's target length (content/targets.ts). Undefined: no time chip. */
  targetSeconds?: number;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { profile, update } = useProfile();

  const words = useMemo(() => preparePassage(passage.text), [passage]);
  const [revealed, setRevealed] = useState(!cold);
  const hints = useMemo(() => contextualHints(words), [words]);
  const { level, onLevel } = useVoiceLevel();
  const isBaseline = passage.id === 'baseline';
  const tester = profile.testerMode === true;
  // When the voice first rises above the noise floor: with the first inked word, gives highlight lag.
  const voiceAt = useRef(0);
  const onVoice = useCallback(
    (l: number) => {
      onLevel(l);
      if (l > 0.25 && !voiceAt.current) voiceAt.current = Date.now();
    },
    [onLevel],
  );
  const listener = useListener(hints, {
    allowServer: profile.allowServerRecognition,
    // Explicit yes only: Day 1 with "keep recordings" on, or every read in supervised tester mode.
    record: (isBaseline && profile.keepRecordings === true) || tester,
    onLevel: onVoice,
    lang: listenLocale(profile.speechLang),
  });

  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState<string | null>(null);
  const [breathFilled, setBreathFilled] = useState<Set<number>>(new Set());
  const [corrected, setCorrected] = useState<Set<number>>(new Set());
  const [tooShort, setTooShort] = useState(false);
  // Finish tapped early on the free run: ask first (see requestFinish).
  const [confirmEarly, setConfirmEarly] = useState(false);
  const sentenceEnds = useMemo(() => words.map((w) => w.sentenceEnd), [words]);

  const startedAt = useRef(0); // first recognised word, so a slow start doesn't hurt pace
  const lastAdvanceAt = useRef(0);
  const prevNext = useRef(0);
  const prevReread = useRef<number | undefined>(undefined); // align's rereadingAt at the last update
  const pauses = useRef(0);
  const skipToastShown = useRef(false);
  const finished = useRef(false);
  const firstWordLag = useRef<number | undefined>(undefined);
  const reachedAt = useRef<(number | undefined)[]>([]); // when Glide first reached each word, for steadiness
  // When the read stopped mid-way without being over: a consent ask (MicGate) or the error card
  // (e.g. iOS `interrupted` by a call). 0 while listening. See the pause effect below.
  const pausedAt = useRef(0);
  const boxes = useRef<WordBox[]>([]);
  const scroller = useRef<ScrollViewInstance>(null);
  const [toast] = useState(() => new Animated.Value(0));

  const onMeasure = useCallback((idx: number, box: Partial<WordBox>) => {
    boxes.current[idx] = { ...(boxes.current[idx] ?? { x: 0, y: 0, w: 0, h: 0 }), ...box };
  }, []);

  const heard = useMemo(() => tokenise(listener.transcript), [listener.transcript]);
  const raw = useMemo(() => align(words, heard), [words, heard]);
  const a = useMemo(() => withCorrections(raw, corrected), [raw, corrected]);

  useEffect(() => {
    track('session_start', { kind: passage.id.split('.')[0], pace, cold });
    if (!cold) listener.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // Timing refs are read during render on purpose: the 250 ms clock re-renders the screen, and
  // moving them into state would add renders to Glide's hot path. Nothing here writes a ref.
  // While paused the clock stands still, so live pace and the pacer don't sag during a call.
  // eslint-disable-next-line react-hooks/refs -- startedAt is set once by the pointer effect; the clock re-renders
  const seconds = startedAt.current ? ((pausedAt.current || now) - startedAt.current) / 1000 : 0;
  const wpm = wordsPerMinute(a.spoken, seconds);
  const zone = paceZone(wpm, pace);
  const pacerAt = pacerWpm(pace);
  const pacer = pacerIndex(seconds, pacerAt, words.length);

  const showToast = useCallback(
    (text: string) => {
      setNotice(text);
      toast.setValue(1);
      Animated.timing(toast, { toValue: 0, duration: 600, delay: 3000, useNativeDriver: true }).start(() => setNotice(null));
    },
    [toast],
  );

  // A tap only marks the word. Whether it's logged as a correction is decided at Finish
  // (keptCorrections): the recogniser may still ink it, and then it wasn't a miss.
  const onCorrect = useCallback((idx: number) => {
    setCorrected((s) => new Set(s).add(idx));
    Haptics.selectionAsync().catch(() => {});
  }, []);

  // React to the pointer moving: pauses, breath marks, haptics, auto-scroll.
  useEffect(() => {
    if (heard.length && !startedAt.current) {
      startedAt.current = Date.now();
      lastAdvanceAt.current = Date.now();
      if (voiceAt.current) firstWordLag.current = startedAt.current - voiceAt.current;
    }
    // A re-read behind the pointer holds the pointer but is still reading: it resets the clock
    // for the lost nudge and the next pause, and nothing else (glide.ts).
    const wasRereading = prevReread.current !== undefined;
    const kind = progressKind({ next: prevNext.current, rereadingAt: prevReread.current }, { next: a.next, rereadingAt: a.rereadingAt });
    prevReread.current = a.rereadingAt;
    if (kind === 'none') return;
    if (kind === 'reread') {
      lastAdvanceAt.current = Date.now();
      return;
    }

    const t = Date.now();
    const gap = t - lastAdvanceAt.current;
    // Capture the index now: the state updater runs later, after prevNext has moved on.
    const beforeIdx = prevNext.current - 1;
    const before = words[beforeIdx];
    const pause = before ? pauseAfter({ gapMs: gap, breathAfter: !!before.breathAfter, rereading: wasRereading || a.rereadingAt !== undefined }) : 'none';
    if (pause === 'breath') setBreathFilled((s) => new Set(s).add(beforeIdx));
    else if (pause === 'mid') pauses.current++;
    for (let k = prevNext.current; k < a.next; k++) {
      // Keep the first time: if the recogniser revises and the pointer steps back, the reader still said it then.
      reachedAt.current[k] ??= t;
      if (words[k]?.sentenceEnd) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    if (a.skipped > 0 && !skipToastShown.current) {
      skipToastShown.current = true;
      showToast('Missed words turn red. If you did say it, tap the word.');
    }

    // Keep the current line about 30% down the screen. Word y is measured inside the
    // passage block, which sits below a top padding of 12% of the screen height.
    const pos = boxes.current[Math.min(a.next, words.length - 1)];
    if (pos) scroller.current?.scrollTo({ y: Math.max(0, pos.y + height * 0.12 - height * 0.3), animated: true });

    prevNext.current = a.next;
    lastAdvanceAt.current = t;
  }, [a.next, a.rereadingAt, a.skipped, heard.length, words, height, showToast]);

  // The listener can stop mid-read without the read being over:
  // - 'needs-consent': on-device recognition went away at a restart, so MicGate asks.
  // - 'error': the recogniser stopped for good (e.g. iOS `interrupted` by a phone call). The card
  //   offers Carry on (resumeAfterError: keeps the transcript) or Start over (retry).
  // Either way the time away isn't reading. Stamp when it began; if listening resumes with the
  // transcript kept, move the clock forward by the time away, so it doesn't count toward pace,
  // the pacer or the gap that makes a pause. Only the first stamp counts (error, then a consent
  // ask on resume, is one pause, shifted once). retry() clears the stamp, since it restarts the
  // clock anyway. reachedAt is left alone on purpose: the step across a pause includes the
  // screen, the tap and the recogniser starting again, so it's over the 2.5 s that steadiness
  // drops as a stop.
  useEffect(() => {
    if (listener.state === 'needs-consent' || listener.state === 'error') {
      if (startedAt.current && !pausedAt.current) pausedAt.current = Date.now();
      // No word yet: the voice we heard before the pause isn't the start of the read.
      if (!startedAt.current) voiceAt.current = 0;
    } else if (listener.state === 'listening' && pausedAt.current) {
      const away = Date.now() - pausedAt.current;
      startedAt.current += away;
      lastAdvanceAt.current += away;
      pausedAt.current = 0;
      // Back to the line being read: MicGate (a consent ask on the way back) replaced the passage,
      // so the scroll position may have been lost. prevNext is where the pointer is.
      const pos = boxes.current[Math.min(prevNext.current, words.length - 1)];
      if (pos) scroller.current?.scrollTo({ y: Math.max(0, pos.y + height * 0.12 - height * 0.3), animated: false });
    }
  }, [listener.state, words.length, height]);

  /**
   * The alignment to save. Live, align() holds a jump until its words are 2 from the end of what
   * was heard (the recogniser may still rewrite them). At the end nothing more is coming, so every
   * heard word counts as settled; otherwise a jump waiting at the last word would never land.
   */
  const settledAlignment = useCallback(() => {
    const finalRaw = align(words, heard, heard.length);
    return { finalRaw, fin: withCorrections(finalRaw, corrected) };
  }, [words, heard, corrected]);

  const finish = useCallback(async () => {
    if (finished.current) return;
    finished.current = true;
    setConfirmEarly(false);
    const { finalRaw, fin } = settledAlignment();
    // Finish from the error card: the recogniser has already stopped, so don't wait on it.
    const recordings = listener.state === 'error' ? listener.recordings : await listener.stop();
    if (fin.spoken < MIN_WORDS_TO_SCORE) {
      // Stay finished (the mic is off) until they choose Try again. Don't keep audio we won't use.
      deleteRecordingFiles(recordings);
      track('session_too_short', { spoken: fin.spoken });
      setTooShort(true);
      return;
    }
    // Up to the pause if there is one: Finish from the error card saves the words read before the
    // call, timed up to the call, not up to now.
    const endedAt = pausedAt.current || Date.now();
    const secs = Math.max(1, (endedAt - startedAt.current) / 1000);
    const fillersPerMin = +(fin.fillerCount / (secs / 60)).toFixed(1);
    const attempted = fin.read + fin.skipped;
    const accuracy = attempted ? Math.round((fin.read / attempted) * 100) : 0;
    // The recogniser's statuses (raw), not the corrected ones: a word the reader tapped as said
    // was still a skip when Glide stamped its timing, so its steps can't be timed.
    const segments = paceSegments(words, reachedAt.current, finalRaw.status);
    const steady = paceSteadiness(segments);
    const stats = { wpm: wordsPerMinute(fin.spoken, secs), fillersPerMin, accuracy, midSentencePauses: pauses.current, seconds: secs, steadiness: steady?.score };
    const topFiller = Object.entries(fin.fillers).sort((x, y) => y[1] - x[1])[0]?.[0];
    const stumbled = stumbledWords(words, fin);
    // Taps the recogniser didn't overrule by inking the word itself (see keptCorrections).
    const kept = keptCorrections(finalRaw.status, corrected);
    const isScript = isScriptPassage(passage.id);
    const reachedPart = isScript ? partReached(fin.next, sentenceEnds) : undefined;
    const sessionId = `${Date.now()}`;
    await saveSession({
      id: sessionId,
      passageId: passage.id,
      title: passage.title,
      at: Date.now(),
      wpm: stats.wpm,
      fillers: fin.fillerCount,
      fillersPerMin,
      topFiller,
      accuracy,
      pauses: pauses.current,
      seconds: Math.round(secs),
      score: sessionScore(stats, pace),
      stumbled,
      context: pace,
      readCount: fin.read,
      skippedWords: skippedWords(words, fin),
      stumbledContext: stumbledContexts(words, fin, stumbled),
      corrected: kept.map((i) => words[i].display.replace(/[^A-Za-z'’-]/g, '')),
      recordings: recordings.length ? recordings : undefined,
      habits: fin.habitCount ? fin.habits : undefined,
      segments: segments.length ? segments : undefined,
      steadiness: steady?.score,
      partReached: reachedPart,
      targetSeconds,
      review: tester
        ? {
            // The recogniser's statuses, so a tapped word it still missed is 'c' (it was 'r' from
            // the corrected statuses, which hid every correction from /review). One it inked
            // later is 'r': it was heard.
            statuses: encodeStatuses(finalRaw.status, corrected),
            transcript: listener.transcript,
            marks: { said: [], notSaid: [] },
            firstWordLagMs: firstWordLag.current,
            listener: listener.getDiagnostics(),
          }
        : undefined,
    });
    await recordWords(resultsFromSession(words, fin));
    for (const i of kept) {
      await recordCorrection(words[i].display);
      // Never the word itself: a script's words are private. Length and source are enough to spot patterns.
      track('recognition_correction', {
        where: 'glide',
        source: sourceOf(passage.id),
        length: words[i].key.length,
        pack_word: DICTIONARY.has(words[i].key),
        position: Math.round((i / Math.max(1, words.length)) * 10) / 10,
      });
    }
    await markStep(profile, update, step);
    // A Pro reader's script run: if Pro lapses later, there's no "you just rehearsed" paywall
    // about it (pro.ts ahaPending). update() merges into the latest profile, after markStep.
    if (profile.pro && isScript && reachedPart && !profile.ahaPaywallShown) await update({ ahaPaywallShown: true });
    if (freeRun && reachedPart) trackFreeRun(passage.id, profile.moment?.id ?? null, words.length, stats.wpm, stumbled.length, day1At).catch(() => {});
    track('session_complete', {
      kind: passage.id.split('.')[0],
      pace,
      wpm: stats.wpm,
      accuracy,
      fillers_per_min: fillersPerMin,
      corrections: kept.length,
      steadiness: steady?.score ?? null,
      seconds: Math.round(secs),
      recorded: recordings.length > 0,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (isBaseline && !profile.onboarded) router.replace({ pathname: '/onboarding/day1', params: { id: sessionId } });
    else router.replace({ pathname: '/tape', params: { id: sessionId } });
  }, [settledAlignment, listener, passage, words, sentenceEnds, pace, corrected, profile, update, step, isBaseline, tester, freeRun, day1At, targetSeconds]);

  /**
   * The Finish button. On the free run, before Glide has reached most of part 1, it asks first:
   * a run only counts once it reaches the end (pro.ts partReached), and an early Finish there
   * saves nothing, so the free run is still theirs. Too few words go straight to finish(), which
   * shows the too-short card as usual.
   */
  const requestFinish = useCallback(() => {
    // Settled, like finish(): a jump waiting at the last word may already reach the end.
    const { fin } = settledAlignment();
    if (freeRun && fin.spoken >= MIN_WORDS_TO_SCORE && !partReached(fin.next, sentenceEnds)) setConfirmEarly(true);
    else finish();
  }, [freeRun, settledAlignment, sentenceEnds, finish]);

  /** "Stop here" on the early-Finish question: mic off, audio gone, nothing saved, back out. */
  const stopWithoutSaving = useCallback(async () => {
    if (finished.current) return;
    finished.current = true;
    const uris = listener.state === 'listening' ? await listener.stop() : listener.recordings;
    deleteRecordingFiles(uris);
    track('free_run_stopped', { reached: settledAlignment().fin.next, words: words.length });
    router.back();
  }, [listener, settledAlignment, words.length]);

  /** A real restart: clean transcript, timer, corrections, marks and pauses, then listen again. */
  const retry = useCallback(() => {
    listener.reset();
    startedAt.current = 0;
    voiceAt.current = 0;
    firstWordLag.current = undefined;
    reachedAt.current = [];
    lastAdvanceAt.current = 0;
    pausedAt.current = 0;
    prevNext.current = 0;
    prevReread.current = undefined;
    pauses.current = 0;
    skipToastShown.current = false;
    setCorrected(new Set());
    setBreathFilled(new Set());
    setNotice(null);
    setTooShort(false);
    setConfirmEarly(false);
    scroller.current?.scrollTo({ y: 0, animated: true });
    finished.current = false;
    track('session_retry', { where: 'glide' });
    // Returned so the error card's Try again stays disabled until the mic is starting.
    return listener.start();
  }, [listener]);

  /**
   * Try again after a recogniser error (e.g. it can't listen for this English). The mic may
   * still be on if the error wasn't fatal, so stop it first, and don't keep audio from an
   * attempt that won't be saved.
   */
  const retryAfterError = useCallback(async () => {
    finished.current = true; // no Finish or last-word save while the mic stops; retry() clears it
    const uris = listener.state === 'listening' ? await listener.stop() : listener.recordings;
    deleteRecordingFiles(uris);
    await retry();
  }, [listener, retry]);

  /**
   * Carry on after the recogniser stopped (a call, the connection, the mic). Keeps the transcript,
   * so the inked words, the pointer, corrections and breath marks all stay. The pause effect
   * above moves the clock forward by the time away once listening starts again. ListenError
   * disables its buttons while this runs, so it can't start twice.
   */
  const resumeAfterError = useCallback(async () => {
    if (finished.current) return; // Finish already saved or ended this read
    track('session_resume', { where: 'glide', error: listener.errorCode });
    await listener.resume();
  }, [listener]);

  // A too-short read or a recogniser that stopped: no rating ask this launch (rating.ts).
  const failedNow = listener.state === 'error';
  useEffect(() => {
    if (tooShort || failedNow) noteRoughPatch();
  }, [tooShort, failedNow]);

  // The session ends itself on the last word.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the recogniser reaching the last word; finish() is guarded by finished.current
    if (a.done) finish();
  }, [a.done, finish]);

  if (gateStates.includes(listener.state)) {
    return <MicGate state={listener.state} onAllowed={() => listener.start({ allowServer: true })} />;
  }

  // The recogniser stopped for good. A routine error while it's still listening (it restarts
  // by itself) shows nothing: the words are still inking in.
  const failed = listener.state === 'error';
  // eslint-disable-next-line react-hooks/refs -- read-only timing refs; see `seconds` above
  const lost = isLost({
    listening: listener.state === 'listening',
    started: startedAt.current > 0,
    done: a.done,
    rereading: a.rereadingAt !== undefined,
    now,
    lastProgressAt: lastAdvanceAt.current,
  });
  const offScript = heard.length >= 20 && a.read < 6;
  const zoneColor = zone === 'good' ? colors.good : zone === 'fast' ? colors.stumble : zone === 'slow' ? colors.ember : colors.line;
  // Word boxes are measured by onLayout into a ref; the cursor reads the latest one each render.
  const cursorBox = boxes.current[a.next];
  // Target length chip (your own scripts only): neutral, then amber "wrap up", then red "over
  // time". Colour and words together, never colour alone. Nothing moves; only the colour changes.
  const timeZone = targetSeconds ? lengthZone(seconds, targetSeconds) : undefined;
  const timeColor = timeZone === 'over' ? colors.stumble : timeZone === 'near' ? colors.ember : colors.muted;
  const timeLabel = timeZone ? LENGTH_LABEL[timeZone] : undefined;
  // eslint-disable-next-line react-hooks/refs -- read-only timing ref; see `seconds` above
  const showPacer = pacer !== null && startedAt.current > 0 && Math.abs(pacer - a.next) >= 2;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      {/* Top bar: close, title, position */}
      <View style={styles.top}>
        <Pressable hitSlop={12} onPress={() => router.back()} accessibilityLabel="Close session">
          <Text style={[styles.close, { color: colors.muted }]}>✕</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.muted }]} numberOfLines={1}>
          {passage.title}
        </Text>
        <Text style={[styles.count, { color: colors.muted }]}>
          {a.next} / {words.length}
        </Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: colors.line }]}>
        <View style={[styles.progressFill, { backgroundColor: colors.signal, width: `${(a.next / words.length) * 100}%` }]} />
      </View>
      {/* Static on purpose (principle 6): the reader should know, without anything moving. Web can't record. */}
      {tester && (
        <Text style={[styles.testerTag, { color: colors.muted }]}>{Platform.OS === 'web' ? 'Tester · not recording on web' : 'Recording · tester mode'}</Text>
      )}

      {/* The passage. Only the words, the ink cursor and the footer move. */}
      <ScrollView
        ref={scroller}
        contentContainerStyle={[styles.passage, { paddingTop: height * 0.12, paddingBottom: height * 0.5 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.flow}>
          {/* eslint-disable-next-line react-hooks/refs -- cursorBox comes from the measured-boxes ref (see above); reading it here is what moves the cursor */}
          <InkCursor box={cursorBox} color={colors.signalSoft} visible={listener.state === 'listening' && !a.done} />
          {words.map((w, i) => (
            <GlideWord
              key={i}
              index={i}
              display={w.display}
              status={a.status[i]}
              corrected={corrected.has(i)}
              isPacer={showPacer && pacer === i}
              breath={w.breathAfter ? (breathFilled.has(i) ? 'filled' : 'open') : 'none'}
              colors={colors}
              onMeasure={onMeasure}
              onCorrect={onCorrect}
            />
          ))}
        </View>
      </ScrollView>

      {!revealed && (
        <Pressable
          style={[styles.cold, { backgroundColor: colors.bg }]}
          onPress={() => {
            setRevealed(true);
            listener.start();
          }}
          accessibilityRole="button"
        >
          <Text style={[styles.coldEyebrow, { color: colors.muted }]}>COLD READ</Text>
          <Text style={[styles.h2, { color: colors.ink }]}>You haven’t seen this one.</Text>
          <Text style={[styles.body, { color: colors.muted, textAlign: 'center' }]}>
            Like the real thing: no rehearsal. Tap, then start reading straight away.
          </Text>
          <View style={[styles.primary, { backgroundColor: colors.button }]}>
            <Text style={styles.primaryText}>Reveal and start</Text>
          </View>
        </Pressable>
      )}

      {/* Quiet nudges */}
      {!tooShort && !failed && (lost || offScript || listener.state === 'asking') && (
        <View style={[styles.nudge, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text style={[styles.nudgeText, { color: colors.ink }]}>
            {listener.state === 'asking'
              ? 'Getting the mic ready…'
              : offScript
                ? 'Are you reading this passage?'
                : `Pick up from “${words[a.next]?.display.replace(/[^\w'’-]/g, '')}”`}
          </Text>
        </View>
      )}
      {notice && (
        <Animated.View style={[styles.toast, { backgroundColor: colors.card, opacity: toast }]}>
          <Text style={[styles.toastText, { color: colors.cardInk }]}>{notice}</Text>
        </Animated.View>
      )}

      {/* In the layout, not floating: it sits on the footer and the passage shrinks above it, so it
          never covers the text and the line being read (kept ~30% down) stays in view (principle 6). */}
      {failed && !tooShort && (
        <View style={styles.errorDock}>
          <ListenError
            message={listener.error}
            code={listener.errorCode}
            onRetry={retryAfterError}
            onResume={listener.canResume ? resumeAfterError : undefined}
            lastWord={words[a.next - 1]?.display.replace(/[^\w'’-]/g, '')}
          />
        </View>
      )}

      {/* Docked like the error card: the passage shrinks above it instead of being covered. */}
      {tooShort && (
        <View style={styles.errorDock}>
          <View style={[styles.retry, { backgroundColor: colors.surface, borderColor: colors.line }]} accessibilityLiveRegion="polite">
            <Text style={[styles.retryTitle, { color: colors.ink }]}>Didn’t catch enough to score</Text>
            <Text style={[styles.retryBody, { color: colors.muted }]}>
              {a.spoken === 0 ? 'The mic didn’t hear anything.' : a.spoken === 1 ? 'Only 1 word came through.' : `Only ${a.spoken} words came through.`} Hold the phone a little closer and read at a normal volume.
            </Text>
            <View style={styles.retryRow}>
              <Pressable onPress={retry} style={[styles.retryBtn, { backgroundColor: colors.button }]} accessibilityRole="button">
                <Text style={styles.primaryText}>Try again</Text>
              </Pressable>
              <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button">
                <Text style={[styles.link, { color: colors.muted }]}>Not now</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Early Finish on the free run. Listening carries on underneath, so "Keep reading" (the
          default, filled) just closes this and they read on. */}
      {confirmEarly && !tooShort && !failed && (
        <View style={styles.errorDock}>
          <View style={[styles.retry, { backgroundColor: colors.surface, borderColor: colors.line }]} accessibilityLiveRegion="polite">
            <Text style={[styles.retryTitle, { color: colors.ink }]}>Finish now?</Text>
            <Text style={[styles.retryBody, { color: colors.muted }]}>
              Your free run counts when you reach the end of part 1. If you stop here, this read isn’t saved and your free run is still yours.
            </Text>
            <View style={styles.retryRow}>
              <Pressable onPress={() => setConfirmEarly(false)} style={[styles.retryBtn, { backgroundColor: colors.button }]} accessibilityRole="button">
                <Text style={styles.primaryText}>Keep reading</Text>
              </Pressable>
              <Pressable onPress={stopWithoutSaving} hitSlop={8} accessibilityRole="button">
                <Text style={[styles.link, { color: colors.muted }]}>Stop here</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Footer: voice ribbon, live pace, pacer, finish */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + space(1.5) }]}>
        {targetSeconds !== undefined && timeZone && (
          <View
            style={[styles.timeChip, { borderColor: timeZone === 'under' ? colors.line : timeColor }]}
            accessible
            accessibilityLabel={`${spokenClock(seconds)} of a ${spokenClock(targetSeconds)} target${timeLabel ? `, ${timeLabel}` : ''}`}
          >
            <Text style={[styles.timeText, { color: timeZone === 'under' ? colors.muted : timeColor }]}>
              {clock(seconds)} / {clock(targetSeconds)}
              {timeLabel ? ` · ${timeLabel}` : ''}
            </Text>
          </View>
        )}
        <View style={styles.footerRow}>
          <View style={styles.paceGroup}>
            <VoiceRibbon level={level} color={listener.state === 'listening' ? zoneColor : colors.line} />
            <Text style={[styles.wpm, { color: colors.ink }]}>{wpm || '–'}</Text>
            <Text style={[styles.wpmUnit, { color: colors.muted }]}>wpm</Text>
            <Text style={[styles.pacerLabel, { color: colors.signal }]}>Pacer {pacerAt}</Text>
          </View>
          {!tooShort && !confirmEarly && (
            <Pressable hitSlop={12} onPress={requestFinish} accessibilityRole="button">
              <Text style={[styles.finish, { color: colors.muted }]}>Finish</Text>
            </Pressable>
          )}
        </View>
      </View>
      <View style={[styles.paceLine, { backgroundColor: zoneColor, bottom: insets.bottom }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(3), height: 48 },
  close: { fontSize: 18 },
  title: { flex: 1, fontSize: 15, fontWeight: '600' },
  count: { fontSize: 13, fontVariant: ['tabular-nums'] },
  progressTrack: { height: 2, marginHorizontal: space(3), borderRadius: 1 },
  progressFill: { height: 2, borderRadius: 1 },
  passage: { paddingHorizontal: space(3) },
  flow: { flexDirection: 'row', flexWrap: 'wrap' },
  footer: { paddingHorizontal: space(3), paddingTop: space(1.5) },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeChip: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: space(1.25), paddingVertical: 4, marginBottom: space(1) },
  timeText: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  paceGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wpm: { fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
  wpmUnit: { fontSize: 13, marginLeft: -4 },
  pacerLabel: { fontSize: 13, fontWeight: '600', marginLeft: space(0.5) },
  finish: { fontSize: 16, fontWeight: '600' },
  paceLine: { position: 'absolute', left: 0, right: 0, height: 2 },
  nudge: { position: 'absolute', alignSelf: 'center', bottom: 120, borderWidth: 1, borderRadius: 999, paddingHorizontal: space(2), paddingVertical: space(1) },
  nudgeText: { fontSize: 15, fontWeight: '500' },
  toast: { position: 'absolute', bottom: 170, alignSelf: 'center', borderRadius: 12, paddingHorizontal: space(2), paddingVertical: 12, maxWidth: '86%' },
  toastText: { fontSize: 15, textAlign: 'center' },
  errorDock: { paddingHorizontal: space(2), paddingTop: space(1) },
  testerTag: { fontSize: 12, fontWeight: '600', paddingHorizontal: space(3), paddingTop: space(0.75) },
  cold: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: space(4), gap: space(2) },
  coldEyebrow: { fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(4), gap: space(2) },
  h2: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 17, lineHeight: 24 },
  primary: { borderRadius: 14, paddingHorizontal: space(3), paddingVertical: 14, marginTop: space(1) },
  primaryText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  link: { fontSize: 16, padding: space(1) },
  retry: { borderWidth: 1, borderRadius: 18, padding: space(2), gap: space(1) },
  retryTitle: { fontSize: 18, fontWeight: '700' },
  retryBody: { fontSize: 15, lineHeight: 21 },
  retryRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(0.5) },
  retryBtn: { borderRadius: 12, paddingHorizontal: space(2.5), paddingVertical: 12 },
});
