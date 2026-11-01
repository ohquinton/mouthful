import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { countFreeTalk, tokenise } from '../engine/align';
import { paceZone, sessionScore, wordsPerMinute } from '../engine/score';
import { MIN_MINUTE_WORDS, minuteSummary, stampHeard } from '../engine/minute';
import { LEVEL_NAME, minutePromptOfTheDay, promptOfTheDay } from '../content/prompts';
import { saveSession } from '../store/sessions';
import { gapAfterBreak, minuteCompleteProps, minuteRecord, withoutBreaks, type MinuteBreak } from '../store/minute';
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
const PAUSE_MS = 2500;
const MIN_WORDS = 15;

/**
 * Free talk, and (in tester mode, for the beta) One Minute, which replaces it once the pause counts
 * hold up against recordings (DILEMMAS #4 and "Decided"). Same route, same minute, same Try again.
 * One Minute adds the three prompt levels and a Flow rating (engine/minute.ts) on the Tape.
 */
export default function FreeTalk() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  // Tester mode only for now. Read once per screen, so a minute can't change mode halfway.
  const [minute] = useState(() => profile.testerMode === true);
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
  const pauses = useRef(0);
  const prevHeard = useRef(0);
  const done = useRef(false);
  // One Minute's timing, all reset in begin(): when each word was first heard (wall clock), when
  // listening started (never shifted), and the breaks (error card up, then Carry on) to take out.
  const heardTimes = useRef<number[]>([]);
  const startWall = useRef(0);
  const breaks = useRef<MinuteBreak[]>([]);
  const prompt = promptOfTheDay(today, shuffle);
  const minutePrompt = minutePromptOfTheDay(today, shuffle);

  const heard = useMemo(() => tokenise(listener.transcript), [listener.transcript]);
  const counts = useMemo(() => countFreeTalk(heard), [heard]);
  const running = startedAt > 0 && listener.state === 'listening';
  const seconds = startedAt ? ((pausedAt || now) - startedAt) / 1000 : 0;
  const wpm = wordsPerMinute(counts.spoken, seconds);
  const zoneNow = paceZone(wpm, 'talking');
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
    const gap = minute ? gapAfterBreak(heardTimes.current, breaks.current, before) : 0;
    // Can't loop: the re-run this causes stamps no new word, so the gap is 0.
    if (gap > 0) setStartedAt((s) => s + gap);
  }, [heard.length, startedAt, pausedAt, minute]);

  // Free talk: a long silence between words counts as a pause. (One Minute uses minuteSummary's
  // count instead, which never counts the thinking time before the first word.)
  useEffect(() => {
    if (!startedAt || !listener.lastHeardAt) return;
    if (prevHeard.current && listener.lastHeardAt - prevHeard.current > PAUSE_MS) pauses.current++;
    prevHeard.current = listener.lastHeardAt;
  }, [listener.lastHeardAt, startedAt]);

  // Stop the minute when the recogniser stops for good. If listening resumes with the transcript
  // kept (Carry on), move the start forward by the time away, so the call doesn't use up the
  // minute or drag pace down. Try again goes through begin(), which clears the stamp.
  useEffect(() => {
    if (listener.state === 'error') {
      // Forget the last word's time, so the gap across the call isn't counted as a pause.
      prevHeard.current = 0;
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
    // Words already heard means this replaces an attempt (e.g. after a mid-talk consent ask).
    const isRetry = notice !== null || failed || heard.length > 0;
    listener.reset();
    pauses.current = 0;
    prevHeard.current = 0;
    heardTimes.current = [];
    breaks.current = [];
    startWall.current = 0;
    done.current = false;
    setStartedAt(0);
    setPausedAt(0);
    setNotice(null);
    await listener.start(override);
    const t = Date.now();
    startWall.current = t;
    setStartedAt(t);
    track(isRetry ? 'session_retry' : 'session_start', minute ? { kind: 'minute', pace: 'talking', where: 'talk', which: minutePrompt.id, level: minutePrompt.level } : { kind: 'talk', pace: 'talking', where: 'talk' });
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
    noteRoughPatch();
    track('session_too_short', { spoken, kind: minute ? 'minute' : 'talk' });
    setNotice(spoken === 0 ? 'The mic didn’t hear anything. Hold the phone a little closer and try again.' : `Only ${spoken} ${spoken === 1 ? 'word' : 'words'} came through. Try again a little closer to the mic.`);
  };

  const finish = async () => {
    if (done.current) return;
    done.current = true;
    await listener.stop();
    // Up to the pause if the error card is up: the call isn't talking time.
    const secs = Math.max(1, ((pausedAt || Date.now()) - startedAt) / 1000);
    if (counts.spoken < (minute ? MIN_MINUTE_WORDS : MIN_WORDS)) return tooShort(counts.spoken);

    // One Minute: Flow and its numbers. Times are taken with the breaks removed.
    const timing = minute ? withoutBreaks(heardTimes.current, startWall.current, breaks.current) : undefined;
    const summary = timing ? minuteSummary({ tokens: heard, heardTimes: timing.heardTimes, startedAt: timing.startedAt }) : null;
    if (minute && !summary) return tooShort(counts.spoken); // same rule as above; belt and braces

    const longPauses = summary ? summary.longPauses : pauses.current;
    const fillersPerMin = +(counts.fillerCount / (secs / 60)).toFixed(1);
    // The score is computed as before (Free talk's formula; `score` is a required field). Flow is
    // separate and is what a minute shows; Progress leaves minutes out of Best score for that reason.
    const stats = { wpm: wordsPerMinute(counts.spoken, secs), fillersPerMin, accuracy: null, midSentencePauses: longPauses, seconds: secs };
    const id = `${Date.now()}`;
    await saveSession({
      id,
      passageId: 'talk',
      title: minute ? 'One Minute' : 'Free talk',
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
      ...(summary && {
        kind: 'minute' as const,
        flow: summary.flow,
        flowVersion: summary.flowVersion,
        promptId: minutePrompt.id,
        level: minutePrompt.level,
        overruled: [],
        minute: minuteRecord(summary),
      }),
    });
    if (summary) {
      // Numbers and codes only: the prompt goes as its id, never its text (analytics.ts sanitise).
      track('session_complete', minuteCompleteProps(summary, minutePrompt, secs));
    } else {
      track('session_complete', { kind: 'talk', pace: 'talking', wpm: stats.wpm, fillers_per_min: fillersPerMin, habit_words: counts.habitCount, seconds: Math.round(secs) });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
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

  const zone = zoneNow;
  const fillers = Object.entries(counts.fillers).sort((a, b) => b[1] - a[1]);
  const habits = Object.entries(counts.habits).sort((a, b) => b[1] - a[1]);
  // Not while a talk is running, paused or resuming: the prompt shouldn't change mid-talk.
  const canShuffle = !running && !pausedAt;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom + space(2) }]}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
          <Ionicons name="close" size={26} color={colors.muted} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.muted }]}>{minute ? 'One Minute' : 'Free talk'}</Text>
        <Text style={[styles.timer, { color: running ? colors.ink : colors.muted }]}>
          0:{String(running || pausedAt ? left : LIMIT_S).padStart(2, '0')}
        </Text>
      </View>

      {minute ? (
        <View style={styles.body}>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>
            LEVEL {minutePrompt.level} · {LEVEL_NAME[minutePrompt.level].toUpperCase()}
          </Text>
          <Text style={[minutePrompt.level === 3 ? styles.prompt : styles.word, { color: colors.ink }]}>{minutePrompt.text}</Text>
          {canShuffle && (
            <Pressable onPress={() => setShuffle((n) => n + 1)} hitSlop={8}>
              <Text style={[styles.shuffle, { color: colors.signal }]}>Different word</Text>
            </Pressable>
          )}
          {!running && !pausedAt && !notice && !failed && (
            <Text style={[styles.hint, { color: colors.muted }]}>
              Talk about it for one minute. Take your time to start: the quiet before your first word doesn’t count.
            </Text>
          )}
          {running && (
            <View style={styles.live}>
              <View style={styles.ribbonRow}>
                <VoiceRibbon level={level} color={colors.signal} />
              </View>
              <Text style={[styles.hint, { color: colors.muted }]}>Keep going. If you get stuck, say the word again.</Text>
            </View>
          )}
          {failed ? (
            <ListenError message={listener.error} code={listener.errorCode} onRetry={retryAfterError} onResume={listener.canResume ? resumeAfterError : undefined} />
          ) : (
            notice && <Text style={[styles.notice, { color: colors.stumble }]}>{notice}</Text>
          )}
        </View>
      ) : (
        <View style={styles.body}>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>TODAY’S PROMPT</Text>
          <Text style={[styles.prompt, { color: colors.ink }]}>{prompt}</Text>
          {canShuffle && (
            <Pressable onPress={() => setShuffle((n) => n + 1)} hitSlop={8}>
              <Text style={[styles.shuffle, { color: colors.signal }]}>Different prompt</Text>
            </Pressable>
          )}

          {running && (
            <View style={styles.live}>
              <View style={styles.liveRow}>
                <Text style={[styles.liveNum, { color: colors.ink }]}>{wpm || '–'}</Text>
                <Text style={[styles.liveUnit, { color: colors.muted }]}>wpm</Text>
                <Text
                  style={[
                    styles.zone,
                    { color: zone === 'good' ? colors.good : zone === 'fast' ? colors.stumble : zone === 'slow' ? colors.ember : colors.muted },
                  ]}
                >
                  {zone === 'good' ? 'In a good range' : zone === 'fast' ? 'Slow down' : zone === 'slow' ? 'A little slow' : ''}
                </Text>
              </View>
              <View style={styles.ribbonRow}>
                <VoiceRibbon level={level} color={colors.signal} />
              </View>
              <Text style={[styles.jarLabel, { color: colors.muted }]}>Filler jar · um, uh, erm</Text>
              <View style={styles.jar}>
                {fillers.length ? (
                  fillers.map(([w, n]) => (
                    <View key={w} style={[styles.chip, { borderColor: colors.line, backgroundColor: colors.surface }]}>
                      <Text style={[styles.chipText, { color: colors.ink }]}>
                        {w} <Text style={{ color: colors.stumble, fontWeight: '700' }}>×{n}</Text>
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.empty, { color: colors.muted }]}>Empty. Keep it that way.</Text>
                )}
              </View>
              {habits.length > 0 && (
                <Text style={[styles.habits, { color: colors.muted }]}>
                  Habit words (not scored): {habits.map(([w, n]) => `${w} ×${n}`).join(' · ')}
                </Text>
              )}
            </View>
          )}
          {failed ? (
            <ListenError
              message={listener.error}
              code={listener.errorCode}
              onRetry={retryAfterError}
              onResume={listener.canResume ? resumeAfterError : undefined}
            />
          ) : (
            notice && <Text style={[styles.notice, { color: colors.stumble }]}>{notice}</Text>
          )}
        </View>
      )}

      {running ? (
        <PrimaryButton label="Finish" onPress={finish} />
      ) : failed ? null : (
        <PrimaryButton
          label={listener.state === 'asking' ? 'Getting the mic ready…' : notice ? 'Try again' : 'Start talking'}
          onPress={() => begin()}
          busy={listener.state === 'asking'}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space(3) },
  top: { flexDirection: 'row', alignItems: 'center', gap: space(2), height: 48 },
  topTitle: { flex: 1, fontSize: 15, fontWeight: '600' },
  timer: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  body: { flex: 1, justifyContent: 'center', gap: space(2) },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.1 },
  prompt: { fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 37 },
  word: { fontFamily: fonts.displayBold, fontSize: 48, lineHeight: 56 },
  shuffle: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 15, lineHeight: 21 },
  live: { gap: space(1.25), marginTop: space(2) },
  liveRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  liveNum: { fontSize: 34, fontWeight: '700', fontVariant: ['tabular-nums'] },
  liveUnit: { fontSize: 15 },
  zone: { fontSize: 15, fontWeight: '600', marginLeft: space(1) },
  jarLabel: { fontSize: 13, fontWeight: '600' },
  ribbonRow: { marginBottom: 4 },
  habits: { fontSize: 14, lineHeight: 20 },
  jar: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1), minHeight: 36 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 15 },
  empty: { fontSize: 15 },
  notice: { fontSize: 15 },
});
