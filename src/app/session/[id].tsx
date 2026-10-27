import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
import { PaceContext, pacerIndex, pacerWpm, paceZone, sessionScore, wordsPerMinute } from '../../engine/score';
import type { Passage } from '../../content/passages';
import { resolvePassage } from '../../content/resolve';
import { saveSession } from '../../store/sessions';
import { deleteRecordingFiles } from '../../store/recordings';
import { encodeStatuses } from '../../engine/review';
import { recordCorrection, recordWords, resultsFromSession } from '../../store/words';
import { useProfile } from '../../store/profile';
import { markStep } from '../../plan';
import { track } from '../../analytics';
import { useListener } from '../../speech/useListener';
import { GlideWord, WordBox } from '../../components/GlideWord';
import { InkCursor } from '../../components/InkCursor';
import { useVoiceLevel, VoiceRibbon } from '../../components/VoiceRibbon';
import { MicGate, gateStates } from '../../components/MicGate';
import { space, useColors } from '../../theme';
import { DICTIONARY } from '../../content/wordpacks';
import { sourceOf } from '../../content/resolve';

const MID_SENTENCE_PAUSE_MS = 2000;
const BREATH_PAUSE_MS = 450;
const LOST_AFTER_MS = 6000;
const MIN_WORDS_TO_SCORE = 15;

function defaultPace(id: string): PaceContext {
  return id.startsWith('s.') ? 'presenting' : 'reading';
}

export default function GlideSession() {
  const { id, cold, step, pace } = useLocalSearchParams<{ id: string; cold?: string; step?: string; pace?: PaceContext }>();
  const colors = useColors();
  const [passage, setPassage] = useState<Passage | null | undefined>(undefined);

  useEffect(() => {
    resolvePassage(id ?? '').then((p) => setPassage(p ?? null));
  }, [id]);

  if (passage === undefined) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (passage === null) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <Text style={[styles.body, { color: colors.ink }]}>That passage doesn't exist.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.link, { color: colors.muted }]}>Go back</Text>
        </Pressable>
      </View>
    );
  }
  return <GlideSessionView passage={passage} cold={cold === '1'} step={step} pace={pace ?? defaultPace(passage.id)} />;
}

