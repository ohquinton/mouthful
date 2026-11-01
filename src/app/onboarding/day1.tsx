import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { getSession, SavedSession } from '../../store/sessions';
import { useProfile } from '../../store/profile';
import { formatTime, REMINDER_OPTIONS, scheduleDailyReminder } from '../../reminders';
import { dashIndex, startingPoint, UM_NOTE } from '../../onboarding';
import { PrimaryButton } from '../../components/ui';
import { FLOW_FINE_PRINT } from '../../components/MinuteResult';
import { track } from '../../analytics';
import { fonts, space, useColors } from '../../theme';
import { Drop, TopBar } from './index';

type Reminder = { hour: number; minute: number };

// The times offered after the first talk. 7:30 am and 9 pm are left out to keep it to one short row plus "No reminder".
const TIMES: Reminder[] = REMINDER_OPTIONS.filter((o) => (o.hour === 8 && o.minute === 0) || o.hour === 12 || o.hour === 18);

/** Flow counts up to its number over 700 ms, ease out (docs/design/RESULTS-ANIMATIONS.md §1). */
function useCountUp(target: number | undefined, skip: boolean): { value: number; done: boolean } {
  const [tick, setTick] = useState({ value: 0, done: false });
  useEffect(() => {
    if (target === undefined || skip) return;
    const start = Date.now();
    const t = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / 700);
      setTick({ value: Math.round(target * (1 - Math.pow(1 - p, 3))), done: p >= 1 });
      if (p >= 1) clearInterval(t);
    }, 16);
    return () => clearInterval(t);
  }, [target, skip]);
  // Reduce Motion (or nothing to count yet): the final number straight away.
  if (skip || target === undefined) return { value: target ?? 0, done: true };
  return tick;
}

/**
 * "Your starting point": the first 30-second topic talk's Flow, a short honest table, the number to
 * beat tomorrow and a reminder time. talk.tsx replaces itself with this screen (`?id=<sessionId>`).
 * Brief: docs/briefs/remodel-screens.md section 1.4.
 */
