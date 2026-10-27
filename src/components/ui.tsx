import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { space, useColors } from '../theme';

export function PrimaryButton({
  label,
  onPress,
  disabled,
  busy,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  style?: ViewStyle;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: colors.button, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{label}</Text>}
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, style }: { label: string; onPress: () => void; style?: ViewStyle }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.secondary, { borderColor: colors.line, opacity: pressed ? 0.7 : 1 }, style]}
    >
      <Text style={[styles.secondaryText, { color: colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

export function ProBadge() {
  const colors = useColors();
  return (
    <View style={[styles.badge, { backgroundColor: colors.signalSoft }]}>
      <Text style={[styles.badgeText, { color: colors.signal }]}>PRO</Text>
    </View>
  );
}

export function Row({
  title,
  meta,
  onPress,
  right,
  locked,
}: {
  title: string;
  meta?: string;
  onPress: () => void;
  right?: ReactNode;
  locked?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>
          {title}
        </Text>
        {meta ? <Text style={[styles.rowMeta, { color: colors.muted }]}>{meta}</Text> : null}
      </View>
      {right}
      <Ionicons name={locked ? 'lock-closed' : 'chevron-forward'} size={locked ? 16 : 20} color={colors.muted} />
    </Pressable>
  );
}

export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.section, { color: colors.ink }]}>{children}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  primary: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', minHeight: 54 },
  primaryText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  secondary: { borderWidth: 1, borderRadius: 16, paddingVertical: 15, alignItems: 'center', minHeight: 52 },
  secondaryText: { fontSize: 17, fontWeight: '600' },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(1), borderWidth: 1, borderRadius: 16, padding: space(2), minHeight: 64 },
  rowTitle: { fontSize: 17, fontWeight: '600' },
  rowMeta: { fontSize: 14, marginTop: 2 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space(1) },
  section: { fontSize: 17, fontWeight: '700' },
});
