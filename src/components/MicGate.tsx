import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { serverServiceName, type ListenerState } from '../speech/useListener';
import { useProfile } from '../store/profile';
import { track } from '../analytics';
import { BRAND } from '../brand';
import { PrimaryButton } from './ui';
import { space, useColors } from '../theme';

/**
 * Shown instead of a practice screen when the mic can't be used yet:
 * - permission denied → send them to Settings
 * - phone can't transcribe offline → ask, once, before any audio leaves the device
 * Returns null when listening can go ahead.
 */
export function MicGate({ state, onAllowed }: { state: ListenerState; onAllowed: () => void }) {
  const colors = useColors();
  const { update } = useProfile();

  if (state === 'needs-consent') {
    const service = serverServiceName();
    return (
      <View style={[styles.wrap, { backgroundColor: colors.bg }]}>
        <Ionicons name="cloud-outline" size={44} color={colors.signal} />
        <Text style={[styles.h2, { color: colors.ink }]}>This device can’t transcribe offline</Text>
        <Text style={[styles.body, { color: colors.muted }]}>
          To follow your reading, {BRAND.name} can use {service}. Your voice is sent to that service to be turned
          into text while you read. {BRAND.name} doesn’t keep it, and nothing is sent until you say yes.
        </Text>
        <PrimaryButton
          label={`Use ${service}`}
          style={{ alignSelf: 'stretch' }}
          onPress={async () => {
            await update({ allowServerRecognition: true });
            track('server_recognition_consent', { allowed: true });
            onAllowed();
          }}
        />
        <Pressable
          hitSlop={8}
          onPress={() => {
            track('server_recognition_consent', { allowed: false });
            router.canGoBack() ? router.back() : router.replace('/');
          }}
        >
          <Text style={[styles.link, { color: colors.muted }]}>Not now</Text>
        </Pressable>
      </View>
    );
  }

  if (state === 'denied') {
    return (
      <View style={[styles.wrap, { backgroundColor: colors.bg }]}>
        <Ionicons name="mic-off-outline" size={44} color={colors.muted} />
        <Text style={[styles.h2, { color: colors.ink }]}>{BRAND.name} needs the microphone</Text>
        <Text style={[styles.body, { color: colors.muted }]}>
          It listens only while you practise, so it can follow along. Turn on Microphone and Speech Recognition in
          Settings.
        </Text>
        <PrimaryButton label="Open Settings" style={{ alignSelf: 'stretch' }} onPress={() => Linking.openSettings()} />
        <Pressable hitSlop={8} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <Text style={[styles.link, { color: colors.muted }]}>Not now</Text>
        </Pressable>
      </View>
    );
  }

  if (state === 'unavailable') {
    return (
      <View style={[styles.wrap, { backgroundColor: colors.bg }]}>
        <Text style={[styles.body, { color: colors.ink }]}>Speech recognition isn’t available on this device right now.</Text>
      </View>
    );
  }

  return null;
}

export const gateStates: ListenerState[] = ['needs-consent', 'denied', 'unavailable'];

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(4), gap: space(2) },
  h2: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 16, lineHeight: 23, textAlign: 'center' },
  link: { fontSize: 16, fontWeight: '600', padding: space(1) },
});
