import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PACE_BANDS } from '../../engine/score';
import { getSession, SavedSession } from '../../store/sessions';
import { useProfile } from '../../store/profile';
import { formatTime, REMINDER_OPTIONS, scheduleDailyReminder } from '../../reminders';
import { clock, heardClearly, paceRangeLine, remindersShown } from '../../onboarding';
import { PrimaryButton } from '../../components/ui';
import { track } from '../../analytics';
import { fonts, space, useColors } from '../../theme';

type Reminder = { hour: number; minute: number };

// The times offered after the first read. 7:30 am is left out to keep it to one short row plus "No reminder".
const TIMES: Reminder[] = REMINDER_OPTIONS.filter((o) => !(o.hour === 7 && o.minute === 30));

/**
 * "Your starting point": the first read's pace and how many words the phone heard clearly.
 * No accuracy % and no fillers (on-device recognisers drop "um", so it's often a misleading 0).
 * Brief: docs/briefs/onboarding-redesign.md, screen 5.
 */
export default function StartingPoint() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, update } = useProfile();
  const [s, setS] = useState<SavedSession>();
  const [missing, setMissing] = useState(false);
  // Nothing chosen until they tap (undefined): a reminder is a yes they give, not one we assume.
  // null is an explicit "No reminder". Neither schedules anything.
  const [time, setTime] = useState<Reminder | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSession(id ?? '')
      .then((found) => (found ? setS(found) : setMissing(true)))
      .catch(() => setMissing(true));
  }, [id]);

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    const ok = time ? await scheduleDailyReminder(time.hour, time.minute).catch(() => false) : false;
    await update({ onboarded: true, baselineSessionId: s ? id : profile.baselineSessionId, reminder: ok && time ? time : null });
    track('onboarding_complete', { wpm: s?.wpm ?? null, reminder: ok, recorded: !!s?.recordings?.length });
    // No paywall here: the full paywall waits until after their first own-script run, so they've
    // seen their own words ink in before we ask (docs/briefs/aha-before-paywall.md).
    // Clear the onboarding stack so Android back from Today doesn't land on the hook again.
    if (router.canDismiss()) router.dismissAll();
    router.replace('/');
  };

  const readAgain = () => router.replace({ pathname: '/session/[id]', params: { id: 'baseline' } });

  // The session couldn't be read back (storage failed). Don't strand them on a blank screen.
  if (missing) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.bg, paddingBottom: insets.bottom + space(3) }]}>
        <Text style={[styles.lead, { color: colors.ink }]}>Couldn’t load that read. Your plan is ready anyway.</Text>
        <PrimaryButton label="See my plan" onPress={finish} busy={busy} />
      </View>
    );
  }
  if (!s) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const heard = heardClearly(s);
  const showReminders = remindersShown(profile.moment?.date);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + space(3), paddingBottom: insets.bottom + space(2) }]}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.wrap}>
        <Text style={[styles.eyebrow, { color: colors.muted }]}>YOUR STARTING POINT</Text>
        <View style={styles.paceRow}>
          <Text style={[styles.pace, { color: colors.ink }]}>{s.wpm}</Text>
          <Text style={[styles.paceUnit, { color: colors.muted }]}>{s.wpm === 1 ? 'word a minute' : 'words a minute'}</Text>
        </View>
        <Text style={[styles.lead, { color: colors.ink }]}>{paceRangeLine(s.wpm, PACE_BANDS.reading)}</Text>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          {heard && (
            <View style={[styles.row, { borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <Text style={[styles.rowLabel, { color: colors.ink }]}>Heard clearly</Text>
              <Text style={[styles.rowValue, { color: colors.ink }]}>
                {heard.heard} of {heard.of} {heard.of === 1 ? 'word' : 'words'}
              </Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.ink }]}>Time</Text>
            <Text style={[styles.rowValue, { color: colors.ink }]}>{clock(s.seconds)}</Text>
          </View>
        </View>
        <Text style={[styles.note, { color: colors.muted }]}>
          Phones miss some words, especially with accents. On any read, tap a red word you said.
        </Text>

        {showReminders && (
          <>
            <Text style={[styles.h2, { color: colors.ink }]}>Remind me to practise</Text>
            <View style={styles.chips}>
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
          </>
        )}
      </ScrollView>

      <View style={styles.foot}>
        <PrimaryButton label="See my plan" onPress={finish} busy={busy} />
        <Pressable onPress={readAgain} hitSlop={8} accessibilityRole="button" disabled={busy}>
          <Text style={[styles.link, { color: colors.muted }]}>Read it again</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space(3), gap: space(2) },
  flex: { flex: 1 },
  wrap: { gap: space(2), paddingBottom: space(2) },
  empty: { flex: 1, justifyContent: 'center', paddingHorizontal: space(3), gap: space(2) },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  paceRow: { flexDirection: 'row', alignItems: 'baseline', gap: space(1.5), flexWrap: 'wrap' },
  pace: { fontFamily: fonts.displayBold, fontSize: 72, lineHeight: 80 },
  paceUnit: { fontSize: 17 },
  lead: { fontSize: 17, lineHeight: 25 },
  card: { borderWidth: 1, borderRadius: 16, paddingHorizontal: space(2) },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space(1.75), gap: space(1) },
  rowLabel: { fontSize: 16 },
  rowValue: { fontSize: 16, fontWeight: '700' },
  note: { fontSize: 13, lineHeight: 18, marginTop: -space(0.5) },
  h2: { fontSize: 20, fontWeight: '700', marginTop: space(1) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1) },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: space(1.75), paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  chipText: { fontSize: 15, fontWeight: '500' },
  foot: { gap: space(1.5) },
  link: { fontSize: 15, fontWeight: '600', textAlign: 'center', padding: space(0.5) },
});
