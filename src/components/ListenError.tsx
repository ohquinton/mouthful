import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { space, useColors } from '../theme';

/**
 * Shown when the recogniser reports a problem (useListener's `error`), for example
 * "This phone can’t listen for Indian English. Pick another in You."
 * Always gives two ways out: change the English in You, or try again.
 * Screens render it whenever `listener.error` is set, whatever the listener state.
 */
export function ListenError({ message, onRetry, style }: { message: string | null; onRetry: () => void; style?: ViewStyle }) {
  const colors = useColors();
  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }, style]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Text style={[styles.title, { color: colors.ink }]}>The phone stopped listening</Text>
      <Text style={[styles.body, { color: colors.muted }]}>{message || 'Something went wrong with speech recognition.'}</Text>
      <View style={styles.row}>
        <Pressable onPress={onRetry} style={[styles.btn, { backgroundColor: colors.button }]} accessibilityRole="button">
          <Text style={styles.btnText}>Try again</Text>
        </Pressable>
        {/* dismissTo leaves this screen for the You tab, where the English to listen for is chosen. */}
        <Pressable onPress={() => router.dismissTo('/you')} hitSlop={8} accessibilityRole="button">
          <Text style={[styles.link, { color: colors.signal }]}>Open You</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: space(2), gap: space(1), alignSelf: 'stretch' },
  title: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(0.5) },
  btn: { borderRadius: 12, paddingHorizontal: space(2.5), paddingVertical: 12 },
  // White on colors.button, like PrimaryButton (theme.ts has no on-button token yet).
  btnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  link: { fontSize: 16, fontWeight: '600', padding: space(1) },
});
