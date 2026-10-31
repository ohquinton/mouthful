import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { serverServiceName, type ListenerState } from '../speech/useListener';
import { useProfile } from '../store/profile';
import { track } from '../analytics';
import { BRAND } from '../brand';
import { micGateExit } from '../onboarding';
import { PrimaryButton } from './ui';
import { space, useColors } from '../theme';

/**
 * Shown instead of a practice screen when the mic can't be used yet:
 * - permission denied → send them to Settings
 * - phone can't transcribe offline → ask, once, before any audio leaves the device
 * - speech recognition switched off (iOS: Siri & Dictation) → send them to Settings
 * Returns null when listening can go ahead.
 */

/** Settings can't open on web (and may throw on some platforms): fail quietly. */
function openSettings() {
  try {
    Linking.openSettings().catch(() => {});
  } catch {}
}

const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

/** Off the onboarding stack and onto Today, with nothing left behind for Android back to land on. */
function goToToday() {
  if (router.canDismiss()) router.dismissAll();
  router.replace('/');
}

export function MicGate({ state, onAllowed }: { state: ListenerState; onAllowed: () => void }) {
  const colors = useColors();
  const { profile, update } = useProfile();
  // During onboarding (the Day 1 read), "no" finishes onboarding instead of looping back to the
  // mic step: the plan is already saved, and the read can wait (principle 8, onboarding brief S0).
  const onboarding = micGateExit(profile.onboarded) === 'today';
  const notNowLabel = onboarding ? 'Skip for now' : 'Not now';
  const notNow = async () => {
    if (!onboarding) return leave();
    await update({ onboarded: true });
    track('onboarding_complete', { skipped: true, reason: state });
    goToToday();
  };
  const later = onboarding ? (
    <Text style={[styles.note, { color: colors.muted }]}>
      {profile.moment ? 'Your plan is saved. ' : ''}You can do this read later from Today.
    </Text>
  ) : null;

  if (state === 'needs-consent') {
    const service = serverServiceName();
    return (
      <View style={[styles.wrap, { backgroundColor: colors.bg }]}>
        <Ionicons name="cloud-outline" size={44} color={colors.signal} />
        <Text style={[styles.h2, { color: colors.ink }]}>This phone needs help to follow you</Text>
        <Text style={[styles.body, { color: colors.muted }]}>
          To follow your reading, {BRAND.name} can use {service}. Your voice is sent to that service to be turned
          into text while you read. {BRAND.name} doesn’t keep it, and nothing is sent until you say yes.
        </Text>
        {later}
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
            notNow();
          }}
          accessibilityRole="button"
        >
          <Text style={[styles.link, { color: colors.muted }]}>{notNowLabel}</Text>
        </Pressable>
      </View>
    );
  }

  if (state === 'denied') {
    return (
      <View style={[styles.wrap, { backgroundColor: colors.bg }]}>
        <Ionicons name="mic-off-outline" size={44} color={colors.muted} />
        <Text style={[styles.h2, { color: colors.ink }]}>{BRAND.name} can’t hear you yet</Text>
        <Text style={[styles.body, { color: colors.muted }]}>
          It needs the microphone to follow your reading. Turn on Microphone and Speech Recognition in Settings.
        </Text>
        {later}
        <PrimaryButton label="Open Settings" style={{ alignSelf: 'stretch' }} onPress={openSettings} />
        <Pressable hitSlop={8} onPress={notNow} accessibilityRole="button">
          <Text style={[styles.link, { color: colors.muted }]}>{notNowLabel}</Text>
        </Pressable>
      </View>
    );
  }

  if (state === 'unavailable') {
    return (
      <View style={[styles.wrap, { backgroundColor: colors.bg }]}>
        <Ionicons name="mic-off-outline" size={44} color={colors.muted} />
        <Text style={[styles.h2, { color: colors.ink }]}>Speech recognition is off on this phone</Text>
        <Text style={[styles.body, { color: colors.muted }]}>Check that Siri & Dictation is on in Settings, then come back.</Text>
        {later}
        <PrimaryButton label="Open Settings" style={{ alignSelf: 'stretch' }} onPress={openSettings} />
        <Pressable hitSlop={8} onPress={notNow} accessibilityRole="button">
          <Text style={[styles.link, { color: colors.muted }]}>{notNowLabel}</Text>
        </Pressable>
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
  note: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