export default function StartingPoint() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { update } = useProfile();
  const [s, setS] = useState<SavedSession>();
  const [loadFailed, setLoadFailed] = useState(false);
  // Route params come from outside: no usable id means nothing to load.
  const badId = typeof id !== 'string' || !id;
  const missing = badId || loadFailed;
  // Nothing chosen until they tap (undefined): a reminder is a yes they give, not one we assume.
  // null is an explicit "No reminder". Neither schedules anything.
  const [time, setTime] = useState<Reminder | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (badId) return;
    getSession(id)
      .then((found) => (found ? setS(found) : setLoadFailed(true)))
      .catch(() => setLoadFailed(true));
  }, [id, badId]);

  const point = startingPoint(s);
  const count = useCountUp(point?.flow, reduceMotion);

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    const ok = time ? await scheduleDailyReminder(time.hour, time.minute).catch(() => false) : false;
    await update({ onboarded: true, reminder: ok && time ? time : null });
    track('onboarding_complete', { flow: point?.flow ?? null, reminder: ok, recorded: !!s?.recordings?.length });
    // No paywall here: the full paywall waits until after their first own-script run, so they've
    // seen what the app does before we ask (docs/briefs/aha-before-paywall.md).
    // Clear the onboarding stack so Android back from Home doesn't land on the hook again.
    if (router.canDismiss()) router.dismissAll();
    router.replace('/');
  };

  const back = router.canGoBack() ? () => router.back() : undefined;
  const screenStyle = [styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + space(1), paddingBottom: insets.bottom + space(2) }];

  // No session, or not a finished topic talk (storage failed, an odd link): never a blank screen.
  if (missing || (s && !point)) {
    return (
      <View style={screenStyle}>
        <TopBar onBack={back} active={dashIndex('start')} />
        <View style={styles.empty}>
          <Drop height={96} look="up" />
          <Text style={[styles.lead, styles.centerText, { color: colors.ink }]}>Couldn’t load that talk. Your line is ready anyway.</Text>
        </View>
        <View style={styles.foot}>
          <PrimaryButton label="See my line" onPress={finish} busy={busy} />
        </View>
      </View>
    );
  }
  // Loading is near instant: show the page colour, not a spinner.
  if (!point) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  // Rows fade in 100 ms apart after the count starts. Nothing moves under Reduce Motion.
  const enter = (i: number) => (reduceMotion ? undefined : FadeInDown.duration(260).delay(150 + i * 100));
  const rows = point.rows;

  return (
    <View style={screenStyle}>
      <TopBar onBack={back} active={dashIndex('start')} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.wrap}>
        <Text style={[styles.eyebrow, { color: colors.muted }]}>YOUR STARTING POINT</Text>
        <View style={styles.flowRow} accessible accessibilityLabel={`Flow ${point.flow}`}>
          <Text style={[styles.flow, { color: colors.ink }]}>{count.value}</Text>
          <Text style={[styles.flowUnit, { color: colors.muted }]}>Flow</Text>
        </View>
        <Text style={[styles.fine, { color: colors.ink }]}>{FLOW_FINE_PRINT}</Text>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          {rows.map((r, i) => (
            <Animated.View
              key={r.label}
              entering={enter(i)}
              style={[styles.row, i < rows.length - 1 && { borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth }]}
            >
              <Text style={[styles.rowLabel, { color: colors.ink }]}>{r.label}</Text>
              <Text style={[styles.rowValue, { color: colors.ink }]}>{r.value}</Text>
            </Animated.View>
          ))}
        </View>
        <Text style={[styles.note, { color: colors.muted }]}>{UM_NOTE}</Text>

        {/* The Drop sits by the coaching line, never beside the number (ANIMATION.md). Happy eyes
            once the count lands, and only after a talk that kept going. */}
        <Animated.View entering={enter(rows.length)} style={styles.dropRow}>
          <Drop height={76} look={point.keptGoing && count.done && !reduceMotion ? 'happy' : 'rest'} blink={!reduceMotion} />
          <Text style={[styles.tomorrow, { color: colors.ink }]}>{point.tomorrow}</Text>
        </Animated.View>

        <Text style={[styles.h2, { color: colors.ink }]}>Remind me each day</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {TIMES.map((o) => {
            const on = time?.hour === o.hour && time?.minute === o.minute;
            return (
              <Pressable
                key={`${o.hour}:${o.minute}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => setTime(o)}
                style={[styles.chip, { borderColor: on ? colors.signal : colors.line, backgroundColor: on ? colors.signalSoft : colors.surface }]}
              >
                <Text style={[styles.chipText, { color: colors.ink }]}>{formatTime(o.hour, o.minute)}</Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: time === null }}
            onPress={() => setTime(null)}
            style={[styles.chip, { borderColor: time === null ? colors.signal : colors.line, backgroundColor: time === null ? colors.signalSoft : colors.surface }]}
          >
            <Text style={[styles.chipText, { color: colors.ink }]}>No reminder</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.foot}>
        <PrimaryButton label="See my line" onPress={finish} busy={busy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space(3), gap: space(1) },
  flex: { flex: 1 },
  wrap: { gap: space(2), paddingTop: space(1), paddingBottom: space(2) },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: space(2) },
  centerText: { textAlign: 'center' },
  eyebrow: { fontSize: 13, fontWeight: '800', letterSpacing: 1.3 },
  flowRow: { flexDirection: 'row', alignItems: 'baseline', gap: space(1.5) },
  flow: { fontFamily: fonts.display, fontSize: 96, lineHeight: 104, letterSpacing: -2, fontVariant: ['tabular-nums'] },
  flowUnit: { fontFamily: fonts.displayBold, fontSize: 26 },
  fine: { fontSize: 15, lineHeight: 21, marginTop: -space(1) },
  lead: { fontSize: 17, lineHeight: 25 },
  card: { borderWidth: 1, borderRadius: 18, paddingHorizontal: space(2) },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space(1.75), gap: space(1) },
  rowLabel: { fontSize: 17, flexShrink: 1 },
  rowValue: { fontSize: 17, fontWeight: '800' },
  note: { fontSize: 14, lineHeight: 19, marginTop: -space(1) },
  dropRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(0.5) },
  tomorrow: { flex: 1, fontSize: 19, lineHeight: 26, fontWeight: '600' },
  h2: { fontSize: 20, fontWeight: '800', marginTop: space(0.5) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1) },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: space(2), paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  chipText: { fontSize: 16, fontWeight: '600' },
  foot: { gap: space(1.5) },
});
