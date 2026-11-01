import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { countFreeTalk, tokenise } from '../engine/align';
import { sessionScore, wordsPerMinute } from '../engine/score';
import { MIN_MINUTE_WORDS, minuteSummary, stampHeard } from '../engine/minute';
import { minutePromptOfTheDay, promptAfter, promptById } from '../content/prompts';
import { saveSession } from '../store/sessions';
import {
  forLength,
  gapAfterBreak,
  minuteCompleteProps,
  minuteRecord,
  stopNumber,
  talkLength,
  withoutBreaks,
  type MinuteBreak,
} from '../store/minute';
import { listenLocale, useListener } from '../speech/useListener';
import { PrimaryButton } from '../components/ui';
import { Drop } from '../components/MinuteResult';
import { useProfile } from '../store/profile';
import { track } from '../analytics';
import { noteRoughPatch } from '../rating';
import { useVoiceLevel, VoiceRibbon } from '../components/VoiceRibbon';
import { MicGate, gateStates } from '../components/MicGate';
import { ListenError } from '../components/ListenError';
import { fonts, space, useColors } from '../theme';

/** A light tap this many seconds before the end, so the finish never surprises (remodel-screens §3). */
const WARN_BEFORE_S = 10;

/** A stop id from the route: short, plain characters only, or nothing. Route params are never trusted. */
function stopParam(v: string | string[] | undefined): string | undefined {
  return typeof v === 'string' && /^[\w.:-]{1,40}$/.test(v) ? v : undefined;
}

