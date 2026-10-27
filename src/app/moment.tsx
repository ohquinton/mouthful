import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getMoment, isoDate, MomentId, MOMENTS } from '../content/moments';
import { useProfile } from '../store/profile';
import { track } from '../analytics';
import { PrimaryButton } from '../components/ui';
import { fonts, space, useColors } from '../theme';

const WHEN = [
  { label: 'Today', days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: 'In 3 days', days: 3 },
  { label: 'Next week', days: 7 },
  { label: 'In 2 weeks', days: 14 },
  { label: 'No date', days: -1 },
];

/** "What are you preparing for?" — pick a moment and, optionally, when it is. */
export default function MomentPicker() {
  const { id: preset } = useLocalSearchParams<{ id?: MomentId }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, update } = useProfile();
  const [id, setId] = useState<MomentId | undefined>(preset ?? (profile.moment?.id as MomentId | undefined));
  const [when, setWhen] = useState<number>(3);

  const start = async () => {
    if (!id) return;
    const date = when >= 0 ? isoDate(new Date(Date.now() + when * 86_400_000)) : undefined;
    const same = profile.moment?.id === id;
    await update({ moment: { id, date, startedAt: Date.now(), done: same ? profile.moment?.done ?? [] : [], scriptId: same ? profile.moment?.scriptId : undefined } });
    track('moment_start', { moment: id, days_out: when });
    router.canGoBack() ? router.back() : router.replace('/');
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.top}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={12} accessibilityLabel="Close">
          <Ionicons name="close" size={26} color={colors.muted} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingBottom: insets.bottom + space(3) }]}>
        <Text style={[styles.h1, { color: colors.ink }]}>What are you preparing for?</Text>
        <Text style={[styles.lead, { color: colors.muted }]}>
          You’ll get a five-step plan: the words, a practice read, your real version, and a final run-through.
        </Text>

        {MOMENTS.map((m) => {
          const on = id === m.id;
          return (
            <Pressable
              key={m.id}
              onPress={() => setId(m.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[styles.option, { borderColor: on ? colors.signal : colors.line, backgroundColor: on ? colors.signalSoft : colors.surface }]}
            >
              <Ionicons name={m.icon} size={24} color={colors.signal} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.optTitle, { color: colors.ink }]}>{m.title}</Text>
                <Text style={[styles.optSub, { color: colors.muted }]}>{m.sub}</Text>
              </View>
              <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={on ? colors.signal : colors.line} />
            </Pressable>
          );
        })}

        {id && (
          <>
            <Text style={[styles.h2, { color: colors.ink }]}>When is it?</Text>
            <View style={styles.chips}>
              {WHEN.map((w) => {
                const on = when === w.days;
                return (
                  <Pressable
                    key={w.label}
                    onPress={() => setWhen(w.days)}
                    style={[styles.chip, { borderColor: on ? colors.signal : colors.line, backgroundColor: on ? colors.signalSoft : colors.surface }]}
                  >
                    <Text style={[styles.chipText, { color: colors.ink }]}>{w.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        <PrimaryButton
          label={id ? `Start my ${getMoment(id)?.short} plan` : 'Choose one'}
          disabled={!id}
          onPress={start}
          style={{ marginTop: space(1) }}
        />
        {profile.moment && (
          <Pressable
            hitSlop={8}
            onPress={async () => {
              await update({ moment: null });
              router.canGoBack() ? router.back() : router.replace('/');
            }}
          >
            <Text style={[styles.clear, { color: colors.muted }]}>I’m not preparing for anything right now</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { paddingHorizontal: space(2), height: 48, justifyContent: 'center', alignItems: 'flex-end' },
  wrap: { paddingHorizontal: space(2.5), gap: space(1.5) },
  h1: { fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 36 },
  h2: { fontSize: 18, fontWeight: '700', marginTop: space(1) },
  lead: { fontSize: 16, lineHeight: 23, marginBottom: space(1) },
  option: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), borderWidth: 1.5, borderRadius: 18, padding: space(2), minHeight: 72 },
  optTitle: { fontSize: 17, fontWeight: '600' },
  optSub: { fontSize: 14, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1) },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: space(1.75), paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  chipText: { fontSize: 15, fontWeight: '500' },
  clear: { fontSize: 15, fontWeight: '600', textAlign: 'center', padding: space(1.5) },
});
