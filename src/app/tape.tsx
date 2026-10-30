import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { coachingLine, PACE_BANDS, paceZone } from '../engine/score';
import { correctSessionWord, loadSessions, SavedSession, streak, updateSession } from '../store/sessions';
import { recordCorrection } from '../store/words';
import { useProfile } from '../store/profile';
import { getMoment } from '../content/moments';
import { DICTIONARY } from '../content/wordpacks';
import { resolvePassage, sourceOf } from '../content/resolve';
import { preparePassage, PassageWord } from '../engine/align';
import { paceSteadiness, PaceSegment } from '../engine/steadiness';
import { PaceStrip } from '../components/PaceStrip';
import { ahaPaywallDue, ahaPaywallRoute, claimAhaPaywall, requirePro } from '../pro';
import { track } from '../analytics';
import { fonts, space, useColors } from '../theme';

const CONTEXT_LABEL = { reading: 'reading aloud', presenting: 'presenting', talking: 'talking' } as const;

export default function Tape() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, update } = useProfile();
  const [s, setS] = useState<SavedSession>();
  const [all, setAll] = useState<SavedSession[]>([]);
  const [prev, setPrev] = useState<SavedSession>();
  const [days, setDays] = useState(0);
  const [shown, setShown] = useState(0);
  const [passageWords, setPassageWords] = useState<PassageWord[]>([]);
  const [count] = useState(() => new Animated.Value(0));

  useEffect(() => {
    loadSessions().then((all) => {
      const i = all.findIndex((x) => x.id === id);
      if (i < 0) return;
      setAll(all);
      setS(all[i]);
      if (all[i].segments) resolvePassage(all[i].passageId).then((p) => p && setPassageWords(preparePassage(p.text)));
      setPrev(all.slice(0, i).reverse().find((x) => x.passageId === all[i].passageId) ?? all[i - 1]);
      setDays(streak(all).days);
      // The one celebratory moment: the score counts up over 600ms.
      count.addListener(({ value }) => setShown(Math.round(value)));
      Animated.timing(count, { toValue: all[i].score, duration: 600, useNativeDriver: false }).start();
    });
    return () => count.removeAllListeners();
  }, [id, count]);

  // ---- The full paywall after the free run (docs/briefs/aha-before-paywall.md) ----
  // Never on top of the Tape: they see their result and can tap "I said it" first. It opens as
  // they leave (Done, the plan row, Read it again, or a back gesture), once. The numbers come from
  // `s` as it is now, so corrections count. claimAhaPaywall() makes it once per launch whoever
  // asks (Today asks too, on focus, for a reader whose app was killed here); the profile flag
  // makes it once for good.
  const ahaDue = !!s && ahaPaywallDue({ profile, sessions: all, sessionId: s.id });

  /** If the aha paywall is due and nobody has opened it yet, claims it and returns its route. */
  const takeAha = () => {
    if (!ahaDue || !s || !claimAhaPaywall()) return undefined;
    update({ ahaPaywallShown: true });
    return ahaPaywallRoute(s, profile.moment);
  };

  // A back gesture (iOS swipe, Android back, the browser's back) leaves without our buttons.
  // Expo Router 58 emits `removed` once this screen is out of the stack, however it left; our
  // buttons claim the paywall before they navigate, so for them this finds nothing to do. It
  // fires after unmount, so it reads the last render's takeAha from a ref, and (as the router
  // docs say) the unsubscribe waits a microtask so the event still reaches us. The paywall then
  // opens over wherever they landed.
  const navigation = useNavigation();
  const takeAhaRef = useRef(takeAha);
  useEffect(() => {
    takeAhaRef.current = takeAha;
  });
  useEffect(() => {
    const unsubscribe = navigation.addListener('removed', () => {
      const route = takeAhaRef.current();
      if (route) setTimeout(() => router.push(route), 0);
    });
    return () => queueMicrotask(unsubscribe);
  }, [navigation]);

  const done = () => {
    const route = takeAha();
    router.dismissTo('/');
    if (route) router.push(route);
  };

  const again = () => {
    if (!s) return;
    const route = takeAha();
    if (route) return router.replace(route);
    if (s.passageId === 'talk') router.replace('/talk');
    else router.replace({ pathname: '/session/[id]', params: { id: s.passageId, pace: s.context ?? 'reading' } });
  };

  if (!s) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const ctx = s.context ?? (s.passageId === 'talk' ? 'talking' : 'reading');
  const [lo, hi] = PACE_BANDS[ctx];
  const zone = paceZone(s.wpm, ctx);
  const delta = prev ? s.score - prev.score : null;
  const steady = s.segments ? paceSteadiness(s.segments) : undefined;
  const line = coachingLine(
    { wpm: s.wpm, fillersPerMin: s.fillersPerMin, accuracy: s.accuracy, midSentencePauses: s.pauses, seconds: s.seconds, steadiness: steady?.score ?? s.steadiness },
    s.topFiller,
    ctx,
  );
  const moment = getMoment(profile.moment?.id);
  const snippet = (seg: PaceSegment) =>
    passageWords
      .slice(seg.start, seg.start + 4)
      .map((w) => w.display)
      .join(' ')
      .replace(/[,;:.!?]+$/, '');
  const habitList = Object.entries(s.habits ?? {}).sort((x, y) => y[1] - x[1]).slice(0, 4);

  const sayIt = async (word: string) => {
    const next = correctSessionWord(s, word);
    setS(next);
    count.setValue(next.score);
    setShown(next.score);
    await updateSession(s.id, next);
    await recordCorrection(word);
    Haptics.selectionAsync().catch(() => {});
    track('recognition_correction', { where: 'tape', source: sourceOf(s.passageId), length: word.length, pack_word: DICTIONARY.has(word.toLowerCase()) });
  };

  const tiles = [
    {
      label: 'Pace',
      value: `${s.wpm}`,
      unit: 'wpm',
      note: zone === 'good' ? `in the ${lo}–${hi} range` : zone === 'fast' ? `above ${hi}` : `below ${lo}`,
      tone: zone === 'good' ? colors.good : colors.ember,
    },
    { label: 'Fillers', value: `${s.fillersPerMin}`, unit: '/min', note: s.topFiller ? `mostly “${s.topFiller}”` : 'none', tone: colors.muted },
    s.accuracy === null
      ? { label: 'Length', value: `${s.seconds}`, unit: 's', note: 'unscripted', tone: colors.muted }
      : { label: 'Words read', value: `${s.accuracy}`, unit: '%', note: s.stumbled.length ? `${s.stumbled.length} missed` : 'all of them', tone: colors.muted },
    { label: 'Pauses', value: `${s.pauses}`, unit: '', note: 'mid-sentence', tone: colors.muted },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.wrap, { paddingTop: insets.top + space(2), paddingBottom: insets.bottom + space(3) }]}
    >
      <View style={styles.row}>
        <Text style={[styles.eyebrow, { color: colors.muted }]} numberOfLines={1}>
          THE TAPE · {s.title.toUpperCase()}
        </Text>
        <Text style={[styles.streak, { color: colors.ember, borderColor: colors.line }]}>🔥 {days}</Text>
      </View>

      <View style={styles.scoreRow}>
        <Text style={[styles.score, { color: colors.ink }]}>{shown}</Text>
        <Text style={[styles.outOf, { color: colors.muted }]}>/100</Text>
      </View>
      {delta !== null && (
        <Text style={[styles.delta, { color: delta >= 0 ? colors.good : colors.muted }]}>
          {delta >= 0 ? `+${delta}` : delta} vs last time
        </Text>
      )}

      <View style={styles.grid}>
        {tiles.map((t) => (
          <View key={t.label} style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={[styles.tileLabel, { color: colors.muted }]}>{t.label}</Text>
            <Text style={[styles.tileValue, { color: colors.ink }]}>
              {t.value}
              <Text style={[styles.tileUnit, { color: colors.muted }]}> {t.unit}</Text>
            </Text>
            <Text style={[styles.tileNote, { color: t.tone }]}>{t.note}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.fine, { color: colors.muted }]}>
        Suggested pace for {CONTEXT_LABEL[ctx]}: {lo}–{hi} wpm. It’s a guide, not a rule.
      </Text>
      {habitList.length > 0 && (
        <Text style={[styles.fine, { color: colors.muted }]}>
          Habit words, not scored: {habitList.map(([w, n]) => `“${w}” ×${n}`).join(' · ')}. Fillers count only um, uh and erm.
        </Text>
      )}

      {steady && s.segments && passageWords.length > 0 && (
        <PaceStrip segments={s.segments} steady={steady} band={[lo, hi]} snippet={snippet} colors={colors} />
      )}

      <Text style={[styles.coach, { color: colors.ink }]}>{line}</Text>

      {s.stumbled.length > 0 && (
        <View style={[styles.fixCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.fixEyebrow, { color: colors.cardMuted }]}>
            MISSED · {s.stumbled.length} {s.stumbled.length === 1 ? 'WORD' : 'WORDS'}
          </Text>
          {s.stumbled.map((w) => (
            <View key={w} style={styles.fixRow}>
              <Text style={[styles.fixWord, { color: colors.cardInk }]}>{w}</Text>
              <Pressable
                onPress={() => sayIt(w)}
                hitSlop={6}
                accessibilityLabel={`I did say ${w}`}
                style={[styles.saidIt, { borderColor: colors.cardMuted }]}
              >
                <Text style={[styles.saidItText, { color: colors.cardInk }]}>I said it</Text>
              </Pressable>
            </View>
          ))}
          <Text style={[styles.fixNote, { color: colors.cardMuted }]}>
            Speech recognition gets some words wrong, especially with accents. If you said it, tap “I said it”.
          </Text>
          <Pressable
            style={[styles.primary, { backgroundColor: colors.button }]}
            onPress={() => requirePro(profile, 'fixit') && router.push({ pathname: '/fixit', params: { sid: s.id } })}
          >
            <Text style={styles.primaryText}>Practise them · 1 min</Text>
          </Pressable>
        </View>
      )}

      {moment && (
        <Pressable
          onPress={done}
          style={({ pressed }) => [styles.planRow, { backgroundColor: colors.signalSoft, opacity: pressed ? 0.8 : 1 }]}
        >
          <Ionicons name="list" size={20} color={colors.signal} />
          <Text style={[styles.planText, { color: colors.ink }]}>Back to your {moment.short} plan</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      )}

      <Pressable style={[styles.secondary, { borderColor: colors.line }]} onPress={done}>
        <Text style={[styles.secondaryText, { color: colors.ink }]}>Done</Text>
      </Pressable>
      <Pressable onPress={again}>
        <Text style={[styles.again, { color: colors.muted }]}>{s.passageId === 'talk' ? 'Try another prompt' : 'Read it again'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space(3), gap: space(2) },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontSize: 12, fontWeight: '600', letterSpacing: 1, flexShrink: 1, marginRight: 8 },
  streak: { flexShrink: 0, fontSize: 14, fontWeight: '600', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: space(1) },
  score: { fontFamily: fonts.display, fontSize: 88, lineHeight: 92 },
  outOf: { fontSize: 20, fontWeight: '600', marginBottom: 14 },
  delta: { fontSize: 15, fontWeight: '600', marginTop: -space(1) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5) },
  tile: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: 14, padding: space(1.75), gap: 2 },
  tileLabel: { fontSize: 13, fontWeight: '500' },
  tileValue: { fontSize: 26, fontWeight: '600', fontVariant: ['tabular-nums'] },
  tileUnit: { fontSize: 13, fontWeight: '400' },
  tileNote: { fontSize: 13 },
  fine: { fontSize: 13, marginTop: -space(1) },
  coach: { fontSize: 17, lineHeight: 24 },
  fixCard: { borderRadius: 18, padding: space(2), gap: space(1) },
  fixEyebrow: { fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  fixRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 },
  fixWord: { fontFamily: fonts.reading, fontSize: 20, flexShrink: 1 },
  saidIt: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  saidItText: { fontSize: 13, fontWeight: '600' },
  fixNote: { fontSize: 13, lineHeight: 18 },
  primary: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: space(1) },
  primaryText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), borderRadius: 16, padding: space(2) },
  planText: { flex: 1, fontSize: 16, fontWeight: '600' },
  secondary: { borderWidth: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  secondaryText: { fontSize: 17, fontWeight: '600' },
  again: { fontSize: 14, textAlign: 'center', padding: space(1) },
});