/** "1:00", "0:07": the clock in the top bar. */
function clockText(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Topic talk: the daily front door (DECISIONS 2026-11-01). One topic, one minute (or 30 seconds for
 * onboarding's first talk), a Flow rating on the results. It replaced Free talk and left tester mode.
 *
 * Route contract (Home, the map and onboarding code against this, keep it exact):
 *   /talk?prompt=<prompt id>&stop=<stop id>&seconds=30|60&from=onboarding|home|…
 *   - prompt: a content/prompts.ts id; unknown or missing → the prompt of the day.
 *   - stop: the map stop this talk completes; saved on the session as `stopId`.
 *   - seconds: '30' for a 30-second talk (tagged so it never joins 60 s trends); anything else → 60.
 *   - from: 'onboarding' finishes on /onboarding/day1?id=<session id>; anything else on the Tape.
 *
 * The start is calm, no 3-2-1: the first 8 seconds before the first word are free (FREE_THINK_MS),
 * so the clock just starts and the footer swaps to the Drop, the voice ribbon and Finish.
 */
export default function TopicTalk() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const still = useReducedMotion();
  const params = useLocalSearchParams<{ prompt?: string; stop?: string; seconds?: string; from?: string }>();
  const { profile } = useProfile();
  // Read once per screen, so nothing can change halfway through a talk.
  const [limit] = useState(() => talkLength(params.seconds));
  const [stopId] = useState(() => stopParam(params.stop));
  const [fromOnboarding] = useState(() => params.from === 'onboarding');
  // The day this screen opened, so the prompt can't change at midnight mid-talk.
  const [base] = useState(() => promptById(typeof params.prompt === 'string' ? params.prompt : undefined) ?? minutePromptOfTheDay(new Date()));
  const { level, onLevel } = useVoiceLevel();
  const listener = useListener([], { allowServer: profile.allowServerRecognition, onLevel, lang: listenLocale(profile.speechLang) });
  const [shuffle, setShuffle] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  // When the error card came up mid-talk (e.g. iOS `interrupted` by a call), 0 otherwise. The
  // talk stands still from then, so the time limit doesn't run during the call.
  const [pausedAt, setPausedAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState<string | null>(null);
  const done = useRef(false);
  const warned = useRef(false);
  // Timing, all reset in begin(): when each word was first heard (wall clock), when listening
  // started (never shifted), and the breaks (error card up, then Carry on) to take out.
  const heardTimes = useRef<number[]>([]);
  const startWall = useRef(0);
  const breaks = useRef<MinuteBreak[]>([]);
  const prompt = promptAfter(base, shuffle);

  const heard = useMemo(() => tokenise(listener.transcript), [listener.transcript]);
  const counts = useMemo(() => countFreeTalk(heard), [heard]);
  const running = startedAt > 0 && listener.state === 'listening';
  const seconds = startedAt ? ((pausedAt || now) - startedAt) / 1000 : 0;
  // The recogniser stopped for good (e.g. it can't listen for this English). A routine error
  // while it's still listening restarts by itself, so it shows nothing.
  const failed = listener.state === 'error';
  // No rating ask in a launch where the recogniser let them down (rating.ts).
  useEffect(() => {
    if (failed) noteRoughPatch();
  }, [failed]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // Stamp each new word with the time it was first heard. Keyed on the word count, not the 250 ms
  // clock. While the error card is up the clock stands still (pausedAt). After a Carry on, the first
  // word heard also moves the clock on by the gap across the break (gapAfterBreak), because
  // withoutBreaks() takes that gap out of the stamps at Finish. Without this the clock ran out while
  // Kept going still said ~58 s.
  useEffect(() => {
    if (!startedAt) return;
    const before = heardTimes.current.length;
    heardTimes.current = stampHeard(heardTimes.current, heard.length, pausedAt || Date.now());
    const gap = gapAfterBreak(heardTimes.current, breaks.current, before);
    // Can't loop: the re-run this causes stamps no new word, so the gap is 0.
    if (gap > 0) setStartedAt((s) => s + gap);
  }, [heard.length, startedAt, pausedAt]);

  // Stop the clock when the recogniser stops for good. If listening resumes with the transcript
  // kept (Carry on), move the start forward by the time away, so the call doesn't use up the
  // talk. Try again goes through begin(), which clears the stamp.
  useEffect(() => {
    if (listener.state === 'error') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the recogniser stopping (outside React); guarded so it stamps once
      if (startedAt && !pausedAt) setPausedAt(Date.now());
    } else if (listener.state === 'listening' && pausedAt) {
      const away = Date.now() - pausedAt; // captured now, before the updater runs
      // Words heard from here on came after the break. withoutBreaks() takes the time away (and
      // the gap across it) out of their stamps at Finish, so a call is never a pause.
      breaks.current = [...breaks.current, { index: heardTimes.current.length, awayMs: away }];
      setStartedAt((s) => s + away);
      setPausedAt(0);
    }
  }, [listener.state, startedAt, pausedAt]);

  /**
   * Every attempt (first go, retry, after consent) starts from a clean slate: transcript, clock,
   * stamps, breaks and the end warning (principle 8). A consent ask in the middle of a talk also
   * comes through here, so it becomes a fresh talk rather than one with a consent screen inside it.
   */
  const begin = async (override?: { allowServer?: boolean }) => {
    // Words already heard means this replaces an attempt (e.g. after a mid-talk consent ask).
    const isRetry = notice !== null || failed || heard.length > 0;
    listener.reset();
    heardTimes.current = [];
    breaks.current = [];
    startWall.current = 0;
    done.current = false;
    warned.current = false;
    setStartedAt(0);
    setPausedAt(0);
    setNotice(null);
    await listener.start(override);
    const t = Date.now();
    startWall.current = t;
    setStartedAt(t);
    track(isRetry ? 'session_retry' : 'session_start', { kind: 'minute', pace: 'talking', where: 'talk', which: prompt.id, level: prompt.level, seconds: limit });
  };

  /** Try again after a recogniser error: make sure the mic is off first, then start clean. */
  const retryAfterError = async () => {
    if (listener.state === 'listening') {
      done.current = true; // so the time limit can't save this attempt while it stops
      await listener.stop();
    }
    await begin(); // awaited so ListenError keeps Try again disabled until the mic is starting
  };

  /**
   * Carry on after the recogniser stopped: the talk so far and what's left of it stay (the clock
   * stood still while the card was up). If resuming needs a consent ask, MicGate's yes goes
   * through begin(), so that becomes a fresh talk.
   */
  const resumeAfterError = async () => {
    if (done.current) return;
    track('session_resume', { where: 'talk', error: listener.errorCode });
    await listener.resume(); // awaited so ListenError keeps Carry on disabled until the mic is starting
  };

  /** Not enough came through: no Flow, nothing saved. Try again calls begin(). */
  const tooShort = (spoken: number) => {
    setStartedAt(0);
    noteRoughPatch();
    track('session_too_short', { spoken, kind: 'minute' });
    setNotice(spoken === 0 ? 'The mic didn’t hear anything. Hold the phone a little closer and try again.' : `Only ${spoken} ${spoken === 1 ? 'word' : 'words'} came through. Try again a little closer to the mic.`);
  };

  const finish = async () => {
    if (done.current) return;
    done.current = true;
    await listener.stop();
    // Up to the pause if the error card is up: the call isn't talking time.
    const secs = Math.max(1, ((pausedAt || Date.now()) - startedAt) / 1000);
    if (counts.spoken < MIN_MINUTE_WORDS) return tooShort(counts.spoken);

    // Flow and its numbers, with the breaks taken out of the times. The prompt and its synonyms
    // are never counted as repeated words or in variety (engine wording.ts).
    const timing = withoutBreaks(heardTimes.current, startWall.current, breaks.current);
    const raw = minuteSummary({ tokens: heard, heardTimes: timing.heardTimes, startedAt: timing.startedAt, prompt: prompt.text, related: prompt.related });
    if (!raw) return tooShort(counts.spoken); // same rule as above; belt and braces
    // A 30-second talk: kept going out of 30, and its own Flow version (never in 60 s trends).
    const summary = forLength(raw, limit);

    const fillersPerMin = +(counts.fillerCount / (secs / 60)).toFixed(1);
    // `score` is a required field, so it's computed as Free talk did. Flow is what a talk shows;
    // Progress leaves minutes out of Best score for that reason.
    const stats = { wpm: wordsPerMinute(counts.spoken, secs), fillersPerMin, accuracy: null, midSentencePauses: summary.longPauses, seconds: secs };
    const id = `${Date.now()}`;
    await saveSession({
      id,
      passageId: 'talk',
      title: 'Topic talk',
      at: Date.now(),
      wpm: stats.wpm,
      fillers: counts.fillerCount,
      fillersPerMin,
      topFiller: Object.entries(counts.fillers).sort((a, b) => b[1] - a[1])[0]?.[0],
      accuracy: null,
      pauses: summary.longPauses,
      seconds: Math.round(secs),
      score: sessionScore(stats, 'talking'),
      stumbled: [],
      context: 'talking',
      habits: counts.habitCount ? counts.habits : undefined,
      kind: 'minute',
      flow: summary.flow,
      flowVersion: summary.flowVersion,
      promptId: prompt.id,
      level: prompt.level,
      ...(stopId && { stopId }),
      overruled: [],
      minute: minuteRecord(summary, limit),
    });
    // Numbers and codes only: the prompt goes as its id, never its text; repeated words never go.
    track('session_complete', minuteCompleteProps(summary, prompt, secs));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (fromOnboarding) router.replace({ pathname: '/onboarding/day1', params: { id } });
    else router.replace({ pathname: '/tape', params: { id } });
  };

  useEffect(() => {
    if (!running) return;
    if (!warned.current && seconds >= limit - WARN_BEFORE_S) {
      warned.current = true;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    // finish() is guarded by done.current, so this runs it once when the time is up.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the time limit is an effect of the clock; finish() sets state only after awaiting the recogniser
    if (seconds >= limit) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, seconds]);

  /** Onboarding's way out of a too-short or failed first talk: back to where it came from. */
  const skip = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  if (gateStates.includes(listener.state)) {
    return <MicGate state={listener.state} onAllowed={() => begin({ allowServer: true })} />;
  }

  // Not while a talk is running, paused or resuming, and never on onboarding's fixed first topic.
  const canShuffle = !running && !pausedAt && !fromOnboarding;
  const ready = !running && !pausedAt && !notice && !failed;
  const long = prompt.level === 3;
  const stop = stopNumber(stopId);
  const title = fromOnboarding ? 'Your first talk' : stop !== undefined ? `Topic talk · stop ${stop}` : 'Topic talk';
  const length = limit === 30 ? '30 seconds' : 'one minute';
  const eyebrow = fromOnboarding ? `YOUR FIRST TOPIC TALK · ${limit} SECONDS` : running ? `TALK FOR ${length.toUpperCase()}` : 'TODAY’S TOPIC';
  const progress = Math.min(1, seconds / limit);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom + space(2) }]}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={26} color={colors.muted} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.muted }]} numberOfLines={1}>
          {title}
        </Text>
        <Text
          style={[styles.timer, { color: colors.ink }]}
          accessibilityLabel={running || pausedAt ? `${Math.floor(seconds)} of ${limit} seconds` : `${limit} seconds`}
        >
          {running || pausedAt ? clockText(seconds) : clockText(limit)}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.line }]}>
        <View style={[styles.fill, { backgroundColor: colors.signal, width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.body}>
        <Text style={[styles.eyebrow, { color: colors.muted }]}>{eyebrow}</Text>
        <Text style={[long ? styles.promptLong : styles.prompt, { color: colors.ink }]}>{prompt.text}</Text>
        {ready && (
          <Text style={[styles.hint, { color: colors.muted }]}>
            Talk about it for {length}. Take a moment to think: the first 8 seconds don’t count against you.
          </Text>
        )}
        {running && <Text style={[styles.hint, { color: colors.muted }]}>Keep going. If you get stuck, say the word again.</Text>}
        {!long && prompt.ideas && prompt.ideas.length > 0 && !failed && !notice && (
          <View style={styles.ideas}>
            <Text style={[styles.ideasTitle, { color: colors.muted }]}>If you get stuck</Text>
            {prompt.ideas.map((idea) => (
              <Text key={idea} style={[styles.idea, { color: colors.muted }]}>
                {idea}
              </Text>
            ))}
          </View>
        )}
        {failed ? (
          <ListenError message={listener.error} code={listener.errorCode} onRetry={retryAfterError} onResume={listener.canResume ? resumeAfterError : undefined} />
        ) : (
          notice && <Text style={[styles.notice, { color: colors.ink }]}>{notice}</Text>
        )}
      </View>

      <View style={[styles.footer, { borderTopColor: colors.line }]}>
        {running ? (
          // The calm start: the button gives way to the Drop looking up at the topic, the ribbon and Finish.
          <Animated.View entering={still ? undefined : FadeIn.duration(200)} style={styles.liveFooter}>
            <Drop size={36} pose="up" color={colors.button} />
            <View style={styles.ribbon}>
              <VoiceRibbon level={level} color={colors.signal} height={22} />
            </View>
            <Pressable onPress={finish} hitSlop={10} accessibilityRole="button" style={styles.finish}>
              <Text style={[styles.finishText, { color: colors.ink }]}>Finish</Text>
            </Pressable>
          </Animated.View>
        ) : failed ? (
          fromOnboarding ? (
            <Pressable onPress={skip} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.quiet, { color: colors.muted }]}>Skip for now</Text>
            </Pressable>
          ) : null
        ) : (
          <>
            <PrimaryButton
              label={listener.state === 'asking' ? 'Getting the mic ready…' : notice ? 'Try again' : 'Start talking'}
              onPress={() => begin()}
              busy={listener.state === 'asking'}
            />
            {canShuffle && !notice && (
              <Pressable onPress={() => setShuffle((n) => n + 1)} hitSlop={8} accessibilityRole="button">
                <Text style={[styles.quiet, { color: colors.muted }]}>Different topic</Text>
              </Pressable>
            )}
            {notice && fromOnboarding && (
              <Pressable onPress={skip} hitSlop={8} accessibilityRole="button">
                <Text style={[styles.quiet, { color: colors.muted }]}>Skip for now</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space(3) },
  top: { flexDirection: 'row', alignItems: 'center', gap: space(2), height: 52 },
  topTitle: { flex: 1, fontSize: 16, fontWeight: '600' },
  timer: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  body: { flex: 1, justifyContent: 'center', gap: space(2) },
  eyebrow: { fontSize: 13, fontWeight: '800', letterSpacing: 1.3 },
  // The topic is a word you say, so it's in the reading serif (remodel-screens §0.4).
  prompt: { fontFamily: fonts.readingBold, fontSize: 52, lineHeight: 64 },
  promptLong: { fontFamily: fonts.readingBold, fontSize: 30, lineHeight: 40 },
  hint: { fontSize: 17, lineHeight: 25 },
  ideas: { gap: 4, marginTop: space(1) },
  ideasTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  idea: { fontSize: 16, lineHeight: 23 },
  notice: { fontSize: 16, lineHeight: 23, fontWeight: '600' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space(2), gap: space(1.5), alignItems: 'stretch', minHeight: 108 },
  liveFooter: { flexDirection: 'row', alignItems: 'center', gap: space(2), minHeight: 56 },
  ribbon: { flex: 1 },
  finish: { minHeight: 44, minWidth: 64, alignItems: 'flex-end', justifyContent: 'center' },
  finishText: { fontSize: 17, fontWeight: '700' },
  quiet: { fontSize: 16, fontWeight: '600', textAlign: 'center', padding: space(0.5) },
});
