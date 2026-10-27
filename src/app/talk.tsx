import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { countFreeTalk, tokenise } from '../engine/align';
import { paceZone, sessionScore, wordsPerMinute } from '../engine/score';
import { promptOfTheDay } from '../content/prompts';
import { saveSession } from '../store/sessions';
import { listenLocale, useListener } from '../speech/useListener';
import { PrimaryButton } from '../components/ui';
import { useProfile } from '../store/profile';
import { track } from '../analytics';
import { useVoiceLevel, VoiceRibbon } from '../components/VoiceRibbon';
import { MicGate, gateStates } from '../components/MicGate';
import { ListenError } from '../components/ListenError';
import { fonts, space, useColors } from '../theme';

const LIMIT_S = 60;
const PAUSE_MS = 2500;
const MIN_WORDS = 15;

export default function FreeTalk() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const { level, onLevel } = useVoiceLevel();
  const listener = useListener([], { allowServer: profile.allowServerRecognition, onLevel, lang: listenLocale(profile.speechLang) });
  const [shuffle, setShuffle] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState<string | null>(null);
  const pauses = useRef(0);
  const prevHeard = useRef(0);
  const done = useRef(false);
  const prompt = promptOfTheDay(new Date(), shuffle);

  const heard = useMemo(() => tokenise(listener.transcript), [listener.transcript]);
  const counts = useMemo(() => countFreeTalk(heard), [heard]);
  const running = startedAt > 0 && listener.state === 'listening';
  const seconds = startedAt ? (now - startedAt) / 1000 : 0;
  const wpm = wordsPerMinute(counts.spoken, seconds);
  const zoneNow = paceZone(wpm, 'talking');
  const left = Math.max(0, Math.ceil(LIMIT_S - seconds));
  // The recogniser reported a problem (e.g. it can't listen for this English). Shown whatever the state.
  const failed = listener.error !== null || listener.state === 'error';

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // A long silence between words counts as a pause.
  useEffect(() => {
    if (!startedAt || !listener.lastHeardAt) return;
    if (prevHeard.current && listener.lastHeardAt - prevHeard.current > PAUSE_MS) pauses.current++;
    prevHeard.current = listener.lastHeardAt;
  }, [listener.lastHeardAt, startedAt]);

  /** Every attempt (first go, retry, after consent) starts from a clean slate. */
  const begin = async (override?: { allowServer?: boolean }) => {
    const isRetry = notice !== null || failed;
    listener.reset();
    pauses.current = 0;
    prevHeard.current = 0;
    done.current = false;
    setStartedAt(0);
    setNotice(null);
    await listener.start(override);
    setStartedAt(Date.now());
    track(isRetry ? 'session_retry' : 'session_start', { kind: 'talk', pace: 'talking', where: 'talk' });
  };

  /** Try again after a recogniser error: make sure the mic is off first, then start clean. */
  const retryAfterError = async () => {
    if (listener.state === 'listening') {
      done.current = true; // so the 60 s limit can't save this attempt while it stops
      await listener.stop();
    }
    begin();
  };

  const finish = async () => {
    if (done.current) return;
    done.current = true;
    await listener.stop();
    const secs = Math.max(1, (Date.now() - startedAt) / 1000);
    if (counts.spoken < MIN_WORDS) {
      // The guard resets in begin(), which the Try again button calls.
      setStartedAt(0);
      track('session_too_short', { spoken: counts.spoken, kind: 'talk' });
      setNotice(counts.spoken === 0 ? 'The mic didn’t hear anything. Hold the phone a little closer and try again.' : `Only ${counts.spoken} words came through. Try again a little closer to the mic.`);
      return;
    }
    const fillersPerMin = +(counts.fillerCount / (secs / 60)).toFixed(1);
    const stats = { wpm: wordsPerMinute(counts.spoken, secs), fillersPerMin, accuracy: null, midSentencePauses: pauses.current, seconds: secs };
    const id = `${Date.now()}`;
    await saveSession({
      id,
      passageId: 'talk',
      title: 'Free talk',
      at: Date.now(),
      wpm: stats.wpm,
      fillers: counts.fillerCount,
      fillersPerMin,
      topFiller: Object.entries(counts.fillers).sort((a, b) => b[1] - a[1])[0]?.[0],
      accuracy: null,
      pauses: pauses.current,
      seconds: Math.round(secs),
      score: sessionScore(stats, 'talking'),
      stumbled: [],
      context: 'talking',
      habits: counts.habitCount ? counts.habits : undefined,
    });
    track('session_complete', { kind: 'talk', pace: 'talking', wpm: stats.wpm, fillers_per_min: fillersPerMin, habit_words: counts.habitCount, seconds: Math.round(secs) });
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

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom + space(2) }]}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
          <Ionicons name="close" size={26} color={colors.muted} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.muted }]}>Free talk</Text>
        <Text style={[styles.timer, { color: running ? colors.ink : colors.muted }]}>
          0:{String(running ? left : LIMIT_S).padStart(2, '0')}
        </Text>
      </View>

      <View style={styles.body}>
        <Text style={[styles.eyebrow, { color: colors.muted }]}>TODAY’S PROMPT</Text>
        <Text style={[styles.prompt, { color: colors.ink }]}>{prompt}</Text>
        {!running && (
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
                {zone === 'good' ? 'Right in the pocket' : zone === 'fast' ? 'Slow down' : zone === 'slow' ? 'A little slow' : ''}
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
          <ListenError message={listener.error} onRetry={retryAfterError} />
        ) : (
          notice && <Text style={[styles.notice, { color: colors.stumble }]}>{notice}</Text>
        )}
      </View>

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
  shuffle: { fontSize: 16, fontWeight: '600' },
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(4), gap: space(2) },
  h2: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
});
