import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { space, useColors } from '../../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

// A row on the Library's shelf with an icon: Your words, Your scripts, the cold read.
// (ui.tsx Row is the plain version, used for the passages.)

export function ShelfRow({
  icon,
  title,
  meta,
  onPress,
  right,
  hint,
}: {
  icon: IconName;
  title: string;
  meta: string;
  onPress: () => void;
  right?: ReactNode;
  hint?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${meta}`}
      accessibilityHint={hint}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.75 : 1 }]}
    >
      <View style={[styles.icon, { backgroundColor: colors.signalSoft }]}>
        <Ionicons name={icon} size={20} color={colors.signal} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.meta, { color: colors.muted }]}>{meta}</Text>
      </View>
      {right}
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), borderWidth: 1, borderRadius: 16, padding: space(1.75), minHeight: 68 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '700' },
  meta: { fontSize: 14, lineHeight: 19, marginTop: 2 },
});
