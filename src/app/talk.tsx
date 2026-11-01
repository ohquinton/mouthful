import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { countFreeTalk, tokenise } from '../engine/align';
import { sessionScore, wordsPerMinute } from '../engine/score';
import { MIN_MINUTE_WORDS, minuteSummary, stampHeard } from '../engine/minute';
import { LEVEL_NAME, minutePromptOfTheDay } from '../content/prompts';
import { saveSession } from '../store/sessions';
import { gapAfterBreak, minuteCompleteProps, minuteRecord, talkStopId, withoutBreaks, type MinuteBreak } from '../store/minute';
import { listenLocale, useListener } from '../speech/useListener';
import { PrimaryButton } from '../components/ui';
import { useProfile } from '../store/profile';
import { track } from '../analytics';
import { noteRoughPatch } from '../rating';
import { useVoiceLevel, VoiceRibbon } from '../components/VoiceRibbon';
import { MicGate, gateStates } from '../components/MicGate';
import { ListenError } from '../components/ListenError';
import { fonts, space, useColors } from '../theme';

const LIMIT_S = 60;
/** Daily topic talk. Recognition timing and consent stay shared with the existing listener. */
export default function TopicTalk() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const params = useLocalSearchParams<{ stopId?: string }>();
  // Freeze the originating stop for this attempt, including a talk that crosses midnight.
  const [stopId] = useState(() => talkStopId(params.stopId));
  // The day this screen opened, so the prompt can't change at midnight mid-talk.
  const [today] = useState(() => new Date());
  const { level, onLevel } = useVoiceLevel();
  const listener = useListener([], { allowServer: profile.allowServerRecognition, onLevel, lang: listenLocale(profile.speechLang) });
  const [shuffle, setShuffle] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  // When the error card came up mid-talk (e.g. iOS `interrupted` by a call), 0 otherwise. The
  // minute stands still from then, so the 60 s limit and live pace don't run during the call.
  const [pausedAt, setPausedAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const done = useRef(false);
  // One Minute's timing, all reset in begin(): when each word was first heard (wall clock), when
  // listening started (never shifted), and the breaks (error card up, then Carry on) to take out.
  const heardTimes = useRef<number[]>([]);
  const startWall = useRef(0);
  const breaks = useRef<MinuteBreak[]>([]);
  const minutePrompt = minutePromptOfTheDay(today, shuffle);

  const heard = useMemo(() => tokenise(listener.transcript), [listener.transcript]);
  const counts = useMemo(() => countFreeTalk(heard), [heard]);
  const running = startedAt > 0 && listener.state === 'listening';
  const seconds = startedAt ? ((pausedAt || now) - startedAt) / 1000 : 0;
  const left = Math.max(0, Math.ceil(LIMIT_S - seconds));
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

  // One Minute: stamp each new word with the time it was first heard. Keyed on the word count,
  // not the 250 ms clock. While the error card is up the clock stands still (pausedAt).
  // After a Carry on, the first word heard also moves the clock on by the gap across the break
  // (gapAfterBreak), because withoutBreaks() takes that gap out of the stamps at Finish. Without
  // this the clock ran out while Kept going still said ~58 s.
  useEffect(() => {
    if (!startedAt) return;
    const before = heardTimes.current.length;
    heardTimes.current = stampHeard(heardTimes.current, heard.length, pausedAt || Date.now());
    const gap = gapAfterBreak(heardTimes.current, breaks.current, before);
    // Can't loop: the re-run this causes stamps no new word, so the gap is 0.
    if (gap > 0) setStartedAt((s) => s + gap);
  }, [heard.length, startedAt, pausedAt]);

  // Stop the minute when the recogniser stops for good. If listening resumes with the transcript
  // kept (Carry on), move the start forward by the time away, so the call doesn't use up the
  // minute or drag pace down. Try again goes through begin(), which clears the stamp.
  useEffect(() => {
    if (listener.state === 'error') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the recogniser stopping (outside React); guarded so it stamps once
      if (startedAt && !pausedAt) setPausedAt(Date.now());
    } else if (listener.state === 'listening' && pausedAt) {
      const away = Date.now() - pausedAt; // captured now, before the updater runs
      // One Minute: words heard from here on came after the break. withoutBreaks() takes the
      // time away (and the gap across it) out of their stamps at Finish, so a call is never a pause.
      breaks.current = [...breaks.current, { index: heardTimes.current.length, awayMs: away }];
      setStartedAt((s) => s + away);
      setPausedAt(0);
    }
  }, [listener.state, startedAt, pausedAt]);

  /**
   * Every attempt (first go, retry, after consent) starts from a clean slate. That includes a
   * consent ask in the middle of a talk (on-device recognition went away at a restart): Free
   * talk is one unscripted minute, so a fresh minute is more honest than scoring a talk with a
   * consent screen in the middle of it, and the timer, pauses and transcript all reset together.
   */
  const begin = async (override?: { allowServer?: boolean }) => {
    if (finishing || listener.state === 'asking') return;
    // Words already heard means this replaces an attempt (e.g. after a mid-talk consent ask).
    const isRetry = notice !== null || failed || heard.length > 0;
    listener.reset();
    heardTimes.current = [];
    breaks.current = [];
    startWall.current = 0;
    done.current = false;
    setStartedAt(0);
    setPausedAt(0);
    setNotice(null);
    setFinishing(false);
    await listener.start(override);
    const t = Date.now();
    startWall.current = t;
    setStartedAt(t);
    track(isRetry ? 'session_retry' : 'session_start', { kind: 'minute', pace: 'talking', where: 'talk', which: minutePrompt.id, level: minutePrompt.level });
  };

  /** Try again after a recogniser error: make sure the mic is off first, then start clean. */
  const retryAfterError = async () => {
    if (listener.state === 'listening') {
      done.current = true; // so the 60 s limit can't save this attempt while it stops
      await listener.stop();
    }
    await begin(); // awaited so ListenError keeps Try again disabled until the mic is starting
  };

  /**
   * Carry on after the recogniser stopped: the talk so far and what's left of the minute stay
   * (the clock stood still while the card was up). If resuming needs a consent ask, MicGate's
   * yes goes through begin(), so that becomes a fresh minute, as for any mid-talk consent ask.
   */
  const resumeAfterError = async () => {
    if (done.current) return;
    track('session_resume', { where: 'talk', error: listener.errorCode });
    await listener.resume(); // awaited so ListenError keeps Carry on disabled until the mic is starting
  };

  /** Not enough came through: no score, no Flow, nothing saved. Try again calls begin(). */
  const tooShort = (spoken: number) => {
    setStartedAt(0);
    setFinishing(false);
    noteRoughPatch();
    track('session_too_short', { spoken, kind: 'minute' });
    setNotice(spoken === 0 ? 'The mic didn’t hear anything. Hold the phone a little closer and try again.' : `Only ${spoken} ${spoken === 1 ? 'word' : 'words'} came through. Try again a little closer to the mic.`);
  };

  const finish = async () => {
    if (done.current) return;
    done.current = true;
    setFinishing(true);
    await listener.stop();
    // Up to the pause if the error card is up: the call isn't talking time.
    const secs = Math.max(1, ((pausedAt || Date.now()) - startedAt) / 1000);
    if (counts.spoken < MIN_MINUTE_WORDS) return tooShort(counts.spoken);

    // One Minute: Flow and its numbers. Times are taken with the breaks removed.
    const timing = withoutBreaks(heardTimes.current, startWall.current, breaks.current);
    const summary = minuteSummary({ tokens: heard, heardTimes: timing.heardTimes, startedAt: timing.startedAt, prompt: minutePrompt.text });
    if (!summary) return tooShort(counts.spoken); // same rule as above; belt and braces

    const longPauses = summary.longPauses;
    const fillersPerMin = +(counts.fillerCount / (secs / 60)).toFixed(1);
    // The score is computed as before (Free talk's formula; `score` is a required field). Flow is
    // separate and is what a minute shows; Progress leaves minutes out of Best score for that reason.
    const stats = { wpm: wordsPerMinute(counts.spoken, secs), fillersPerMin, accuracy: null, midSentencePauses: longPauses, seconds: secs };
    const id = `${Date.now()}`;
    await saveSession({
      id,
      passageId: 'talk',
      title: minutePrompt.text,
      stopId,
      at: Date.now(),
      wpm: stats.wpm,
      fillers: counts.fillerCount,
      fillersPerMin,
      topFiller: Object.entries(counts.fillers).sort((a, b) => b[1] - a[1])[0]?.[0],
      accuracy: null,
      pauses: longPauses,
      seconds: Math.round(secs),
      score: sessionScore(stats, 'talking'),
      stumbled: [],
      context: 'talking',
      habits: counts.habitCount ? counts.habits : undefined,
      kind: 'minute',
      flow: summary.flow,
      flowVersion: summary.flowVersion,
      promptId: minutePrompt.id,
      level: minutePrompt.level,
      overruled: [],
      minute: minuteRecord(summary),
    });
    // Numbers and codes only: the prompt goes as its id, never its text.
    track('session_complete', minuteCompleteProps(summary, minutePrompt, secs));
    if (summary.talkSeconds >= 45) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.replace({ pathname: '/tape', params: { id } });
  };

  useEffect(() => {
    // finish() is guarded by done.current, so this runs it once when the minute is up.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the time limit is an effect of the clock; finish() sets state only after awaiting the recogniser
    if (running && seconds >= LIMIT_S) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, seconds]);

  if (gateStates.includes(listener.state)) {
    return <MicGate state={listener.state} onAllowed={() => begin({ allowServer: true })} />;
  }

  // Keep the topic fixed during starting, listening, interruptions and save.
  const canShuffle = startedAt === 0 && !pausedAt && !finishing && listener.state !== 'asking' && !notice && !failed;
  const clockSeconds = running || pausedAt ? left : LIMIT_S;
  const lineColor = profile.line === 'clear' ? colors.clear : colors.sharp;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.top}>
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
          accessibilityRole="button"
          accessibilityLabel="Close topic talk"
          style={styles.close}
        >
          <Ionicons name="close" size={24} color={colors.muted} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.muted }]}>Topic talk</Text>
        <Text style={[styles.timer, { color: colors.ink }]} accessibilityLabel={`${clockSeconds} seconds remaining`}>
          {Math.floor(clockSeconds / 60)}:{String(clockSeconds % 60).padStart(2, '0')}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.line }]} accessible accessibilityRole="progressbar" accessibilityLabel="Talk progress" accessibilityValue={{ min: 0, max: 60, now: Math.min(60, Math.max(0, Math.floor(seconds))) }}>
        <View style={[styles.trackFill, { backgroundColor: lineColor, width: `${Math.min(100, Math.max(0, seconds / LIMIT_S * 100))}%` }]} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
        <Text style={[styles.eyebrow, { color: lineColor }]}>{running ? 'ONE MINUTE. YOUR WORDS.' : 'TODAY’S TOPIC'} · {LEVEL_NAME[minutePrompt.level].toUpperCase()}</Text>
        <Text style={[minutePrompt.level === 3 ? styles.prompt : styles.word, { color: colors.ink }]}>{minutePrompt.text}</Text>
        <Text style={[styles.hint, { color: colors.muted }]}>
          {running ? 'Keep going. If you get stuck, say the topic again and one thing it reminds you of.' : 'Talk about it for one minute. Take a moment to think: the first 8 seconds before your first word are free in your Flow rating.'}
        </Text>
        {!failed && !notice && (
          <View style={[styles.ideas, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={[styles.ideasTitle, { color: colors.ink }]}>If you are unsure where to start</Text>
            <Text style={[styles.idea, { color: colors.muted }]}>One thing you have noticed</Text>
            <Text style={[styles.idea, { color: colors.muted }]}>A moment from your own life</Text>
            <Text style={[styles.idea, { color: colors.muted }]}>What you think, and why</Text>
          </View>
        )}
        {failed ? (
          <ListenError message={listener.error} code={listener.errorCode} onRetry={retryAfterError} onResume={listener.canResume ? resumeAfterError : undefined} />
        ) : notice ? (
          <View style={[styles.ideas, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text accessibilityRole="alert" style={[styles.notice, { color: colors.ink }]}>{notice}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.line, paddingBottom: insets.bottom + space(2) }]}>
        {finishing ? <PrimaryButton label="Saving your talk…" onPress={() => {}} busy /> : running ? (
          <View style={styles.liveFooter}>
            <View style={styles.ribbon}><VoiceRibbon level={level} color={colors.signal} /></View>
            <Pressable accessibilityRole="button" onPress={finish} style={[styles.finish, { borderColor: colors.line }]}>
              <Text style={[styles.finishText, { color: colors.ink }]}>Finish</Text>
            </Pressable>
          </View>
        ) : failed ? null : (
          <PrimaryButton label={listener.state === 'asking' ? 'Getting the mic ready…' : notice ? 'Try again' : 'Start talking'} onPress={() => begin()} busy={listener.state === 'asking'} />
        )}
        {canShuffle && (
          <Pressable onPress={() => setShuffle((n) => n + 1)} accessibilityRole="button" style={styles.shuffleButton}>
            <Text style={[styles.shuffle, { color: colors.muted }]}>Different topic</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space(1), minHeight: 56, paddingHorizontal: space(2) },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, fontSize: 15, fontWeight: '600' },
  timer: { fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'], paddingRight: space(1) },
  track: { height: 3, marginHorizontal: space(3), borderRadius: 2, overflow: 'hidden' },
  trackFill: { height: 3 },
  scroll: { flex: 1 },
  body: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: space(3), paddingVertical: space(4), gap: space(2) },
  eyebrow: { fontSize: 11, lineHeight: 17, fontWeight: '700', letterSpacing: 1.1 },
  prompt: { fontFamily: fonts.readingBold, fontSize: 30, lineHeight: 42 },
  word: { fontFamily: fonts.readingBold, fontSize: 48, lineHeight: 62 },
  hint: { fontSize: 16, lineHeight: 24 },
  ideas: { borderWidth: 1, borderRadius: 20, padding: space(2), gap: space(0.75), marginTop: space(1) },
  ideasTitle: { fontSize: 14, fontWeight: '600', marginBottom: space(0.5) },
  idea: { fontSize: 14, lineHeight: 21 },
  footer: { borderTopWidth: 1, paddingHorizontal: space(3), paddingTop: space(2) },
  liveFooter: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  ribbon: { flex: 1, minWidth: 0, overflow: 'hidden' },
  finish: { minHeight: 48, borderWidth: 1, borderRadius: 16, paddingHorizontal: space(2), justifyContent: 'center' },
  finishText: { fontSize: 16, fontWeight: '600' },
  shuffleButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: space(0.5) },
  shuffle: { fontSize: 14, fontWeight: '600' },
  notice: { fontSize: 16, lineHeight: 23 },
});
