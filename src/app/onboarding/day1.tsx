import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { day1Line } from '../../engine/score';
import { getSession, SavedSession } from '../../store/sessions';
import { useProfile } from '../../store/profile';
import { formatTime, REMINDER_OPTIONS, scheduleDailyReminder } from '../../reminders';
import { PrimaryButton } from '../../components/ui';
import { track } from '../../analytics';
import { fonts, space, useColors } from '../../theme';

export default function Day1() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { update } = useProfile();
  const [s, setS] = useState<SavedSession>();
  const [time, setTime] = useState(REMINDER_OPTIONS[1]);

  useEffect(() => {
    getSession(id ?? '').then(setS);
  }, [id]);

  const finish = async () => {
    const ok = await scheduleDailyReminder(time.hour, time.minute).catch(() => false);
    await update({ onboarded: true, baselineSessionId: id, reminder: ok ? time : null });
    track('onboarding_complete', { wpm: s?.wpm ?? null, reminder: ok, recorded: !!s?.recordings?.length });
    router.replace('/');
    router.push({ pathname: '/paywall', params: { wpm: String(s?.wpm ?? '') } });
  };

  if (!s) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const stats = [
    { label: 'Pace', value: `${s.wpm}`, unit: 'wpm' },
    { label: 'Fillers', value: `${s.fillers}`, unit: s.fillers === 1 ? 'filler' : 'fillers' },
    { label: 'Accuracy', value: `${s.accuracy ?? '–'}`, unit: '%' },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.wrap, { paddingTop: insets.top + space(3), paddingBottom: insets.bottom + space(3) }]}
    >
      <Text style={[styles.eyebrow, { color: colors.muted }]}>YOUR DAY 1</Text>
      <View style={styles.statRow}>
        {stats.map((x) => (
          <View key={x.label} style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={[styles.statLabel, { color: colors.muted }]}>{x.label}</Text>
            <Text style={[styles.statValue, { color: colors.ink }]}>{x.value}</Text>
            <Text style={[styles.statUnit, { color: colors.muted }]}>{x.unit}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.lead, { color: colors.ink }]}>{day1Line(s.wpm)}</Text>
      <Text style={[styles.lead, { color: colors.muted }]}>
        {s.recordings?.length
          ? 'Your recording is saved on this phone. On day 7 and day 30 you’ll read the same passage, and you can play them side by side.'
          : 'On day 7 and day 30 you’ll read the same passage again, so you can see what changed.'}
      </Text>

      <Text style={[styles.h2, { color: colors.ink }]}>When should we remind you?</Text>
      <View style={styles.chips}>
        {REMINDER_OPTIONS.map((o) => {
          const on = o.hour === time.hour && o.minute === time.minute;
          return (
            <Pressable
              key={`${o.hour}:${o.minute}`}
              onPress={() => setTime(o)}
              style={[styles.chip, { borderColor: on ? colors.signal : colors.line, backgroundColor: on ? colors.signalSoft : colors.surface }]}
            >
              <Text style={[styles.chipText, { color: colors.ink }]}>{formatTime(o.hour, o.minute)}</Text>
            </Pressable>
          );
        })}
      </View>

      <PrimaryButton label="Continue" onPress={finish} style={{ marginTop: space(2) }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space(3), gap: space(2) },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  statRow: { flexDirection: 'row', gap: space(1.25) },
  stat: { flex: 1, borderWidth: 1, borderRadius: 16, padding: space(1.5), gap: 2 },
  statLabel: { fontSize: 13, fontWeight: '500' },
  statValue: { fontFamily: fonts.display, fontSize: 36, lineHeight: 40 },
  statUnit: { fontSize: 13 },
  lead: { fontSize: 17, lineHeight: 25 },
  h2: { fontSize: 20, fontWeight: '700', marginTop: space(1) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1) },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: space(1.75), paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  chipText: { fontSize: 15, fontWeight: '500' },
});
