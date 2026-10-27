import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { router } from 'expo-router';
import type { ListenerErrorCode } from '../speech/useListener';
import { space, useColors } from '../theme';

/**
 * Shown when the recogniser has stopped for good (useListener's state is 'error'), with a way back.
 * - 'language-not-supported': the phone can't listen for the chosen English. Try again won't
 *   help until they pick another, so it also offers "Open You".
 * - 'restart-failed' (or anything else): the phone stopped listening. Try again.
 * Screens render it only when `listener.state === 'error'`. A routine error while the
 * listener is still listening (it restarts by itself) shows nothing.
 */
export function ListenError({
  message,
  code,
  onRetry,
  style,
}: {
  message: string | null;
  code: ListenerErrorCode | null;
  onRetry: () => void | Promise<void>;
  style?: ViewStyle;
}) {
  const colors = useColors();
  // Try again can take up to 1.5 s (the mic stopping). A second tap meanwhile would start it twice.
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const language = code === 'language-not-supported';

  const retry = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await onRetry();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }, style]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Text style={[styles.title, { color: colors.ink }]}>{language ? 'Can’t listen for this English' : 'The phone stopped listening'}</Text>
      <Text style={[styles.body, { color: colors.muted }]}>{message || 'Something went wrong with speech recognition.'}</Text>
      <View style={styles.row}>
        <Pressable
          onPress={retry}
          disabled={busy}
          style={[styles.btn, { backgroundColor: colors.button, opacity: busy ? 0.6 : 1 }]}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy }}
        >
          <Text style={styles.btnText}>{busy ? 'Starting…' : 'Try again'}</Text>
        </Pressable>
        {/* dismissTo leaves this screen for the You tab, where the English to listen for is chosen. */}
        {language && (
          <Pressable onPress={() => router.dismissTo('/you')} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.link, { color: colors.signal }]}>Open You</Text>
          </Pressable>
        )}
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
