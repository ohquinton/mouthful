import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { EXPERIENCES, type Experience } from '../content/experiences';
import { useExperience } from '../store/experience';
import { fonts, space, useColors } from '../theme';

/** Routes mount only after a choice, so a cold deep link cannot start a practice behind the doors. */
export function ExperienceGate({ children }: { children: ReactNode }) {
  const { mode, choose } = useExperience();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  if (mode) return children;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={[styles.wrap, { paddingTop: insets.top + space(4), paddingBottom: insets.bottom + space(3) }]}>
      <Text style={[styles.brand, { color: colors.ink }]}>SaidClearly</Text>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>What would you like to practise?</Text>
      <Text style={[styles.body, { color: colors.muted }]}>Two ways to grow. Choose one to begin; you can switch any time from Home.</Text>
      {(['articulation', 'english'] as const).map((id: Experience) => {
        const experience = EXPERIENCES[id];
        const accent = colors[experience.line];
        return (
          <Pressable key={id} accessibilityRole="button" accessibilityLabel={`Open ${experience.name}. ${experience.description}`}
            onPress={() => choose(id)} style={({ pressed }) => [styles.door, { backgroundColor: colors.surface, borderColor: accent, opacity: pressed ? 0.75 : 1 }]}>
            <View style={styles.heading}>
              <Ionicons name={id === 'articulation' ? 'chatbubble-ellipses-outline' : 'book-outline'} size={28} color={accent} />
              <Text style={[styles.name, { color: colors.ink }]}>{experience.name}</Text>
            </View>
            <Text style={[styles.promise, { color: accent }]}>{experience.promise}</Text>
            <Text style={[styles.body, { color: colors.muted }]}>{experience.description}</Text>
            <View style={styles.features}>{experience.features.map((feature) => <Text key={feature} style={[styles.feature, { color: colors.ink }]}>• {feature}</Text>)}</View>
            <Text style={[styles.enter, { color: accent }]}>Enter {experience.name} →</Text>
          </Pressable>
        );
      })}
      <Text style={[styles.note, { color: colors.muted }]}>Your saved practice, vocabulary and account stay together.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space(2.5), gap: space(2), maxWidth: 620, width: '100%', alignSelf: 'center' },
  brand: { fontSize: 16, fontWeight: '700' },
  title: { fontFamily: fonts.displayBold, fontSize: 32, lineHeight: 39 },
  body: { fontSize: 16, lineHeight: 23 },
  door: { borderWidth: 1.5, borderRadius: 18, padding: space(2.5), gap: space(1.25) },
  heading: { flexDirection: 'row', alignItems: 'center', gap: space(1.25) },
  name: { fontFamily: fonts.displayBold, fontSize: 25, lineHeight: 31, flex: 1 },
  promise: { fontSize: 17, fontWeight: '700', lineHeight: 24 },
  features: { gap: space(0.75) },
  feature: { fontSize: 14, lineHeight: 20 },
  enter: { fontSize: 16, fontWeight: '700', lineHeight: 23, paddingTop: space(0.5) },
  note: { fontSize: 14, lineHeight: 21 },
});
