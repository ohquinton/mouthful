import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { router } from 'expo-router';
import type { ListenerErrorCode } from '../speech/useListener';
import { errorCard } from './listenErrorCard';
import { space, useColors } from '../theme';

/**
 * Shown when the recogniser has stopped for good (useListener's state is 'error'), with a way back.
 * - 'language-not-supported': the phone can't listen for the chosen English. Try again won't
 *   help until they pick another, so it also offers a way to the You tab.
 * - any code that may come back ('interrupted', 'network', 'repeated-failure', 'restart-failed'),
 *   when the screen passes `onResume`: "Carry on" keeps the read so far; "Start over" is the
 *   usual retry.
 * - otherwise: Try again.
 * What it says and shows per code is errorCard() in listenErrorCard.ts (unit tested).
 * Screens render it only when `listener.state === 'error'`. A routine error while the
 * listener is still listening (it restarts by itself) shows nothing.
 */
export function ListenError({
  message,
  code,
  onRetry,
  onResume,
  lastWord,
  style,
}: {
  message: string | null;
  code: ListenerErrorCode | null;
  onRetry: () => void | Promise<void>;
  /** Carry on from where the read stopped. Offered for every code that may come back. */
  onResume?: () => void | Promise<void>;
  /** The last word Glide reached, for "You got to …". */
  lastWord?: string;
  style?: ViewStyle;
}) {
  const colors = useColors();
  // Each action can take up to 1.5 s (the mic stopping). A second tap meanwhile would start it twice.
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const card = errorCard(code, message, !!onResume, lastWord);
  // Only set when the card offers Carry on (errorCard checks onResume was passed).
  const resume = card.primary === 'resume' ? onResume : undefined;

  const run = async (action: () => void | Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await action();
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
      accessibilityLabel={card.label}
    >
      <Text style={[styles.title, { color: colors.ink }]}>{card.title}</Text>
      <Text style={[styles.body, { color: colors.muted }]}>{card.body}</Text>
      <View style={styles.row}>
        <Pressable
          onPress={() => run(resume ?? onRetry)}
          disabled={busy}
          style={[styles.btn, { backgroundColor: colors.button, opacity: busy ? 0.6 : 1 }]}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy }}
        >
          <Text style={styles.btnText}>{busy ? 'Starting…' : resume ? 'Carry on' : 'Try again'}</Text>
        </Pressable>
        {card.startOver && (
          <Pressable onPress={() => run(onRetry)} disabled={busy} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.link, { color: colors.signal }]}>Start over</Text>
          </Pressable>
        )}
        {/* dismissTo leaves this screen for the You tab, where the English to listen for is chosen. */}
        {card.chooseEnglish && (
          <Pressable onPress={() => router.dismissTo('/you')} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.link, { color: colors.signal }]}>Choose another English</Text>
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
  // Wraps so the second action drops to its own line at the largest Dynamic Type, not off-screen.
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space(2), marginTop: space(0.5) },
  btn: { borderRadius: 12, paddingHorizontal: space(2.5), paddingVertical: 12 },
  // White on colors.button, like PrimaryButton (theme.ts has no on-button token yet).
  btnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  link: { fontSize: 16, fontWeight: '600', padding: space(1) },
});
