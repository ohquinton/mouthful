import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { router } from 'expo-router';
import type { ListenerErrorCode } from '../speech/useListener';
import { space, useColors } from '../theme';

/**
 * The card's title for each way the recogniser can stop. The body is the listener's message.
 * The message is checked too, as a fallback: a 'repeated-failure' can be the mic or the
 * connection and only the message says which, and a card should never pair the generic title
 * with the language body if the code didn't come through.
 */
export function errorTitle(code: ListenerErrorCode | null, message: string | null): string {
  const text = message ?? '';
  if (code === 'language-not-supported' || /can[’']t listen for/i.test(text)) return 'Can’t listen for this English';
  if (code === 'interrupted') return 'Paused';
  if (/connection|network/i.test(text)) return 'Lost the connection';
  if (code === 'repeated-failure') return 'The phone isn’t hearing you';
  return 'The phone stopped listening';
}

/**
 * Shown when the recogniser has stopped for good (useListener's state is 'error'), with a way back.
 * - 'language-not-supported': the phone can't listen for the chosen English. Try again won't
 *   help until they pick another, so it also offers a way to the You tab.
 * - 'interrupted' with `onResume`: something else took the mic. "Carry on" keeps the read so
 *   far; "Start over" is the usual retry. We don't say it was a call, because we don't know.
 * - anything else: Try again.
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
  /** Carry on from where the read stopped. Only offered for 'interrupted'. */
  onResume?: () => void | Promise<void>;
  /** The last word Glide reached, for "You got to …". */
  lastWord?: string;
  style?: ViewStyle;
}) {
  const colors = useColors();
  // Each action can take up to 1.5 s (the mic stopping). A second tap meanwhile would start it twice.
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const language = code === 'language-not-supported' || /can[’']t listen for/i.test(message ?? '');
  // Carry on only makes sense after an interruption; other errors would just fail again.
  const resume = code === 'interrupted' ? onResume : undefined;
  const canResume = !!resume;

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

  const title = errorTitle(code, message);
  const body = canResume
    ? `Something else used the mic, so listening stopped.${lastWord ? ` You got to “${lastWord}”.` : ''}`
    : message || 'Something went wrong with speech recognition.';
  const label = canResume ? `Paused. ${lastWord ? `Carry on from ${lastWord}, or start over.` : 'Carry on, or start over.'}` : undefined;

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }, style]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      accessibilityLabel={label}
    >
      <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
      <Text style={[styles.body, { color: colors.muted }]}>{body}</Text>
      <View style={styles.row}>
        <Pressable
          onPress={() => run(resume ?? onRetry)}
          disabled={busy}
          style={[styles.btn, { backgroundColor: colors.button, opacity: busy ? 0.6 : 1 }]}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy }}
        >
          <Text style={styles.btnText}>{busy ? 'Starting…' : canResume ? 'Carry on' : 'Try again'}</Text>
        </Pressable>
        {canResume && (
          <Pressable onPress={() => run(onRetry)} disabled={busy} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.link, { color: colors.signal }]}>Start over</Text>
          </Pressable>
        )}
        {/* dismissTo leaves this screen for the You tab, where the English to listen for is chosen. */}
        {language && (
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