function GlideSessionView({ passage, cold, step, pace }: { passage: Passage; cold: boolean; step?: string; pace: PaceContext }) {
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
  });

  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState<string | null>(null);
  const [breathFilled, setBreathFilled] = useState<Set<number>>(new Set());
  const [corrected, setCorrected] = useState<Set<number>>(new Set());
  const [tooShort, setTooShort] = useState(false);

  const startedAt = useRef(0); // first recognised word, so a slow start doesn't hurt pace
  const lastAdvanceAt = useRef(0);
  const prevNext = useRef(0);
  const pauses = useRef(0);
  const skipToastShown = useRef(false);
  const finished = useRef(false);
  const firstWordLag = useRef<number | undefined>(undefined);
  const boxes = useRef<WordBox[]>([]);
  const scroller = useRef<ScrollViewInstance>(null);
  const toast = useRef(new Animated.Value(0)).current;

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

  const seconds = startedAt.current ? (now - startedAt.current) / 1000 : 0;
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

  const onCorrect = useCallback(
    (idx: number) => {
      setCorrected((s) => new Set(s).add(idx));
      Haptics.selectionAsync().catch(() => {});
      // Never the word itself: a script's words are private. Length and source are enough to spot patterns.
      track('recognition_correction', {
        where: 'glide',
        source: sourceOf(passage.id),
        length: words[idx]?.key.length ?? 0,
        pack_word: DICTIONARY.has(words[idx]?.key ?? ''),
        position: Math.round((idx / Math.max(1, words.length)) * 10) / 10,
      });
    },
    [words, passage.id],
  );

  // React to the pointer moving: pauses, breath marks, haptics, auto-scroll.
  useEffect(() => {
    if (heard.length && !startedAt.current) {
      startedAt.current = Date.now();
      lastAdvanceAt.current = Date.now();
      if (voiceAt.current) firstWordLag.current = startedAt.current - voiceAt.current;
    }
    if (a.next === prevNext.current) return;

    const t = Date.now();
    const gap = t - lastAdvanceAt.current;
    // Capture the index now: the state updater runs later, after prevNext has moved on.
    const beforeIdx = prevNext.current - 1;
    const before = words[beforeIdx];
    if (before && gap > BREATH_PAUSE_MS && before.breathAfter) {
      setBreathFilled((s) => new Set(s).add(beforeIdx));
    } else if (before && gap > MID_SENTENCE_PAUSE_MS && !before.breathAfter) {
      pauses.current++;
    }
    for (let k = prevNext.current; k < a.next; k++) {
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
  }, [a.next, a.skipped, heard.length, words, height, showToast]);

  const finish = useCallback(async () => {
    if (finished.current) return;
    finished.current = true;
    const recordings = await listener.stop();
    if (a.spoken < MIN_WORDS_TO_SCORE) {
      // Stay finished (the mic is off) until they choose Try again. Don't keep audio we won't use.
      deleteRecordingFiles(recordings);
      track('session_too_short', { spoken: a.spoken });
      setTooShort(true);
      return;
    }
    const secs = Math.max(1, (Date.now() - startedAt.current) / 1000);
    const fillersPerMin = +(a.fillerCount / (secs / 60)).toFixed(1);
    const attempted = a.read + a.skipped;
    const accuracy = attempted ? Math.round((a.read / attempted) * 100) : 0;
    const stats = { wpm: wordsPerMinute(a.spoken, secs), fillersPerMin, accuracy, midSentencePauses: pauses.current, seconds: secs };
    const topFiller = Object.entries(a.fillers).sort((x, y) => y[1] - x[1])[0]?.[0];
    const stumbled = stumbledWords(words, a);
    const sessionId = `${Date.now()}`;
    await saveSession({
      id: sessionId,
      passageId: passage.id,
      title: passage.title,
      at: Date.now(),
      wpm: stats.wpm,
      fillers: a.fillerCount,
      fillersPerMin,
      topFiller,
      accuracy,
      pauses: pauses.current,
      seconds: Math.round(secs),
      score: sessionScore(stats, pace),
      stumbled,
      context: pace,
      readCount: a.read,
      skippedWords: skippedWords(words, a),
      stumbledContext: stumbledContexts(words, a, stumbled),
      corrected: [...corrected].map((i) => words[i].display.replace(/[^A-Za-z'’-]/g, '')),
      recordings: recordings.length ? recordings : undefined,
      habits: a.habitCount ? a.habits : undefined,
      review: tester
        ? {
            statuses: encodeStatuses(a.status, corrected),
            transcript: listener.transcript,
            marks: { said: [], notSaid: [] },
            firstWordLagMs: firstWordLag.current,
          }
        : undefined,
    });
    await recordWords(resultsFromSession(words, a));
    for (const i of corrected) await recordCorrection(words[i].display);
    await markStep(profile, update, step);
    track('session_complete', {
      kind: passage.id.split('.')[0],
      pace,
      wpm: stats.wpm,
      accuracy,
      fillers_per_min: fillersPerMin,
      corrections: corrected.size,
      seconds: Math.round(secs),
      recorded: recordings.length > 0,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (isBaseline && !profile.onboarded) router.replace({ pathname: '/onboarding/day1', params: { id: sessionId } });
    else router.replace({ pathname: '/tape', params: { id: sessionId } });
  }, [a, listener, passage, words, pace, corrected, profile, update, step, isBaseline, tester]);

  /** A real restart: clean transcript, timer, corrections, marks and pauses, then listen again. */
  const retry = useCallback(() => {
    listener.reset();
    startedAt.current = 0;
    voiceAt.current = 0;
    firstWordLag.current = undefined;
    lastAdvanceAt.current = 0;
    prevNext.current = 0;
    pauses.current = 0;
    skipToastShown.current = false;
    setCorrected(new Set());
    setBreathFilled(new Set());
    setNotice(null);
    setTooShort(false);
    scroller.current?.scrollTo({ y: 0, animated: true });
    finished.current = false;
    track('session_retry', { where: 'glide' });
    listener.start();
  }, [listener]);

  // The session ends itself on the last word.
  useEffect(() => {
    if (a.done) finish();
  }, [a.done, finish]);

  if (gateStates.includes(listener.state)) {
    return <MicGate state={listener.state} onAllowed={() => listener.start({ allowServer: true })} />;
  }

  const lost = listener.state === 'listening' && startedAt.current > 0 && !a.done && now - lastAdvanceAt.current > LOST_AFTER_MS;
  const offScript = heard.length >= 20 && a.read < 6;
  const zoneColor = zone === 'good' ? colors.good : zone === 'fast' ? colors.stumble : zone === 'slow' ? colors.ember : colors.line;
  const cursorBox = boxes.current[a.next];
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

      {/* The passage. Only the words, the ink cursor and the footer move. */}
      <ScrollView
        ref={scroller}
        contentContainerStyle={[styles.passage, { paddingTop: height * 0.12, paddingBottom: height * 0.5 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.flow}>
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
          <Text style={[styles.h2, { color: colors.ink }]}>You haven't seen this one.</Text>
          <Text style={[styles.body, { color: colors.muted, textAlign: 'center' }]}>
            Like the real thing: no rehearsal. Tap, then start reading straight away.
          </Text>
          <View style={[styles.primary, { backgroundColor: colors.button }]}>
            <Text style={styles.primaryText}>Reveal and start</Text>
          </View>
        </Pressable>
      )}

      {tooShort && (
        <View style={[styles.retry, { backgroundColor: colors.surface, borderColor: colors.line, bottom: insets.bottom + 72 }]} accessibilityLiveRegion="polite">
          <Text style={[styles.retryTitle, { color: colors.ink }]}>Didn’t catch enough to score</Text>
          <Text style={[styles.retryBody, { color: colors.muted }]}>
            {a.spoken === 0 ? 'The mic didn’t hear anything.' : `Only ${a.spoken} words came through.`} Hold the phone a little closer and read at a normal volume.
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
      )}

      {/* Quiet nudges */}
      {!tooShort && (lost || offScript || listener.state === 'asking') && (
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

      {/* Footer: voice ribbon, live pace, pacer, finish */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + space(1.5) }]}>
        <View style={styles.footerRow}>
          <View style={styles.paceGroup}>
            <VoiceRibbon level={level} color={listener.state === 'listening' ? zoneColor : colors.line} />
            <Text style={[styles.wpm, { color: colors.ink }]}>{wpm || '–'}</Text>
            <Text style={[styles.wpmUnit, { color: colors.muted }]}>wpm</Text>
            <Text style={[styles.pacerLabel, { color: colors.signal }]}>Pacer {pacerAt}</Text>
          </View>
          {!tooShort && (
            <Pressable hitSlop={12} onPress={finish} accessibilityRole="button">
              <Text style={[styles.finish, { color: colors.muted }]}>Finish</Text>
            </Pressable>
          )}
        </View>
      </View>
      <View style={[styles.paceLine, { backgroundColor: zoneColor, bottom: insets.bottom }]} />
      {listener.error ? <Text style={[styles.err, { color: colors.stumble }]}>{listener.error}</Text> : null}
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
  err: { position: 'absolute', bottom: 80, alignSelf: 'center', fontSize: 13 },
  cold: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: space(4), gap: space(2) },
  coldEyebrow: { fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(4), gap: space(2) },
  h2: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 17, lineHeight: 24 },
  primary: { borderRadius: 14, paddingHorizontal: space(3), paddingVertical: 14, marginTop: space(1) },
  primaryText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  link: { fontSize: 16, padding: space(1) },
  retry: { position: 'absolute', left: space(2), right: space(2), borderWidth: 1, borderRadius: 18, padding: space(2), gap: space(1) },
  retryTitle: { fontSize: 18, fontWeight: '700' },
  retryBody: { fontSize: 15, lineHeight: 21 },
  retryRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(0.5) },
  retryBtn: { borderRadius: 12, paddingHorizontal: space(2.5), paddingVertical: 12 },
});
